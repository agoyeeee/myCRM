-- name: CreateAIAnalysis :one
INSERT INTO ai_analyses (user_id, lead_id, analysis)
VALUES ($1, $2, $3)
RETURNING *;

-- name: LatestAIAnalysis :one
SELECT * FROM ai_analyses WHERE user_id = $1 AND lead_id = $2 ORDER BY created_at DESC LIMIT 1;

-- name: DashboardKPIs :one
SELECT
  (SELECT COUNT(*) FROM leads l WHERE l.user_id = $1)::int AS total_leads,
  (SELECT COUNT(*) FROM leads l WHERE l.user_id = $1 AND l.created_at >= now() - INTERVAL '7 days')::int AS new_leads,
  (SELECT COUNT(*) FROM follow_ups f WHERE f.user_id = $1 AND status = 'pending' AND due_date = CURRENT_DATE)::int AS followups_today,
  (SELECT COUNT(*) FROM follow_ups f WHERE f.user_id = $1 AND status = 'pending' AND due_date < CURRENT_DATE)::int AS followups_overdue,
  (SELECT COUNT(*) FROM leads l WHERE l.user_id = $1 AND status NOT IN ('won','lost','research'))::int AS active_deals,
  (SELECT COALESCE(SUM(l.estimated_value),0) FROM leads l WHERE l.user_id = $1 AND status NOT IN ('won','lost'))::float8 AS pipeline_value,
  (SELECT COALESCE(SUM(r.amount),0) FROM revenues r WHERE r.user_id = $1 AND occurred_at >= date_trunc('month', CURRENT_DATE))::float8 AS monthly_revenue,
  (SELECT COALESCE(SUM(
      CASE billing_cycle
        WHEN 'monthly' THEN amount
        WHEN 'quarterly' THEN amount / 3
        WHEN 'yearly' THEN amount / 12
        ELSE amount
      END),0)
   FROM recurring_services rs WHERE rs.user_id = $1 AND status = 'active')::float8 AS mrr;
