-- name: CreateLead :one
INSERT INTO leads (user_id, company_id, contact_id, title, status, priority, source, estimated_value, notes, next_follow_up)
VALUES ($1, $2, sqlc.narg('contact_id'), $3, $4, $5, sqlc.narg('source'), sqlc.narg('estimated_value'), sqlc.narg('notes'), sqlc.narg('next_follow_up'))
RETURNING *;

-- name: GetLead :one
SELECT * FROM leads WHERE id = $1 AND user_id = $2;

-- name: ListLeads :many
SELECT l.*, c.name AS company_name, ct.name AS contact_name
FROM leads l
JOIN companies c ON c.id = l.company_id
LEFT JOIN contacts ct ON ct.id = l.contact_id
WHERE l.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR l.status = sqlc.narg('status'))
  AND (sqlc.narg('priority')::text IS NULL OR l.priority = sqlc.narg('priority'))
  AND (sqlc.narg('company_id')::uuid IS NULL OR l.company_id = sqlc.narg('company_id'))
  AND (sqlc.narg('search')::text IS NULL OR l.title ILIKE '%' || sqlc.narg('search')::text || '%'
       OR c.name ILIKE '%' || sqlc.narg('search')::text || '%' OR ct.name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY
  CASE WHEN sqlc.arg('sort') = 'estimated_value' AND sqlc.arg('order') = 'asc'  THEN l.estimated_value END ASC NULLS LAST,
  CASE WHEN sqlc.arg('sort') = 'estimated_value' AND sqlc.arg('order') = 'desc' THEN l.estimated_value END DESC NULLS LAST,
  CASE WHEN sqlc.arg('sort') = 'title'           AND sqlc.arg('order') = 'asc'  THEN l.title END ASC,
  CASE WHEN sqlc.arg('sort') = 'title'           AND sqlc.arg('order') = 'desc' THEN l.title END DESC,
  CASE WHEN sqlc.arg('sort') NOT IN ('estimated_value','title') AND sqlc.arg('order') = 'asc' THEN l.created_at END ASC,
  l.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountLeads :one
SELECT COUNT(*)
FROM leads l
JOIN companies c ON c.id = l.company_id
LEFT JOIN contacts ct ON ct.id = l.contact_id
WHERE l.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR l.status = sqlc.narg('status'))
  AND (sqlc.narg('priority')::text IS NULL OR l.priority = sqlc.narg('priority'))
  AND (sqlc.narg('company_id')::uuid IS NULL OR l.company_id = sqlc.narg('company_id'))
  AND (sqlc.narg('search')::text IS NULL OR l.title ILIKE '%' || sqlc.narg('search')::text || '%'
       OR c.name ILIKE '%' || sqlc.narg('search')::text || '%' OR ct.name ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: UpdateLead :one
UPDATE leads SET
  contact_id      = sqlc.narg('contact_id'),
  title           = COALESCE(sqlc.narg('title'), title),
  status          = COALESCE(sqlc.narg('status'), status),
  priority        = COALESCE(sqlc.narg('priority'), priority),
  source          = COALESCE(sqlc.narg('source'), source),
  estimated_value = COALESCE(sqlc.narg('estimated_value'), estimated_value),
  notes           = COALESCE(sqlc.narg('notes'), notes),
  next_follow_up  = COALESCE(sqlc.narg('next_follow_up'), next_follow_up),
  updated_at      = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteLead :exec
DELETE FROM leads WHERE id = $1 AND user_id = $2;

-- name: UpdateLeadStatus :one
UPDATE leads SET status = $3, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *;

-- name: PipelineByStatus :many
SELECT status, COUNT(*)::int AS count, COALESCE(SUM(estimated_value),0)::float8 AS value
FROM leads WHERE user_id = $1 GROUP BY status;

-- name: RecentLeads :many
SELECT * FROM leads WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2;

-- name: LeadsForDashboard :many
SELECT * FROM leads
WHERE user_id = $1 AND status NOT IN ('won','lost')
ORDER BY created_at DESC LIMIT 200;
