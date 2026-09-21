-- name: CreateProject :one
INSERT INTO projects (user_id, client_id, name, description, status, start_date, end_date, budget, notes)
VALUES ($1, $2, $3, sqlc.narg('description'), $4, sqlc.narg('start_date'), sqlc.narg('end_date'), sqlc.narg('budget'), sqlc.narg('notes'))
RETURNING *;

-- name: GetProject :one
SELECT p.*, c.name AS client_company
FROM projects p
JOIN clients cl ON cl.id = p.client_id
JOIN companies c ON c.id = cl.company_id
WHERE p.id = $1 AND p.user_id = $2;

-- name: ListProjects :many
SELECT p.*, c.name AS client_company
FROM projects p
JOIN clients cl ON cl.id = p.client_id
JOIN companies c ON c.id = cl.company_id
WHERE p.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR p.status = sqlc.narg('status'))
  AND (sqlc.narg('client_id')::uuid IS NULL OR p.client_id = sqlc.narg('client_id'))
  AND (sqlc.narg('search')::text IS NULL OR p.name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateProject :one
UPDATE projects SET
  name           = COALESCE(sqlc.narg('name'), name),
  description    = COALESCE(sqlc.narg('description'), description),
  status         = COALESCE(sqlc.narg('status'), status),
  start_date     = COALESCE(sqlc.narg('start_date'), start_date),
  end_date       = COALESCE(sqlc.narg('end_date'), end_date),
  budget         = COALESCE(sqlc.narg('budget'), budget),
  actual_revenue = COALESCE(sqlc.narg('actual_revenue'), actual_revenue),
  notes          = COALESCE(sqlc.narg('notes'), notes),
  updated_at     = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = $1 AND user_id = $2;

-- name: SearchProjects :many
SELECT p.*, c.name AS client_company
FROM projects p
JOIN clients cl ON cl.id = p.client_id
JOIN companies c ON c.id = cl.company_id
WHERE p.user_id = $1 AND p.name ILIKE '%' || $2 || '%'
ORDER BY p.created_at DESC LIMIT 10;
