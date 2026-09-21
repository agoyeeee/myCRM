-- name: CreateContact :one
INSERT INTO contacts (user_id, company_id, name, job_title, email, phone, whatsapp, linkedin, notes)
VALUES ($1, $2, $3, sqlc.narg('job_title'), sqlc.narg('email'), sqlc.narg('phone'), sqlc.narg('whatsapp'), sqlc.narg('linkedin'), sqlc.narg('notes'))
RETURNING *;

-- name: GetContact :one
SELECT * FROM contacts WHERE id = $1 AND user_id = $2;

-- name: ListContactsByCompany :many
SELECT * FROM contacts WHERE user_id = $1 AND company_id = $2 ORDER BY created_at DESC;

-- name: ListContacts :many
SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: SearchContacts :many
SELECT * FROM contacts WHERE user_id = $1 AND name ILIKE '%' || $2 || '%' ORDER BY created_at DESC LIMIT 20;

-- name: UpdateContact :one
UPDATE contacts SET
  name      = COALESCE(sqlc.narg('name'), name),
  job_title = COALESCE(sqlc.narg('job_title'), job_title),
  email     = COALESCE(sqlc.narg('email'), email),
  phone     = COALESCE(sqlc.narg('phone'), phone),
  whatsapp  = COALESCE(sqlc.narg('whatsapp'), whatsapp),
  linkedin  = COALESCE(sqlc.narg('linkedin'), linkedin),
  notes     = COALESCE(sqlc.narg('notes'), notes),
  updated_at = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteContact :exec
DELETE FROM contacts WHERE id = $1 AND user_id = $2;
