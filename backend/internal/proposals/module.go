package proposals

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
	"github.com/agoy/clientos/backend/internal/platform/pagination"
)

var validStatuses = map[string]bool{
	"draft": true, "sent": true, "negotiation": true, "accepted": true, "rejected": true, "expired": true,
}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/proposals", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
	})
}

type proposalDTO struct {
	ID          string     `json:"id"`
	LeadID      string     `json:"lead_id"`
	CompanyID   *string    `json:"company_id"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Amount      float64    `json:"amount"`
	Status      string     `json:"status"`
	SentAt      *time.Time `json:"sent_at"`
	ValidUntil  *string    `json:"valid_until"`
	Notes       *string    `json:"notes"`
	CompanyName *string    `json:"company_name"`
	LeadTitle   *string    `json:"lead_title"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func ntxt(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func txt(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	v := t.String
	return &v
}

func num(t pgtype.Numeric) float64 {
	f, err := t.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

func mustUser(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	uid, ok := middleware.UserIDFrom(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return uuid.Nil, false
	}
	id, err := uuid.Parse(uid)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Invalid session")
		return uuid.Nil, false
	}
	return id, true
}

type proposalInput struct {
	LeadID      *string  `json:"lead_id"`
	CompanyID   *string  `json:"company_id"`
	Title       *string  `json:"title"`
	Description *string  `json:"description"`
	Amount      *float64 `json:"amount"`
	Status      *string  `json:"status"`
	ValidUntil  *string  `json:"valid_until"`
	Notes       *string  `json:"notes"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", "")
	ctx := r.Context()
	params := db.ListProposalsParams{UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p))}
	if v := q.Get("status"); v != "" {
		params.Status = pgtype.Text{String: v, Valid: true}
	}
	if v := q.Get("lead_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			params.LeadID = &id
		}
	}
	rows, err := m.q.ListProposals(ctx, params)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]proposalDTO, 0, len(rows))
	for _, pr := range rows {
		data = append(data, toDTO(db.Proposal{
			ID: pr.ID, UserID: pr.UserID, LeadID: pr.LeadID, CompanyID: pr.CompanyID,
			Title: pr.Title, Description: pr.Description, Amount: pr.Amount, Status: pr.Status,
			SentAt: pr.SentAt, ValidUntil: pr.ValidUntil, Notes: pr.Notes,
			CreatedAt: pr.CreatedAt, UpdatedAt: pr.UpdatedAt,
		}, pr.CompanyName, pgtype.Text{String: pr.LeadTitle, Valid: true}))
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: len(data), TotalPages: 1,
	})
}

func toDTO(p db.Proposal, companyName, leadTitle pgtype.Text) proposalDTO {
	dto := proposalDTO{
		ID: p.ID.String(), LeadID: p.LeadID.String(), Title: p.Title,
		Description: txt(p.Description), Amount: num(p.Amount), Status: p.Status,
		Notes: txt(p.Notes), CompanyName: txt(companyName), LeadTitle: txt(leadTitle),
		CreatedAt: p.CreatedAt.Time, UpdatedAt: p.UpdatedAt.Time,
	}
	if p.CompanyID != nil {
		s := p.CompanyID.String()
		dto.CompanyID = &s
	}
	if p.SentAt.Valid {
		t := p.SentAt.Time
		dto.SentAt = &t
	}
	if p.ValidUntil.Valid {
		s := p.ValidUntil.Time.Format("2006-01-02")
		dto.ValidUntil = &s
	}
	return dto
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in proposalInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.LeadID == nil || in.Title == nil || *in.Title == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead_id and title are required")
		return
	}
	leadID, err := uuid.Parse(*in.LeadID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead_id must be a valid uuid")
		return
	}
	ctx := r.Context()
	l, err := m.q.GetLead(ctx, db.GetLeadParams{ID: leadID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead not found")
		return
	}

	status := "draft"
	if in.Status != nil && validStatuses[*in.Status] {
		status = *in.Status
	}
	amount := pgtype.Numeric{}
	if in.Amount != nil {
		_ = amount.Scan(strconv.FormatFloat(*in.Amount, 'f', -1, 64))
	}
	var validUntil pgtype.Date
	if in.ValidUntil != nil && *in.ValidUntil != "" {
		if d, err := time.Parse("2006-01-02", *in.ValidUntil); err == nil {
			validUntil = pgtype.Date{Time: d, Valid: true}
		}
	}
	var companyID *uuid.UUID
	companyID = &l.CompanyID

	p, err := m.q.CreateProposal(ctx, db.CreateProposalParams{
		UserID: userID, LeadID: leadID, CompanyID: companyID, Title: *in.Title,
		Description: ntxt(in.Description), Amount: amount, Status: status, ValidUntil: validUntil,
		Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	_, _ = m.q.CreateActivity(ctx, db.CreateActivityParams{
		UserID: userID, LeadID: &leadID, CompanyID: companyID,
		Type: "proposal", Description: "Proposal created: " + p.Title,
	})

	httpx.Data(w, http.StatusCreated, toDTO(p, pgtype.Text{}, pgtype.Text{}))
}

func (m *Module) get(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	p, err := m.q.GetProposal(r.Context(), db.GetProposalParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Proposal not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(db.Proposal{
		ID: p.ID, UserID: p.UserID, LeadID: p.LeadID, CompanyID: p.CompanyID,
		Title: p.Title, Description: p.Description, Amount: p.Amount, Status: p.Status,
		SentAt: p.SentAt, ValidUntil: p.ValidUntil, Notes: p.Notes, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}, p.CompanyName, pgtype.Text{String: p.LeadTitle, Valid: true}))
}

func (m *Module) update(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	var in proposalInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.Status != nil && !validStatuses[*in.Status] {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
		return
	}
	ctx := r.Context()
	var amount pgtype.Numeric
	if in.Amount != nil {
		_ = amount.Scan(strconv.FormatFloat(*in.Amount, 'f', -1, 64))
	}
	var validUntil pgtype.Date
	if in.ValidUntil != nil && *in.ValidUntil != "" {
		if d, err := time.Parse("2006-01-02", *in.ValidUntil); err == nil {
			validUntil = pgtype.Date{Time: d, Valid: true}
		}
	}
	var status pgtype.Text
	if in.Status != nil {
		status = pgtype.Text{String: *in.Status, Valid: true}
	}
	p, err := m.q.UpdateProposal(ctx, db.UpdateProposalParams{
		ID: id, UserID: userID,
		Title: ntxt(in.Title), Description: ntxt(in.Description), Amount: amount,
		Status: status, ValidUntil: validUntil, Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Proposal not found")
		return
	}

	if in.Status != nil && *in.Status == "sent" {
		_, _ = m.q.CreateActivity(ctx, db.CreateActivityParams{
			UserID: userID, LeadID: &p.LeadID,
			Type: "proposal", Description: "Proposal sent: " + p.Title,
		})
	}
	httpx.Data(w, http.StatusOK, toDTO(p, pgtype.Text{}, pgtype.Text{}))
}

func (m *Module) remove(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	if err := m.q.DeleteProposal(r.Context(), db.DeleteProposalParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
