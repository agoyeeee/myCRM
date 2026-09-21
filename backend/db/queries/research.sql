-- name: CreateResearch :one
INSERT INTO research_records (user_id, industry, location, keyword, company_name, website, description, pain_point, opportunity, service, priority, notes)
VALUES ($1, sqlc.narg('industry'), sqlc.narg('location'), sqlc.narg('keyword'), sqlc.narg('company_name'), sqlc.narg('website'), sqlc.narg('description'), sqlc.narg('pain_point'), sqlc.narg('opportunity'), sqlc.narg('service'), sqlc.narg('priority'), sqlc.narg('notes'))
RETURNING *;

-- name: GetResearch :one
SELECT * FROM research_records WHERE id = $1 AND user_id = $2;

-- name: ListResearch :many
SELECT * FROM research_records
WHERE user_id = $1
  AND (sqlc.narg('search')::text IS NULL OR company_name ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateResearch :one
UPDATE research_records SET
  industry    = COALESCE(sqlc.narg('industry'), industry),
  location    = COALESCE(sqlc.narg('location'), location),
  keyword     = COALESCE(sqlc.narg('keyword'), keyword),
  company_name= COALESCE(sqlc.narg('company_name'), company_name),
  website     = COALESCE(sqlc.narg('website'), website),
  description = COALESCE(sqlc.narg('description'), description),
  pain_point  = COALESCE(sqlc.narg('pain_point'), pain_point),
  opportunity = COALESCE(sqlc.narg('opportunity'), opportunity),
  service     = COALESCE(sqlc.narg('service'), service),
  priority    = COALESCE(sqlc.narg('priority'), priority),
  notes       = COALESCE(sqlc.narg('notes'), notes),
  updated_at  = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteResearch :exec
DELETE FROM research_records WHERE id = $1 AND user_id = $2;

-- name: SearchResearch :many
SELECT * FROM research_records
WHERE user_id = $1 AND (company_name ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%')
ORDER BY created_at DESC LIMIT 10;
