package dashboard

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
)

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Get("/dashboard", m.dashboard)
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

func (m *Module) dashboard(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	kpi, err := m.q.DashboardKPIs(ctx, userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	pipelineRows, err := m.q.PipelineByStatus(ctx, userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	activities, err := m.q.RecentActivities(ctx, db.RecentActivitiesParams{UserID: userID, Limit: 10})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	tasks, err := m.q.FollowUpsToday(ctx, userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	pipeline := make([]map[string]any, 0, len(pipelineRows))
	for _, s := range pipelineRows {
		pipeline = append(pipeline, map[string]any{"status": s.Status, "count": s.Count, "value": s.Value})
	}

	recent := make([]map[string]any, 0, len(activities))
	for _, a := range activities {
		company := any(nil)
		if a.CompanyName.Valid {
			company = a.CompanyName.String
		}
		lead := any(nil)
		if a.LeadID != nil {
			lead = a.LeadID.String()
		}
		recent = append(recent, map[string]any{
			"id": a.ID.String(), "type": a.Type, "description": a.Description,
			"created_at": a.CreatedAt.Time, "lead_id": lead, "company_name": company,
		})
	}

	todayTasks := make([]map[string]any, 0, len(tasks))
	for _, t := range tasks {
		kind := "followup"
		if isOverdue(t.DueDate) {
			kind = "overdue"
		}
		title := "Follow-up"
		if t.LeadTitle != "" {
			title = t.LeadTitle
		}
		if t.CompanyName != "" {
			title = t.CompanyName + " — " + title
		}
		todayTasks = append(todayTasks, map[string]any{
			"id": t.ID.String(), "kind": kind, "title": title, "href": "/follow-ups",
		})
	}

	httpx.Data(w, http.StatusOK, map[string]any{
		"kpi": map[string]any{
			"total_leads":       kpi.TotalLeads,
			"new_leads":         kpi.NewLeads,
			"followups_today":   kpi.FollowupsToday,
			"followups_overdue": kpi.FollowupsOverdue,
			"active_deals":      kpi.ActiveDeals,
			"pipeline_value":    kpi.PipelineValue,
			"monthly_revenue":   kpi.MonthlyRevenue,
			"mrr":               kpi.Mrr,
		},
		"pipeline":        pipeline,
		"today_tasks":     todayTasks,
		"recent_activity": recent,
	})
}

func isOverdue(d pgtype.Date) bool {
	return d.Time.Before(time.Now().Truncate(24 * time.Hour))
}
