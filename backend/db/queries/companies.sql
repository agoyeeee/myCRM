-- name: CreateCompany :one
INSERT INTO companies (user_id, name, website, industry, location, description, phone, email, notes, source)
VALUES ($1, $2, sqlc.narg('website'), sqlc.narg('industry'), sqlc.narg('location'), sqlc.narg('description'), sqlc.narg('phone'), sqlc.narg('email'), sqlc.narg('notes'), sqlc.narg('source'))
RETURNING *;

-- name: GetCompany :one
SELECT * FROM companies WHERE id = $1 AND user_id = $2;

-- name: ListCompanies :many
SELECT c.*
FROM companies c
WHERE c.user_id = $1
  AND (sqlc.narg('search')::text IS NULL OR c.name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY c.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountCompanies :one
SELECT COUNT(*) FROM companies
WHERE user_id = $1
  AND (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: UpdateCompany :one
UPDATE companies SET
  name        = COALESCE(sqlc.narg('name'), name),
  website     = COALESCE(sqlc.narg('website'), website),
  industry    = COALESCE(sqlc.narg('industry'), industry),
  location    = COALESCE(sqlc.narg('location'), location),
  description = COALESCE(sqlc.narg('description'), description),
  phone       = COALESCE(sqlc.narg('phone'), phone),
  email       = COALESCE(sqlc.narg('email'), email),
  notes       = COALESCE(sqlc.narg('notes'), notes),
  updated_at  = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteCompany :exec
DELETE FROM companies WHERE id = $1 AND user_id = $2;
