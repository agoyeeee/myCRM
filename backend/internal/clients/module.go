package clients

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

var validStatuses = map[string]bool{"active": true, "inactive": true, "archived": true}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/clients", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
	})
}

type clientDTO struct {
	ID          string     `json:"id"`
	CompanyID   string     `json:"company_id"`
	ContactID   *string    `json:"contact_id"`
	LeadID      *string    `json:"lead_id"`
	Status      string     `json:"status"`
	Notes       *string    `json:"notes"`
	ConvertedAt *time.Time `json:"converted_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	Company     *struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"company"`
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

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", q.Get("search"))
	ctx := r.Context()
	params := db.ListClientsParams{UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p))}
	if v := q.Get("status"); v != "" {
		params.Status = pgtype.Text{String: v, Valid: true}
	}
	if p.Search != "" {
		params.Search = pgtype.Text{String: p.Search, Valid: true}
	}
	rows, err := m.q.ListClients(ctx, params)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]clientDTO, 0, len(rows))
	for _, c := range rows {
		dto := clientDTO{
			ID: c.ID.String(), CompanyID: c.CompanyID.String(), Status: c.Status,
			Notes: txt(c.Notes), CreatedAt: c.CreatedAt.Time, UpdatedAt: c.UpdatedAt.Time,
		}
		if c.ContactID != nil {
			s := c.ContactID.String()
			dto.ContactID = &s
		}
		if c.LeadID != nil {
			s := c.LeadID.String()
			dto.LeadID = &s
		}
		if c.ConvertedAt.Valid {
			t := c.ConvertedAt.Time
			dto.ConvertedAt = &t
		}
		dto.Company = &struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}{ID: c.CompanyID.String(), Name: c.CompanyName}
		data = append(data, dto)
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: len(data), TotalPages: 1,
	})
}

type clientInput struct {
	CompanyID *string `json:"company_id"`
	ContactID *string `json:"contact_id"`
	Status    *string `json:"status"`
	Notes     *string `json:"notes"`
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in clientInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.CompanyID == nil || *in.CompanyID == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "company_id is required")
		return
	}
	companyID, err := uuid.Parse(*in.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "company_id must be a valid uuid")
		return
	}
	status := "active"
	if in.Status != nil && validStatuses[*in.Status] {
		status = *in.Status
	}
	var contactID *uuid.UUID
	if in.ContactID != nil && *in.ContactID != "" {
		cid, err := uuid.Parse(*in.ContactID)
		if err == nil {
			contactID = &cid
		}
	}
	c, err := m.q.CreateClient(r.Context(), db.CreateClientParams{
		UserID: userID, CompanyID: companyID, ContactID: contactID, Status: status, Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, map[string]any{
		"id": c.ID.String(), "company_id": c.CompanyID.String(), "status": c.Status,
	})
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
	c, err := m.q.GetClient(r.Context(), db.GetClientParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Client not found")
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{
		"id": c.ID.String(), "company_id": c.CompanyID.String(), "company_name": c.CompanyName,
		"status": c.Status, "converted_at": c.ConvertedAt.Time, "notes": txt(c.Notes),
	})
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
	var in clientInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.Status != nil && !validStatuses[*in.Status] {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
		return
	}
	var status pgtype.Text
	if in.Status != nil {
		status = pgtype.Text{String: *in.Status, Valid: true}
	}
	c, err := m.q.UpdateClient(r.Context(), db.UpdateClientParams{ID: id, UserID: userID, Status: status, Notes: ntxt(in.Notes)})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Client not found")
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{
		"id": c.ID.String(), "company_id": c.CompanyID.String(), "status": c.Status,
	})
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
	if err := m.q.DeleteClient(r.Context(), db.DeleteClientParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
