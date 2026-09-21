package projects

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
	"planning": true, "in_progress": true, "review": true, "completed": true, "cancelled": true,
}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/projects", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
	})
}

type projectDTO struct {
	ID            string    `json:"id"`
	ClientID      string    `json:"client_id"`
	Name          string    `json:"name"`
	Description   *string   `json:"description"`
	Status        string    `json:"status"`
	StartDate     *string   `json:"start_date"`
	EndDate       *string   `json:"end_date"`
	Budget        *float64  `json:"budget"`
	ActualRevenue *float64  `json:"actual_revenue"`
	Notes         *string   `json:"notes"`
	ClientCompany *string   `json:"client_company"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
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

func num(t pgtype.Numeric) *float64 {
	f, err := t.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	v := f.Float64
	return &v
}

func datePtr(t pgtype.Date) *string {
	if !t.Valid {
		return nil
	}
	v := t.Time.Format("2006-01-02")
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

type projectInput struct {
	ClientID    *string  `json:"client_id"`
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Status      *string  `json:"status"`
	StartDate   *string  `json:"start_date"`
	EndDate     *string  `json:"end_date"`
	Budget      *float64 `json:"budget"`
	Notes       *string  `json:"notes"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", q.Get("search"))
	ctx := r.Context()
	params := db.ListProjectsParams{UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p))}
	if v := q.Get("status"); v != "" {
		params.Status = pgtype.Text{String: v, Valid: true}
	}
	if v := q.Get("client_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			params.ClientID = &id
		}
	}
	if p.Search != "" {
		params.Search = pgtype.Text{String: p.Search, Valid: true}
	}
	rows, err := m.q.ListProjects(ctx, params)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]projectDTO, 0, len(rows))
	for _, pr := range rows {
		data = append(data, toDTO(db.Project{
			ID: pr.ID, UserID: pr.UserID, ClientID: pr.ClientID, Name: pr.Name,
			Description: pr.Description, Status: pr.Status, StartDate: pr.StartDate,
			EndDate: pr.EndDate, Budget: pr.Budget, ActualRevenue: pr.ActualRevenue,
			Notes: pr.Notes, CreatedAt: pr.CreatedAt, UpdatedAt: pr.UpdatedAt,
		}, pr.ClientCompany))
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: len(data), TotalPages: 1,
	})
}

func toDTO(p db.Project, clientCompany string) projectDTO {
	return projectDTO{
		ID: p.ID.String(), ClientID: p.ClientID.String(), Name: p.Name,
		Description: txt(p.Description), Status: p.Status,
		StartDate: datePtr(p.StartDate), EndDate: datePtr(p.EndDate),
		Budget: num(p.Budget), ActualRevenue: num(p.ActualRevenue), Notes: txt(p.Notes),
		ClientCompany: &clientCompany, CreatedAt: p.CreatedAt.Time, UpdatedAt: p.UpdatedAt.Time,
	}
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in projectInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.ClientID == nil || in.Name == nil || *in.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "client_id and name are required")
		return
	}
	clientID, err := uuid.Parse(*in.ClientID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "client_id must be a valid uuid")
		return
	}
	if _, err := m.q.GetClient(r.Context(), db.GetClientParams{ID: clientID, UserID: userID}); err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "client not found")
		return
	}
	status := "planning"
	if in.Status != nil && validStatuses[*in.Status] {
		status = *in.Status
	}
	var budget pgtype.Numeric
	if in.Budget != nil {
		_ = budget.Scan(strconv.FormatFloat(*in.Budget, 'f', -1, 64))
	}
	var startDate pgtype.Date
	if in.StartDate != nil && *in.StartDate != "" {
		if d, err := time.Parse("2006-01-02", *in.StartDate); err == nil {
			startDate = pgtype.Date{Time: d, Valid: true}
		}
	}
	p, err := m.q.CreateProject(r.Context(), db.CreateProjectParams{
		UserID: userID, ClientID: clientID, Name: *in.Name, Description: ntxt(in.Description),
		Status: status, StartDate: startDate, Budget: budget, Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(p, ""))
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
	p, err := m.q.GetProject(r.Context(), db.GetProjectParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Project not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(db.Project{
		ID: p.ID, UserID: p.UserID, ClientID: p.ClientID, Name: p.Name,
		Description: p.Description, Status: p.Status, StartDate: p.StartDate, EndDate: p.EndDate,
		Budget: p.Budget, ActualRevenue: p.ActualRevenue, Notes: p.Notes,
		CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}, p.ClientCompany))
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
	var in projectInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.Status != nil && !validStatuses[*in.Status] {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
		return
	}
	var budget pgtype.Numeric
	if in.Budget != nil {
		_ = budget.Scan(strconv.FormatFloat(*in.Budget, 'f', -1, 64))
	}
	var startDate, endDate pgtype.Date
	if in.StartDate != nil && *in.StartDate != "" {
		if d, err := time.Parse("2006-01-02", *in.StartDate); err == nil {
			startDate = pgtype.Date{Time: d, Valid: true}
		}
	}
	if in.EndDate != nil && *in.EndDate != "" {
		if d, err := time.Parse("2006-01-02", *in.EndDate); err == nil {
			endDate = pgtype.Date{Time: d, Valid: true}
		}
	}
	var status pgtype.Text
	if in.Status != nil {
		status = pgtype.Text{String: *in.Status, Valid: true}
	}
	p, err := m.q.UpdateProject(r.Context(), db.UpdateProjectParams{
		ID: id, UserID: userID, Name: ntxt(in.Name), Description: ntxt(in.Description),
		Status: status, StartDate: startDate, EndDate: endDate, Budget: budget, Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Project not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(p, ""))
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
	if err := m.q.DeleteProject(r.Context(), db.DeleteProjectParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
