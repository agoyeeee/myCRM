package activities

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

var validTypes = map[string]bool{
	"note": true, "email": true, "whatsapp": true, "phone": true,
	"meeting": true, "proposal": true, "follow_up": true, "other": true,
}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/activities", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Delete("/{id}", m.remove)
	})
}

type activityDTO struct {
	ID          string    `json:"id"`
	LeadID      *string   `json:"lead_id"`
	CompanyID   *string   `json:"company_id"`
	ContactID   *string   `json:"contact_id"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	CompanyName *string   `json:"company_name"`
	CreatedAt   time.Time `json:"created_at"`
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
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Invalid session")
		return uuid.Nil, false
	}
	return id, true
}

func toDTO(a db.LeadActivity, companyName pgtype.Text) activityDTO {
	dto := activityDTO{
		ID: a.ID.String(), Type: a.Type, Description: a.Description,
		CompanyName: txt(companyName), CreatedAt: a.CreatedAt.Time,
	}
	if a.LeadID != nil {
		s := a.LeadID.String()
		dto.LeadID = &s
	}
	if a.CompanyID != nil {
		s := a.CompanyID.String()
		dto.CompanyID = &s
	}
	if a.ContactID != nil {
		s := a.ContactID.String()
		dto.ContactID = &s
	}
	return dto
}

type activityInput struct {
	LeadID      *string `json:"lead_id"`
	CompanyID   *string `json:"company_id"`
	ContactID   *string `json:"contact_id"`
	Type        string  `json:"type"`
	Description string  `json:"description"`
}

func (in *activityInput) validate() error {
	if in.Description == "" {
		return errValidation("description is required")
	}
	if len(in.Description) > 5000 {
		return errValidation("description too long")
	}
	if !validTypes[in.Type] {
		return errValidation("invalid type")
	}
	if in.LeadID == nil && in.CompanyID == nil {
		return errValidation("lead_id or company_id is required")
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
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", q.Get("search"))
	ctx := r.Context()

	params := db.ListActivitiesParams{
		UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p)),
	}
	if v := q.Get("type"); v != "" {
		params.Type = pgtype.Text{String: v, Valid: true}
	}
	if v := q.Get("lead_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			params.LeadID = &id
		}
	}
	if v := q.Get("company_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			params.CompanyID = &id
		}
	}
	if p.Search != "" {
		params.Search = pgtype.Text{String: p.Search, Valid: true}
	}

	total, err := m.q.CountActivities(ctx, db.CountActivitiesParams{
		UserID: userID, LeadID: params.LeadID, CompanyID: params.CompanyID, Type: params.Type,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	rows, err := m.q.ListActivities(ctx, params)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]activityDTO, 0, len(rows))
	for _, a := range rows {
		data = append(data, toDTO(db.LeadActivity{
			ID: a.ID, LeadID: a.LeadID, CompanyID: a.CompanyID, ContactID: a.ContactID,
			Type: a.Type, Description: a.Description, CreatedAt: a.CreatedAt,
		}, a.CompanyName))
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
	var in activityInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if err := in.validate(); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	ctx := r.Context()

	var leadID, companyID, contactID *uuid.UUID
	if in.LeadID != nil && *in.LeadID != "" {
		id, err := uuid.Parse(*in.LeadID)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "lead_id must be a valid uuid")
			return
		}
		l, err := m.q.GetLead(ctx, db.GetLeadParams{ID: id, UserID: userID})
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "lead not found")
			return
		}
		leadID = &id
		if companyID == nil {
			companyID = &l.CompanyID
		}
	}
	if in.CompanyID != nil && *in.CompanyID != "" {
		id, err := uuid.Parse(*in.CompanyID)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "company_id must be a valid uuid")
			return
		}
		companyID = &id
	}
	if in.ContactID != nil && *in.ContactID != "" {
		id, err := uuid.Parse(*in.ContactID)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "contact_id must be a valid uuid")
			return
		}
		contactID = &id
	}

	a, err := m.q.CreateActivity(ctx, db.CreateActivityParams{
		UserID: userID, LeadID: leadID, CompanyID: companyID, ContactID: contactID,
		Type: in.Type, Description: in.Description,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	var companyName pgtype.Text
	if companyID != nil {
		if c, err := m.q.GetCompany(ctx, db.GetCompanyParams{ID: *companyID, UserID: userID}); err == nil {
			companyName = pgtype.Text{String: c.Name, Valid: true}
		}
	}
	httpx.Data(w, http.StatusCreated, toDTO(a, companyName))
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
	if err := m.q.DeleteActivity(r.Context(), db.DeleteActivityParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
