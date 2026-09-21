-- name: CreateClient :one
INSERT INTO clients (user_id, company_id, contact_id, lead_id, status, notes, converted_at)
VALUES ($1, $2, sqlc.narg('contact_id'), sqlc.narg('lead_id'), $3, sqlc.narg('notes'), now())
RETURNING *;

-- name: GetClient :one
SELECT cl.*, c.name AS company_name
FROM clients cl
JOIN companies c ON c.id = cl.company_id
WHERE cl.id = $1 AND cl.user_id = $2;

-- name: ListClients :many
SELECT cl.*, c.name AS company_name
FROM clients cl
JOIN companies c ON c.id = cl.company_id
WHERE cl.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR cl.status = sqlc.narg('status'))
  AND (sqlc.narg('search')::text IS NULL OR c.name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY cl.created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateClient :one
UPDATE clients SET
  status = COALESCE(sqlc.narg('status'), status),
  notes  = COALESCE(sqlc.narg('notes'), notes),
  updated_at = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteClient :exec
DELETE FROM clients WHERE id = $1 AND user_id = $2;

-- name: SearchClients :many
SELECT cl.*, c.name AS company_name
FROM clients cl
JOIN companies c ON c.id = cl.company_id
WHERE cl.user_id = $1 AND c.name ILIKE '%' || $2 || '%'
ORDER BY cl.created_at DESC LIMIT 10;
