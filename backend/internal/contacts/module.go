package contacts

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

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/contacts", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
	})
}

type contactDTO struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"company_id"`
	Name      string    `json:"name"`
	JobTitle  *string   `json:"job_title"`
	Email     *string   `json:"email"`
	Phone     *string   `json:"phone"`
	Whatsapp  *string   `json:"whatsapp"`
	Linkedin  *string   `json:"linkedin"`
	Notes     *string   `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func toDTO(c db.Contact) contactDTO {
	return contactDTO{
		ID: c.ID.String(), CompanyID: c.CompanyID.String(), Name: c.Name,
		JobTitle: txt(c.JobTitle), Email: txt(c.Email), Phone: txt(c.Phone),
		Whatsapp: txt(c.Whatsapp), Linkedin: txt(c.Linkedin), Notes: txt(c.Notes),
		CreatedAt: c.CreatedAt.Time, UpdatedAt: c.UpdatedAt.Time,
	}
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

type contactInput struct {
	CompanyID *string `json:"company_id"`
	Name      *string `json:"name"`
	JobTitle  *string `json:"job_title"`
	Email     *string `json:"email"`
	Phone     *string `json:"phone"`
	WhatsApp  *string `json:"whatsapp"`
	LinkedIn  *string `json:"linkedin"`
	Notes     *string `json:"notes"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", q.Get("search"))

	var (
		rows []db.Contact
		err  error
	)
	ctx := r.Context()
	if companyID := q.Get("company_id"); companyID != "" {
		cid, err := uuid.Parse(companyID)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid company_id")
			return
		}
		rows, err = m.q.ListContactsByCompany(ctx, db.ListContactsByCompanyParams{UserID: userID, CompanyID: cid})
	} else {
		rows, err = m.q.ListContacts(ctx, db.ListContactsParams{UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p))})
	}
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]contactDTO, 0, len(rows))
	for _, c := range rows {
		data = append(data, toDTO(c))
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
	var in contactInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.CompanyID == nil || in.Name == nil || *in.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "company_id and name are required")
		return
	}
	cid, err := uuid.Parse(*in.CompanyID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "company_id must be a valid uuid")
		return
	}
	c, err := m.q.CreateContact(r.Context(), db.CreateContactParams{
		UserID: userID, CompanyID: cid, Name: *in.Name,
		JobTitle: ntxt(in.JobTitle), Email: ntxt(in.Email), Phone: ntxt(in.Phone),
		Whatsapp: ntxt(in.WhatsApp), Linkedin: ntxt(in.LinkedIn), Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(c))
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
	c, err := m.q.GetContact(r.Context(), db.GetContactParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Contact not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(c))
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
	var in contactInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	c, err := m.q.UpdateContact(r.Context(), db.UpdateContactParams{
		ID: id, UserID: userID,
		Name: ntxt(in.Name), JobTitle: ntxt(in.JobTitle), Email: ntxt(in.Email),
		Phone: ntxt(in.Phone), Whatsapp: ntxt(in.WhatsApp), Linkedin: ntxt(in.LinkedIn), Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Contact not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(c))
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
	if err := m.q.DeleteContact(r.Context(), db.DeleteContactParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
