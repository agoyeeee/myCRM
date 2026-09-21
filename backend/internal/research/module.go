package research

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
	"github.com/agoy/clientos/backend/internal/platform/pagination"
)

var validPriorities = map[string]bool{"low": true, "medium": true, "high": true}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/research", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
		r.Post("/{id}/to-lead", m.toLead)
	})
}

type researchDTO struct {
	ID          string  `json:"id"`
	Industry    *string `json:"industry"`
	Location    *string `json:"location"`
	Keyword     *string `json:"keyword"`
	CompanyName *string `json:"company_name"`
	Website     *string `json:"website"`
	Description *string `json:"description"`
	PainPoint   *string `json:"pain_point"`
	Opportunity *string `json:"opportunity"`
	Service     *string `json:"service"`
	Priority    *string `json:"priority"`
	Notes       *string `json:"notes"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

func txt(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	v := t.String
	return &v
}

func ntxt(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
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

func toDTO(rr db.ResearchRecord) researchDTO {
	return researchDTO{
		ID: rr.ID.String(), Industry: txt(rr.Industry), Location: txt(rr.Location),
		Keyword: txt(rr.Keyword), CompanyName: txt(rr.CompanyName), Website: txt(rr.Website),
		Description: txt(rr.Description), PainPoint: txt(rr.PainPoint), Opportunity: txt(rr.Opportunity),
		Service: txt(rr.Service), Priority: txt(rr.Priority), Notes: txt(rr.Notes),
		CreatedAt: rr.CreatedAt.Time.Format("2006-01-02 15:04"),
		UpdatedAt: rr.UpdatedAt.Time.Format("2006-01-02 15:04"),
	}
}

type researchInput struct {
	Industry    *string `json:"industry"`
	Location    *string `json:"location"`
	Keyword     *string `json:"keyword"`
	CompanyName *string `json:"company_name"`
	Website     *string `json:"website"`
	Description *string `json:"description"`
	PainPoint   *string `json:"pain_point"`
	Opportunity *string `json:"opportunity"`
	Service     *string `json:"service"`
	Priority    *string `json:"priority"`
	Notes       *string `json:"notes"`
}

func (in *researchInput) validate(create bool) error {
	if create && in.CompanyName == nil && in.Keyword == nil {
		return errValidation("company_name or keyword is required")
	}
	if in.Priority != nil && *in.Priority != "" && !validPriorities[*in.Priority] {
		return errValidation("invalid priority")
	}
	return nil
}

type validationError struct{ msg string }

func (e validationError) Error() string { return e.msg }

func errValidation(msg string) error { return validationError{msg} }

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	p := pagination.Parse(r.URL.Query().Get("page"), r.URL.Query().Get("per_page"), "", "", r.URL.Query().Get("search"))
	var search pgtype.Text
	if p.Search != "" {
		search = pgtype.Text{String: p.Search, Valid: true}
	}
	rows, err := m.q.ListResearch(r.Context(), db.ListResearchParams{
		UserID: userID, Search: search, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p)),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]researchDTO, 0, len(rows))
	for _, rr := range rows {
		data = append(data, toDTO(rr))
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: len(data), TotalPages: 1,
	})
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in researchInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if err := in.validate(true); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	rr, err := m.q.CreateResearch(r.Context(), db.CreateResearchParams{
		UserID: userID, Industry: ntxt(in.Industry), Location: ntxt(in.Location),
		Keyword: ntxt(in.Keyword), CompanyName: ntxt(in.CompanyName), Website: ntxt(in.Website),
		Description: ntxt(in.Description), PainPoint: ntxt(in.PainPoint), Opportunity: ntxt(in.Opportunity),
		Service: ntxt(in.Service), Priority: ntxt(in.Priority), Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(rr))
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
	rr, err := m.q.GetResearch(r.Context(), db.GetResearchParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Research record not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(rr))
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
	var in researchInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if err := in.validate(false); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	rr, err := m.q.UpdateResearch(r.Context(), db.UpdateResearchParams{
		ID: id, UserID: userID, Industry: ntxt(in.Industry), Location: ntxt(in.Location),
		Keyword: ntxt(in.Keyword), CompanyName: ntxt(in.CompanyName), Website: ntxt(in.Website),
		Description: ntxt(in.Description), PainPoint: ntxt(in.PainPoint), Opportunity: ntxt(in.Opportunity),
		Service: ntxt(in.Service), Priority: ntxt(in.Priority), Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Research record not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(rr))
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
	if err := m.q.DeleteResearch(r.Context(), db.DeleteResearchParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// toLead converts a research record into company + lead.
func (m *Module) toLead(w http.ResponseWriter, r *http.Request) {
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
	rr, err := m.q.GetResearch(ctx, db.GetResearchParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Research record not found")
		return
	}

	name := "Unnamed company"
	if rr.CompanyName.Valid && rr.CompanyName.String != "" {
		name = rr.CompanyName.String
	}
	company, err := m.q.CreateCompany(ctx, db.CreateCompanyParams{
		UserID: userID, Name: name, Website: rr.Website, Industry: rr.Industry,
		Location: rr.Location, Description: rr.Description, Source: pgtype.Text{String: "web_research", Valid: true},
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	title := "New opportunity"
	if rr.Service.Valid && rr.Service.String != "" {
		title = rr.Service.String
	}
	priority := "medium"
	if rr.Priority.Valid && rr.Priority.String != "" {
		priority = rr.Priority.String
	}
	lead, err := m.q.CreateLead(ctx, db.CreateLeadParams{
		UserID: userID, CompanyID: company.ID, Title: title,
		Status: "research", Priority: priority, Notes: rr.PainPoint,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	_, _ = m.q.CreateActivity(ctx, db.CreateActivityParams{
		UserID: userID, LeadID: &lead.ID, CompanyID: &company.ID, Type: "other",
		Description: "Lead created from research record",
	})
	httpx.Data(w, http.StatusCreated, map[string]any{
		"company_id": company.ID.String(), "lead_id": lead.ID.String(),
	})
}
