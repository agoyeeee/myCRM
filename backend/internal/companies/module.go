package companies

import (
	"errors"
	"log/slog"
	"net/http"

	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
	"github.com/agoy/clientos/backend/internal/platform/pagination"
)

type Module struct {
	q      *db.Queries
	pool   *pgxpool.Pool
	router chi.Router
}

func New(q *db.Queries, pool *pgxpool.Pool) *Module {
	return &Module{q: q, pool: pool}
}

func (m *Module) Mount(r chi.Router) {
	r.Route("/companies", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
	})
}

type companyDTO struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Website     *string   `json:"website"`
	Industry    *string   `json:"industry"`
	Location    *string   `json:"location"`
	Description *string   `json:"description"`
	Phone       *string   `json:"phone"`
	Email       *string   `json:"email"`
	Notes       *string   `json:"notes"`
	Source      *string   `json:"source"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func toCompanyDTO(c db.Company) companyDTO {
	return companyDTO{
		ID: c.ID.String(), Name: c.Name,
		Website: textPtr(c.Website), Industry: textPtr(c.Industry), Location: textPtr(c.Location),
		Description: textPtr(c.Description), Phone: textPtr(c.Phone), Email: textPtr(c.Email),
		Notes: textPtr(c.Notes), Source: textPtr(c.Source),
		CreatedAt: c.CreatedAt.Time, UpdatedAt: c.UpdatedAt.Time,
	}
}

func textPtr(t pgtype.Text) *string {
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
	p := pagination.Parse(
		r.URL.Query().Get("page"), r.URL.Query().Get("per_page"),
		r.URL.Query().Get("sort"), r.URL.Query().Get("order"), r.URL.Query().Get("search"),
	)
	ctx := r.Context()

	var search pgtype.Text
	if p.Search != "" {
		search = pgtype.Text{String: p.Search, Valid: true}
	}
	total, err := m.q.CountCompanies(ctx, db.CountCompaniesParams{UserID: userID, Search: search})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	rows, err := m.q.ListCompanies(ctx, db.ListCompaniesParams{
		UserID: userID, Search: search,
		Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p)),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]companyDTO, 0, len(rows))
	for _, c := range rows {
		data = append(data, toCompanyDTO(c))
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: int(total), TotalPages: pagination.TotalPages(int(total), p.PerPage),
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
	c, err := m.q.GetCompany(r.Context(), db.GetCompanyParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Company not found")
		return
	}
	httpx.Data(w, http.StatusOK, toCompanyDTO(c))
}

type companyInput struct {
	Name        *string `json:"name"`
	Website     *string `json:"website"`
	Industry    *string `json:"industry"`
	Location    *string `json:"location"`
	Description *string `json:"description"`
	Phone       *string `json:"phone"`
	Email       *string `json:"email"`
	Notes       *string `json:"notes"`
	Source      *string `json:"source"`
}

func (in *companyInput) validate(create bool) error {
	if create && (in.Name == nil || *in.Name == "") {
		return errors.New("name is required")
	}
	if in.Name != nil && len(*in.Name) > 300 {
		return errors.New("name too long")
	}
	return nil
}

func nullableStr(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in companyInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if err := in.validate(true); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	c, err := m.q.CreateCompany(r.Context(), db.CreateCompanyParams{
		UserID: userID, Name: *in.Name,
		Website: nullableStr(in.Website), Industry: nullableStr(in.Industry), Location: nullableStr(in.Location),
		Description: nullableStr(in.Description), Phone: nullableStr(in.Phone), Email: nullableStr(in.Email),
		Notes: nullableStr(in.Notes), Source: nullableStr(in.Source),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toCompanyDTO(c))
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
	var in companyInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if err := in.validate(false); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	c, err := m.q.UpdateCompany(r.Context(), db.UpdateCompanyParams{
		ID: id, UserID: userID,
		Name: nullableStr(in.Name), Website: nullableStr(in.Website), Industry: nullableStr(in.Industry),
		Location: nullableStr(in.Location), Description: nullableStr(in.Description),
		Phone: nullableStr(in.Phone), Email: nullableStr(in.Email), Notes: nullableStr(in.Notes),
	})
	if err != nil {
		slog.Error("update company", "err", err)
		httpx.Error(w, http.StatusNotFound, "not_found", "Company not found")
		return
	}
	httpx.Data(w, http.StatusOK, toCompanyDTO(c))
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
	if _, err := m.q.GetCompany(r.Context(), db.GetCompanyParams{ID: id, UserID: userID}); err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Company not found")
		return
	}
	if err := m.q.DeleteCompany(r.Context(), db.DeleteCompanyParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
