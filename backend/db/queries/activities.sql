-- name: CreateActivity :one
INSERT INTO lead_activities (user_id, lead_id, company_id, contact_id, type, description)
VALUES ($1, sqlc.narg('lead_id'), sqlc.narg('company_id'), sqlc.narg('contact_id'), $2, $3)
RETURNING *;

-- name: GetActivity :one
SELECT a.*, c.name AS company_name FROM lead_activities a LEFT JOIN companies c ON c.id = a.company_id WHERE a.id = $1 AND a.user_id = $2;

-- name: ListActivities :many
SELECT a.*, c.name AS company_name
FROM lead_activities a
LEFT JOIN companies c ON c.id = a.company_id
WHERE a.user_id = $1
  AND (sqlc.narg('lead_id')::uuid IS NULL OR a.lead_id = sqlc.narg('lead_id'))
  AND (sqlc.narg('company_id')::uuid IS NULL OR a.company_id = sqlc.narg('company_id'))
  AND (sqlc.narg('type')::text IS NULL OR a.type = sqlc.narg('type'))
  AND (sqlc.narg('search')::text IS NULL OR a.description ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY a.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountActivities :one
SELECT COUNT(*)
FROM lead_activities a
WHERE a.user_id = $1
  AND (sqlc.narg('lead_id')::uuid IS NULL OR a.lead_id = sqlc.narg('lead_id'))
  AND (sqlc.narg('company_id')::uuid IS NULL OR a.company_id = sqlc.narg('company_id'))
  AND (sqlc.narg('type')::text IS NULL OR a.type = sqlc.narg('type'));

-- name: RecentActivities :many
SELECT a.*, c.name AS company_name
FROM lead_activities a
LEFT JOIN companies c ON c.id = a.company_id
WHERE a.user_id = $1
ORDER BY a.created_at DESC
LIMIT $2;

-- name: SearchActivities :many
SELECT a.*, c.name AS company_name
FROM lead_activities a
LEFT JOIN companies c ON c.id = a.company_id
WHERE a.user_id = $1 AND a.description ILIKE '%' || $2 || '%'
ORDER BY a.created_at DESC LIMIT 10;

-- name: DeleteActivity :exec
DELETE FROM lead_activities WHERE id = $1 AND user_id = $2;
