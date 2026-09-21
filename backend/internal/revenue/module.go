package revenue

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

var validTypes = map[string]bool{"project": true, "recurring": true, "one_time": true}

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/revenue", func(r chi.Router) {
		r.Get("/", m.list)
		r.Post("/", m.create)
		r.Delete("/{id}", m.remove)
		r.Get("/summary", m.summary)
	})
}

type revenueDTO struct {
	ID                 string    `json:"id"`
	ClientID           *string   `json:"client_id"`
	ProjectID          *string   `json:"project_id"`
	RecurringServiceID *string   `json:"recurring_service_id"`
	Amount             float64   `json:"amount"`
	Type               string    `json:"type"`
	OccurredAt         string    `json:"occurred_at"`
	Notes              *string   `json:"notes"`
	CreatedAt          time.Time `json:"created_at"`
}

func txt(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	v := t.String
	return &v
}

func num(t pgtype.Numeric) float64 {
	f, err := t.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
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

type revenueInput struct {
	ClientID           *string  `json:"client_id"`
	ProjectID          *string  `json:"project_id"`
	RecurringServiceID *string  `json:"recurring_service_id"`
	Amount             *float64 `json:"amount"`
	Type               string   `json:"type"`
	OccurredAt         *string  `json:"occurred_at"`
	Notes              *string  `json:"notes"`
}

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	p := pagination.Parse(q.Get("page"), q.Get("per_page"), "", "", "")
	ctx := r.Context()
	params := db.ListRevenuesParams{UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p))}
	if v := q.Get("type"); v != "" {
		params.Type = pgtype.Text{String: v, Valid: true}
	}
	if v := q.Get("client_id"); v != "" && v != "none" {
		if id, err := uuid.Parse(v); err == nil {
			params.ClientID = &id
		}
	}
	if v := q.Get("from"); v != "" {
		if d, err := time.Parse("2006-01-02", v); err == nil {
			params.From = pgtype.Date{Time: d, Valid: true}
		}
	}
	if v := q.Get("to"); v != "" {
		if d, err := time.Parse("2006-01-02", v); err == nil {
			params.To = pgtype.Date{Time: d, Valid: true}
		}
	}
	total, err := m.q.CountRevenues(ctx, db.CountRevenuesParams{
		UserID: userID, Type: params.Type, ClientID: params.ClientID, From: params.From, To: params.To,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	rows, err := m.q.ListRevenues(ctx, params)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]revenueDTO, 0, len(rows))
	for _, rv := range rows {
		data = append(data, toDTO(rv))
	}

	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: int(total), TotalPages: pagination.TotalPages(int(total), p.PerPage),
	})
}

func toDTO(rv db.Revenue) revenueDTO {
	dto := revenueDTO{
		ID: rv.ID.String(), Amount: num(rv.Amount), Type: rv.Type,
		OccurredAt: rv.OccurredAt.Time.Format("2006-01-02"),
		Notes:      txt(rv.Notes), CreatedAt: rv.CreatedAt.Time,
	}
	if rv.ClientID != nil {
		s := rv.ClientID.String()
		dto.ClientID = &s
	}
	if rv.ProjectID != nil {
		s := rv.ProjectID.String()
		dto.ProjectID = &s
	}
	if rv.RecurringServiceID != nil {
		s := rv.RecurringServiceID.String()
		dto.RecurringServiceID = &s
	}
	return dto
}

func (m *Module) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var in revenueInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.Amount == nil || *in.Amount < 0 {
		httpx.Error(w, http.StatusBadRequest, "validation", "amount must be >= 0")
		return
	}
	if !validTypes[in.Type] {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid type")
		return
	}
	occurredAt := time.Now()
	if in.OccurredAt != nil && *in.OccurredAt != "" {
		if d, err := time.Parse("2006-01-02", *in.OccurredAt); err == nil {
			occurredAt = d
		} else {
			httpx.Error(w, http.StatusBadRequest, "validation", "occurred_at must be YYYY-MM-DD")
			return
		}
	}
	amount := pgtype.Numeric{}
	_ = amount.Scan(strconv.FormatFloat(*in.Amount, 'f', -1, 64))

	var clientID, projectID, serviceID *uuid.UUID
	if in.ClientID != nil && *in.ClientID != "" && *in.ClientID != "none" {
		if id, err := uuid.Parse(*in.ClientID); err == nil {
			clientID = &id
		}
	}
	if in.ProjectID != nil && *in.ProjectID != "" {
		if id, err := uuid.Parse(*in.ProjectID); err == nil {
			projectID = &id
		}
	}
	if in.RecurringServiceID != nil && *in.RecurringServiceID != "" {
		if id, err := uuid.Parse(*in.RecurringServiceID); err == nil {
			serviceID = &id
		}
	}

	rv, err := m.q.CreateRevenue(r.Context(), db.CreateRevenueParams{
		UserID: userID, ClientID: clientID, ProjectID: projectID, RecurringServiceID: serviceID,
		Amount: amount, Type: in.Type, OccurredAt: pgtype.Date{Time: occurredAt, Valid: true},
		Notes: txt2(in.Notes),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusCreated, toDTO(rv))
}

func txt2(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

// summaryData computes dashboard summary metrics from generated queries.
func (m *Module) summaryData(ctx interface {
	Done() <-chan struct{}
	Err() error
	Value(any) any
	Deadline() (deadline interface{ String() string }, ok bool)
}, userID uuid.UUID) map[string]float64 {
	// placeholder: replaced by summary handler below
	return nil
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
	if err := m.q.DeleteRevenue(r.Context(), db.DeleteRevenueParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func toMonthly(rows []db.RevenueMonthlyRow) []map[string]any {
	out := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		out = append(out, map[string]any{"month": r.Month, "total": r.Total})
	}
	return out
}

func toMonthlyMRR(rows []db.RevenueMonthlyMRRRow) []map[string]any {
	out := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		out = append(out, map[string]any{"month": r.Month, "total": r.Total})
	}
	return out
}

func (m *Module) summary(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	monthly, err := m.q.RevenueMonthly(ctx, userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	mrrRows, err := m.q.RevenueMonthlyMRR(ctx, userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	recurring, err := m.q.ActiveRecurringForMRR(ctx, userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	var mrr float64
	for _, s := range recurring {
		switch s.BillingCycle {
		case "monthly":
			mrr += num(s.Amount)
		case "quarterly":
			mrr += num(s.Amount) / 3
		case "yearly":
			mrr += num(s.Amount) / 12
		default:
			mrr += num(s.Amount)
		}
	}
	var thisMonth, thisYear, total float64
	now := time.Now()
	for _, row := range monthly {
		t, err := time.Parse("2006-01-02", row.Month)
		if err != nil {
			continue
		}
		total += row.Total
		if t.Year() == now.Year() && t.Month() == now.Month() {
			thisMonth = row.Total
		}
		if t.Year() == now.Year() {
			thisYear += row.Total
		}
	}
	httpx.Data(w, http.StatusOK, map[string]any{
		"summary": map[string]any{
			"total": total, "this_month": thisMonth, "this_year": thisYear, "mrr": mrr,
		},
		"monthly_history": toMonthly(monthly),
		"mrr_history":     toMonthlyMRR(mrrRows),
	})
}
