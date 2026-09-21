package followups

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
	"github.com/agoy/clientos/backend/internal/platform/pagination"
)

var validStatuses = map[string]bool{"pending": true, "completed": true, "cancelled": true}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/follow-ups", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
	})
}

type followUpDTO struct {
	ID          string     `json:"id"`
	LeadID      string     `json:"lead_id"`
	DueDate     string     `json:"due_date"`
	Description *string    `json:"description"`
	Status      string     `json:"status"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
	Lead        *leadRef   `json:"lead,omitempty"`
}

type leadRef struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	CompanyID string  `json:"company_id"`
	Company   *string `json:"company"`
}

func txt(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	v := t.String
	return &v
}

func mustUser(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	uid, ok := middleware.UserIDFrom(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return uuid.Nil, false
	}
	id, err := uuid.Parse(uid)
	if !ok || err != nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Invalid session")
		return uuid.Nil, false
	}
	return id, true
}

type row struct {
	db.FollowUp
	LeadTitle   pgtype.Text
	CompanyID   uuid.UUID
	CompanyName pgtype.Text
}

func toDTO(f db.FollowUp, leadTitle, companyName pgtype.Text, companyID uuid.UUID) followUpDTO {
	dto := followUpDTO{
		ID: f.ID.String(), LeadID: f.LeadID.String(), DueDate: f.DueDate.Time.Format("2006-01-02"),
		Description: txt(f.Description), Status: f.Status,
		CompletedAt: tsPtr(f.CompletedAt), CreatedAt: f.CreatedAt.Time,
	}
	dto.Lead = &leadRef{ID: f.LeadID.String(), Title: leadTitle.String, CompanyID: companyID.String()}
	if companyName.Valid {
		s := companyName.String
		dto.Lead.Company = &s
	}
	return dto
}

func tsPtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

type followUpInput struct {
	LeadID      *string `json:"lead_id"`
	DueDate     *string `json:"due_date"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", "")
	view := q.Get("view")
	if view == "" {
		view = "all"
	}
	ctx := r.Context()

	var status pgtype.Text
	if v := q.Get("status"); v != "" {
		status = pgtype.Text{String: v, Valid: true}
	}
	rows, err := m.q.ListFollowUps(ctx, db.ListFollowUpsParams{
		UserID: userID, View: view, Status: status,
		Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p)),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	total, err := m.q.CountFollowUps(ctx, db.CountFollowUpsParams{
		UserID: userID, View: pgtype.Text{String: view, Valid: true}, Status: status,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]followUpDTO, 0, len(rows))
	for _, f := range rows {
		data = append(data, toDTO(db.FollowUp{
			ID: f.ID, UserID: f.UserID, LeadID: f.LeadID, DueDate: f.DueDate,
			Description: f.Description, Status: f.Status, CompletedAt: f.CompletedAt, CreatedAt: f.CreatedAt,
		}, pgtype.Text{String: f.LeadTitle, Valid: true}, pgtype.Text{String: f.CompanyName, Valid: true}, uuid.Nil))
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: int(total), TotalPages: pagination.TotalPages(int(total), p.PerPage),
	})
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in followUpInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.LeadID == nil || in.DueDate == nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead_id and due_date are required")
		return
	}
	leadID, err := uuid.Parse(*in.LeadID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead_id must be a valid uuid")
		return
	}
	dueDate, err := time.Parse("2006-01-02", *in.DueDate)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "due_date must be YYYY-MM-DD")
		return
	}
	if _, err := m.q.GetLead(r.Context(), db.GetLeadParams{ID: leadID, UserID: userID}); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead not found")
		return
	}
	var desc pgtype.Text
	if in.Description != nil && *in.Description != "" {
		desc = pgtype.Text{String: *in.Description, Valid: true}
	}
	f, err := m.q.CreateFollowUp(r.Context(), db.CreateFollowUpParams{
		UserID: userID, LeadID: leadID, DueDate: pgtype.Date{Time: dueDate, Valid: true}, Description: desc,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(f, pgtype.Text{}, pgtype.Text{}, uuid.Nil))
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
	var in followUpInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.Status != nil && !validStatuses[*in.Status] {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
		return
	}
	var desc pgtype.Text
	if in.Description != nil {
		desc = pgtype.Text{String: *in.Description, Valid: true}
	}
	var dueDate pgtype.Date
	if in.DueDate != nil {
		d, err := time.Parse("2006-01-02", *in.DueDate)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "due_date must be YYYY-MM-DD")
			return
		}
		dueDate = pgtype.Date{Time: d, Valid: true}
	}
	var status pgtype.Text
	if in.Status != nil {
		status = pgtype.Text{String: *in.Status, Valid: true}
	}
	f, err := m.q.UpdateFollowUp(r.Context(), db.UpdateFollowUpParams{
		ID: id, UserID: userID, Description: desc, Status: status, DueDate: dueDate,
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Follow-up not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(f, pgtype.Text{}, pgtype.Text{}, uuid.Nil))
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
	if _, err := m.q.UpdateFollowUp(r.Context(), db.UpdateFollowUpParams{ID: id, UserID: userID}); err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Follow-up not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
