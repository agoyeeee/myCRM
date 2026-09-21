-- name: CreateRevenue :one
INSERT INTO revenues (user_id, client_id, project_id, recurring_service_id, amount, type, occurred_at, notes)
VALUES ($1, sqlc.narg('client_id'), sqlc.narg('project_id'), sqlc.narg('recurring_service_id'), $2, $3, $4, sqlc.narg('notes'))
RETURNING *;

-- name: GetRevenue :one
SELECT * FROM revenues WHERE id = $1 AND user_id = $2;

-- name: ListRevenues :many
SELECT * FROM revenues
WHERE user_id = $1
  AND (sqlc.narg('type')::text IS NULL OR type = sqlc.narg('type'))
  AND (sqlc.narg('client_id')::uuid IS NULL OR client_id = sqlc.narg('client_id'))
  AND (sqlc.narg('from')::date IS NULL OR occurred_at >= sqlc.narg('from'))
  AND (sqlc.narg('to')::date IS NULL OR occurred_at <= sqlc.narg('to'))
ORDER BY occurred_at DESC, created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountRevenues :one
SELECT COUNT(*) FROM revenues
WHERE user_id = $1
  AND (sqlc.narg('type')::text IS NULL OR type = sqlc.narg('type'))
  AND (sqlc.narg('client_id')::uuid IS NULL OR client_id = sqlc.narg('client_id'))
  AND (sqlc.narg('from')::date IS NULL OR occurred_at >= sqlc.narg('from'))
  AND (sqlc.narg('to')::date IS NULL OR occurred_at <= sqlc.narg('to'));

-- name: DeleteRevenue :exec
DELETE FROM revenues WHERE id = $1 AND user_id = $2;

-- name: RevenueMonthly :many
SELECT date_trunc('month', occurred_at)::date::text AS month, COALESCE(SUM(amount),0)::float8 AS total
FROM revenues WHERE user_id = $1 GROUP BY 1 ORDER BY 1 DESC LIMIT 24;

-- name: RevenueMonthlyMRR :many
SELECT date_trunc('month', occurred_at)::date::text AS month, COALESCE(SUM(amount),0)::float8 AS total
FROM revenues
WHERE user_id = $1 AND type = 'recurring'
GROUP BY 1 ORDER BY 1 DESC LIMIT 24;
