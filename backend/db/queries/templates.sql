-- name: CreateTemplate :one
INSERT INTO outreach_templates (user_id, name, category, channel, body)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetTemplate :one
SELECT * FROM outreach_templates WHERE id = $1 AND user_id = $2;

-- name: ListTemplates :many
SELECT * FROM outreach_templates
WHERE user_id = $1
  AND (sqlc.narg('category')::text IS NULL OR category = sqlc.narg('category'))
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateTemplate :one
UPDATE outreach_templates SET
  name       = COALESCE(sqlc.narg('name'), name),
  category   = COALESCE(sqlc.narg('category'), category),
  channel    = COALESCE(sqlc.narg('channel'), channel),
  body       = COALESCE(sqlc.narg('body'), body),
  updated_at = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteTemplate :exec
DELETE FROM outreach_templates WHERE id = $1 AND user_id = $2;
