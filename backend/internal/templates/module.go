package templates

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

var validCategories = map[string]bool{
	"initial_contact": true, "follow_up_1": true, "follow_up_2": true,
	"after_meeting": true, "proposal": true, "lost_lead": true, "maintenance_offer": true,
}
var validChannels = map[string]bool{"email": true, "whatsapp": true, "linkedin": true, "phone": true}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/outreach-templates", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
		r.Post("/{id}/duplicate", m.duplicate)
	})
}

type templateDTO struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Category  string `json:"category"`
	Channel   string `json:"channel"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
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

func toDTO(t db.OutreachTemplate) templateDTO {
	return templateDTO{
		ID: t.ID.String(), Name: t.Name, Category: t.Category, Channel: t.Channel, Body: t.Body,
		CreatedAt: t.CreatedAt.Time.Format("2006-01-02"), UpdatedAt: t.UpdatedAt.Time.Format("2006-01-02"),
	}
}

type templateInput struct {
	Name     *string `json:"name"`
	Category *string `json:"category"`
	Channel  *string `json:"channel"`
	Body     *string `json:"body"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	p := pagination.Parse(r.URL.Query().Get("page"), r.URL.Query().Get("per_page"), "", "", "")
	var category pgtype.Text
	if v := r.URL.Query().Get("category"); v != "" {
		category = pgtype.Text{String: v, Valid: true}
	}
	rows, err := m.q.ListTemplates(r.Context(), db.ListTemplatesParams{
		UserID: userID, Category: category, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p)),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]templateDTO, 0, len(rows))
	for _, t := range rows {
		data = append(data, toDTO(t))
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
	var in templateInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.Name == nil || in.Body == nil || *in.Name == "" || *in.Body == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "name and body are required")
		return
	}
	category := "initial_contact"
	if in.Category != nil && validCategories[*in.Category] {
		category = *in.Category
	}
	channel := "email"
	if in.Channel != nil && validChannels[*in.Channel] {
		channel = *in.Channel
	}
	t, err := m.q.CreateTemplate(r.Context(), db.CreateTemplateParams{
		UserID: userID, Name: *in.Name, Category: category, Channel: channel, Body: *in.Body,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(t))
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
	t, err := m.q.GetTemplate(r.Context(), db.GetTemplateParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Template not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(t))
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
	var in templateInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	var category, channel pgtype.Text
	if in.Category != nil {
		if !validCategories[*in.Category] {
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid category")
			return
		}
		category = pgtype.Text{String: *in.Category, Valid: true}
	}
	if in.Channel != nil {
		if !validChannels[*in.Channel] {
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid channel")
			return
		}
		channel = pgtype.Text{String: *in.Channel, Valid: true}
	}
	t, err := m.q.UpdateTemplate(r.Context(), db.UpdateTemplateParams{
		ID: id, UserID: userID, Name: ntxt(in.Name), Category: category, Channel: channel, Body: ntxt(in.Body),
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Template not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(t))
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
	if err := m.q.DeleteTemplate(r.Context(), db.DeleteTemplateParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (m *Module) duplicate(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	src, err := m.q.GetTemplate(r.Context(), db.GetTemplateParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Template not found")
		return
	}
	t, err := m.q.CreateTemplate(r.Context(), db.CreateTemplateParams{
		UserID: userID, Name: src.Name + " (copy)", Category: src.Category, Channel: src.Channel, Body: src.Body,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(t))
}
