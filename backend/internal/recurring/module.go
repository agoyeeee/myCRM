package recurring

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

var validStatuses = map[string]bool{"active": true, "paused": true, "cancelled": true}
var validCycles = map[string]bool{"monthly": true, "quarterly": true, "yearly": true, "custom": true}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/recurring-services", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Get("/{id}", m.get)
		r.Patch("/{id}", m.update)
		r.Delete("/{id}", m.remove)
	})
}

type recurringDTO struct {
	ID              string    `json:"id"`
	ClientID        string    `json:"client_id"`
	ProjectID       *string   `json:"project_id"`
	Name            string    `json:"name"`
	Amount          float64   `json:"amount"`
	BillingCycle    string    `json:"billing_cycle"`
	StartDate       *string   `json:"start_date"`
	NextBillingDate *string   `json:"next_billing_date"`
	Status          string    `json:"status"`
	Notes           *string   `json:"notes"`
	ClientCompany   *string   `json:"client_company"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
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

func num(t pgtype.Numeric) float64 {
	f, err := t.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
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

type recurringInput struct {
	ClientID        *string  `json:"client_id"`
	ProjectID       *string  `json:"project_id"`
	Name            *string  `json:"name"`
	Amount          *float64 `json:"amount"`
	BillingCycle    *string  `json:"billing_cycle"`
	StartDate       *string  `json:"start_date"`
	NextBillingDate *string  `json:"next_billing_date"`
	Status          *string  `json:"status"`
	Notes           *string  `json:"notes"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", "")
	ctx := r.Context()
	params := db.ListRecurringServicesParams{UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p))}
	if v := q.Get("status"); v != "" {
		params.Status = pgtype.Text{String: v, Valid: true}
	}
	if v := q.Get("client_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			params.ClientID = &id
		}
	}
	rows, err := m.q.ListRecurringServices(ctx, params)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]recurringDTO, 0, len(rows))
	for _, s := range rows {
		data = append(data, toDTO(db.RecurringService{
			ID: s.ID, UserID: s.UserID, ClientID: s.ClientID, ProjectID: s.ProjectID,
			Name: s.Name, Amount: s.Amount, BillingCycle: s.BillingCycle,
			StartDate: s.StartDate, NextBillingDate: s.NextBillingDate,
			Status: s.Status, Notes: s.Notes, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
		}, s.ClientCompany))
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: len(data), TotalPages: 1,
	})
}

func toDTO(s db.RecurringService, clientCompany string) recurringDTO {
	dto := recurringDTO{
		ID: s.ID.String(), ClientID: s.ClientID.String(), Name: s.Name,
		Amount: num(s.Amount), BillingCycle: s.BillingCycle,
		StartDate: datePtr(s.StartDate), NextBillingDate: datePtr(s.NextBillingDate),
		Status: s.Status, Notes: txt(s.Notes), CreatedAt: s.CreatedAt.Time, UpdatedAt: s.UpdatedAt.Time,
	}
	if s.ProjectID != nil {
		p := s.ProjectID.String()
		dto.ProjectID = &p
	}
	if clientCompany != "" {
		dto.ClientCompany = &clientCompany
	}
	return dto
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in recurringInput
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
	cycle := "monthly"
	if in.BillingCycle != nil && validCycles[*in.BillingCycle] {
		cycle = *in.BillingCycle
	}
	status := "active"
	if in.Status != nil && validStatuses[*in.Status] {
		status = *in.Status
	}
	amount := pgtype.Numeric{}
	if in.Amount != nil {
		_ = amount.Scan(strconv.FormatFloat(*in.Amount, 'f', -1, 64))
	}
	var startDate, nextBilling pgtype.Date
	if in.StartDate != nil && *in.StartDate != "" {
		if d, err := time.Parse("2006-01-02", *in.StartDate); err == nil {
			startDate = pgtype.Date{Time: d, Valid: true}
		}
	}
	if in.NextBillingDate != nil && *in.NextBillingDate != "" {
		if d, err := time.Parse("2006-01-02", *in.NextBillingDate); err == nil {
			nextBilling = pgtype.Date{Time: d, Valid: true}
		}
	}
	var projectID *uuid.UUID
	if in.ProjectID != nil && *in.ProjectID != "" {
		pid, err := uuid.Parse(*in.ProjectID)
		if err == nil {
			projectID = &pid
		}
	}
	s, err := m.q.CreateRecurringService(r.Context(), db.CreateRecurringServiceParams{
		UserID: userID, ClientID: clientID, ProjectID: projectID, Name: *in.Name,
		Amount: amount, BillingCycle: cycle, StartDate: startDate, NextBillingDate: nextBilling,
		Status: status, Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(s, ""))
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
	s, err := m.q.GetRecurringService(r.Context(), db.GetRecurringServiceParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Recurring service not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(db.RecurringService{
		ID: s.ID, UserID: s.UserID, ClientID: s.ClientID, ProjectID: s.ProjectID,
		Name: s.Name, Amount: s.Amount, BillingCycle: s.BillingCycle,
		StartDate: s.StartDate, NextBillingDate: s.NextBillingDate,
		Status: s.Status, Notes: s.Notes, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
	}, s.ClientCompany))
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
	var in recurringInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.Status != nil && !validStatuses[*in.Status] {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
		return
	}
	if in.BillingCycle != nil && !validCycles[*in.BillingCycle] {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid billing_cycle")
		return
	}
	amount := pgtype.Numeric{}
	if in.Amount != nil {
		_ = amount.Scan(strconv.FormatFloat(*in.Amount, 'f', -1, 64))
	}
	var startDate, nextBilling pgtype.Date
	if in.StartDate != nil && *in.StartDate != "" {
		if d, err := time.Parse("2006-01-02", *in.StartDate); err == nil {
			startDate = pgtype.Date{Time: d, Valid: true}
		}
	}
	if in.NextBillingDate != nil && *in.NextBillingDate != "" {
		if d, err := time.Parse("2006-01-02", *in.NextBillingDate); err == nil {
			nextBilling = pgtype.Date{Time: d, Valid: true}
		}
	}
	var status, cycle pgtype.Text
	if in.Status != nil {
		status = pgtype.Text{String: *in.Status, Valid: true}
	}
	if in.BillingCycle != nil {
		cycle = pgtype.Text{String: *in.BillingCycle, Valid: true}
	}
	s, err := m.q.UpdateRecurringService(r.Context(), db.UpdateRecurringServiceParams{
		ID: id, UserID: userID, Name: ntxt(in.Name), Amount: amount, BillingCycle: cycle,
		StartDate: startDate, NextBillingDate: nextBilling, Status: status, Notes: ntxt(in.Notes),
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Recurring service not found")
		return
	}
	httpx.Data(w, http.StatusOK, toDTO(s, ""))
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
	if err := m.q.DeleteRecurringService(r.Context(), db.DeleteRecurringServiceParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
