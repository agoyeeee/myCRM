package leads

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
	"github.com/agoy/clientos/backend/internal/platform/pagination"
)

var validStatuses = map[string]bool{
	"research": true, "qualified": true, "contacted": true, "replied": true,
	"interested": true, "meeting": true, "proposal": true, "won": true, "lost": true,
}

var validPriorities = map[string]bool{"low": true, "medium": true, "high": true}

var validSources = map[string]bool{
	"manual": true, "web_research": true, "referral": true, "linkedin": true,
	"google_maps": true, "website": true, "existing_network": true, "other": true,
}

type Module struct {
	q    *db.Queries
	pool *pgxpool.Pool
}

func New(q *db.Queries, pool *pgxpool.Pool) *Module { return &Module{q: q, pool: pool} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/leads", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
		r.Post("/{id}/convert", m.convert)
	})
	r.Get("/pipeline", m.pipeline)
}

type leadDTO struct {
	ID             string         `json:"id"`
	CompanyID      string         `json:"company_id"`
	ContactID      *string        `json:"contact_id"`
	Title          string         `json:"title"`
	Status         string         `json:"status"`
	Priority       string         `json:"priority"`
	Source         *string        `json:"source"`
	EstimatedValue *float64       `json:"estimated_value"`
	Notes          *string        `json:"notes"`
	NextFollowUp   *time.Time     `json:"next_follow_up"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	Company        *companyRef    `json:"company"`
	Contact        *contactRef    `json:"contact"`
	Analysis       map[string]any `json:"ai_analysis,omitempty"`
}

type companyRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type contactRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func txt(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	v := t.String
	return &v
}

// ntxt converts optional string input into pgtype.Text.
func ntxt(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func num(t pgtype.Numeric) *float64 {
	if !t.Valid {
		return nil
	}
	f, err := t.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	v := f.Float64
	return &v
}

func tsPtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
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

type leadRow struct {
	db.Lead
	CompanyName pgtype.Text `json:"company_name"`
	ContactName pgtype.Text `json:"contact_name"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), q.Get("sort"), q.Get("order"), q.Get("search"))
	ctx := r.Context()

	params := db.ListLeadsParams{
		UserID: userID,
		Limit:  int32(p.PerPage),
		Offset: int32(pagination.Offset(p)),
		Sort:   p.Sort,
		Order:  p.Order,
	}
	if v := q.Get("status"); v != "" {
		params.Status = pgtype.Text{String: v, Valid: true}
	}
	if v := q.Get("priority"); v != "" {
		params.Priority = pgtype.Text{String: v, Valid: true}
	}
	if v := q.Get("company_id"); v != "" {
		if cid, err := uuid.Parse(v); err == nil {
			params.CompanyID = &cid
		}
	}
	if p.Search != "" {
		params.Search = pgtype.Text{String: p.Search, Valid: true}
	}

	total, err := m.q.CountLeads(ctx, db.CountLeadsParams{
		UserID: userID, Status: params.Status, Priority: params.Priority,
		CompanyID: params.CompanyID, Search: params.Search,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	rows, err := m.q.ListLeads(ctx, params)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]leadDTO, 0, len(rows))
	for _, row := range rows {
		data = append(data, toLeadDTO(db.Lead{
			ID: row.ID, UserID: row.UserID, CompanyID: row.CompanyID, ContactID: row.ContactID,
			Title: row.Title, Status: row.Status, Priority: row.Priority, Source: row.Source,
			EstimatedValue: row.EstimatedValue, Notes: row.Notes, NextFollowUp: row.NextFollowUp,
			CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		}, pgtype.Text{String: row.CompanyName, Valid: true}, row.ContactName, nil))
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: int(total), TotalPages: pagination.TotalPages(int(total), p.PerPage),
	})
}

func toLeadDTO(l db.Lead, companyName, contactName pgtype.Text, analysis map[string]any) leadDTO {
	dto := leadDTO{
		ID: l.ID.String(), CompanyID: l.CompanyID.String(),
		Title: l.Title, Status: l.Status, Priority: l.Priority,
		Source: txt(l.Source), EstimatedValue: num(l.EstimatedValue), Notes: txt(l.Notes),
		NextFollowUp: tsPtr(l.NextFollowUp),
		CreatedAt:    l.CreatedAt.Time, UpdatedAt: l.UpdatedAt.Time,
	}
	if l.ContactID != nil {
		s := l.ContactID.String()
		dto.ContactID = &s
	}
	if companyName.Valid {
		dto.Company = &companyRef{ID: l.CompanyID.String(), Name: companyName.String}
	}
	if contactName.Valid && dto.ContactID != nil {
		dto.Contact = &contactRef{ID: *dto.ContactID, Name: contactName.String}
	}
	dto.Analysis = analysis
	return dto
}

type leadInput struct {
	CompanyID      *string    `json:"company_id"`
	ContactID      *string    `json:"contact_id"`
	Title          *string    `json:"title"`
	Status         *string    `json:"status"`
	Priority       *string    `json:"priority"`
	Source         *string    `json:"source"`
	EstimatedValue *float64   `json:"estimated_value"`
	Notes          *string    `json:"notes"`
	NextFollowUp   *time.Time `json:"next_follow_up"`
}

func (in *leadInput) validate(create bool) error {
	if create {
		if in.CompanyID == nil || *in.CompanyID == "" {
			return errors.New("company_id is required")
		}
		if in.Title == nil || *in.Title == "" {
			return errors.New("title is required")
		}
	}
	if in.Status != nil && !validStatuses[*in.Status] {
		return errors.New("invalid status")
	}
	if in.Priority != nil && !validPriorities[*in.Priority] {
		return errors.New("invalid priority")
	}
	if in.Source != nil && *in.Source != "" && !validSources[*in.Source] {
		return errors.New("invalid source")
	}
	if in.EstimatedValue != nil && *in.EstimatedValue < 0 {
		return errors.New("estimated_value must be >= 0")
	}
	return nil
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in leadInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if err := in.validate(true); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	companyID, err := uuid.Parse(*in.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "company_id must be a valid uuid")
		return
	}
	if _, err := m.q.GetCompany(r.Context(), db.GetCompanyParams{ID: companyID, UserID: userID}); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "company not found")
		return
	}
	status := "research"
	if in.Status != nil {
		status = *in.Status
	}
	priority := "medium"
	if in.Priority != nil {
		priority = *in.Priority
	}

	var contactID *uuid.UUID
	if in.ContactID != nil && *in.ContactID != "" {
		cid, err := uuid.Parse(*in.ContactID)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "contact_id must be a valid uuid")
			return
		}
		contactID = &cid
	}

	var estValue pgtype.Numeric
	if in.EstimatedValue != nil {
		if err := estValue.Scan(strconv.FormatFloat(*in.EstimatedValue, 'f', -1, 64)); err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid estimated_value")
			return
		}
	}
	var nextFollow pgtype.Timestamptz
	if in.NextFollowUp != nil {
		nextFollow = pgtype.Timestamptz{Time: *in.NextFollowUp, Valid: true}
	}

	l, err := m.q.CreateLead(r.Context(), db.CreateLeadParams{
		UserID: userID, CompanyID: companyID, ContactID: contactID,
		Title: *in.Title, Status: status, Priority: priority,
		Source: ntxt(in.Source), EstimatedValue: estValue, Notes: ntxt(in.Notes), NextFollowUp: nextFollow,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	_, _ = m.q.CreateActivity(r.Context(), db.CreateActivityParams{
		UserID: userID, LeadID: &l.ID,
		CompanyID:   &companyID,
		Type:        "other",
		Description: "Lead created",
	})

	httpx.Data(w, http.StatusCreated, toLeadDTO(l, pgtype.Text{}, pgtype.Text{}, nil))
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
	ctx := r.Context()
	l, err := m.q.GetLead(ctx, db.GetLeadParams{ID: id, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "not_found", "Lead not found")
			return
		}
		httpx.Internal(w, err)
		return
	}
	c, err := m.q.GetCompany(ctx, db.GetCompanyParams{ID: l.CompanyID, UserID: userID})
	var companyName pgtype.Text
	if err == nil {
		companyName = pgtype.Text{String: c.Name, Valid: true}
	}
	var contactName pgtype.Text
	if l.ContactID != nil {
		if ct, err := m.q.GetContact(ctx, db.GetContactParams{ID: *l.ContactID, UserID: userID}); err == nil {
			contactName = pgtype.Text{String: ct.Name, Valid: true}
		}
	}

	var analysis map[string]any
	if a, err := m.q.LatestAIAnalysis(ctx, db.LatestAIAnalysisParams{UserID: userID, LeadID: &id}); err == nil {
		var decoded map[string]any
		if json.Unmarshal(a.Analysis, &decoded) == nil {
			analysis = decoded
		}
	}

	httpx.Data(w, http.StatusOK, toLeadDTO(l, companyName, contactName, analysis))
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
	var in leadInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if err := in.validate(false); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	ctx := r.Context()

	prev, err := m.q.GetLead(ctx, db.GetLeadParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Lead not found")
		return
	}

	var estValue pgtype.Numeric
	if in.EstimatedValue != nil {
		if err := estValue.Scan(strconv.FormatFloat(*in.EstimatedValue, 'f', -1, 64)); err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid estimated_value")
			return
		}
	}
	var nextFollow pgtype.Timestamptz
	if in.NextFollowUp != nil {
		nextFollow = pgtype.Timestamptz{Time: *in.NextFollowUp, Valid: true}
	}
	var contactID *uuid.UUID
	if in.ContactID != nil {
		if *in.ContactID == "" {
			contactID = nil
		} else if cid, err := uuid.Parse(*in.ContactID); err == nil {
			contactID = &cid
		}
	}

	l, err := m.q.UpdateLead(ctx, db.UpdateLeadParams{
		ID: id, UserID: userID,
		ContactID: contactID, Title: ntxt(in.Title), Status: ntxt(in.Status), Priority: ntxt(in.Priority),
		Source: ntxt(in.Source), EstimatedValue: estValue, Notes: ntxt(in.Notes), NextFollowUp: nextFollow,
	})
	if err != nil {
		slog.Error("update lead", "err", err)
		httpx.Error(w, http.StatusNotFound, "not_found", "Lead not found")
		return
	}

	if in.Status != nil && prev.Status != l.Status {
		_, _ = m.q.CreateActivity(ctx, db.CreateActivityParams{
			UserID: userID, LeadID: &l.ID,
			CompanyID:   &l.CompanyID,
			Type:        "other",
			Description: "Lead moved from " + prev.Status + " to " + l.Status,
		})
	}
	httpx.Data(w, http.StatusOK, toLeadDTO(l, pgtype.Text{}, pgtype.Text{}, nil))
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
	if err := m.q.DeleteLead(r.Context(), db.DeleteLeadParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (m *Module) convert(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	ctx := r.Context()

	l, err := m.q.GetLead(ctx, db.GetLeadParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Lead not found")
		return
	}
	if l.Status != "won" {
		httpx.Error(w, http.StatusBadRequest, "invalid_status", "Only won leads can be converted to clients")
		return
	}

	leadPtr := l.ID
	client, err := m.q.CreateClient(ctx, db.CreateClientParams{
		UserID: userID, CompanyID: l.CompanyID, ContactID: l.ContactID,
		LeadID: &leadPtr, Status: "active",
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	_, _ = m.q.CreateActivity(ctx, db.CreateActivityParams{
		UserID: userID, LeadID: &l.ID,
		CompanyID: &l.CompanyID,
		Type:      "other", Description: "Lead converted to client",
	})

	httpx.Data(w, http.StatusCreated, map[string]any{
		"id":         client.ID.String(),
		"company_id": client.CompanyID.String(),
		"status":     client.Status,
	})
}

func (m *Module) pipeline(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	rows, err := m.q.PipelineByStatus(r.Context(), userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	stages := make([]map[string]any, 0, len(rows))
	for _, s := range rows {
		stages = append(stages, map[string]any{"status": s.Status, "count": s.Count, "value": s.Value})
	}
	httpx.Data(w, http.StatusOK, map[string]any{"stages": stages})
}
