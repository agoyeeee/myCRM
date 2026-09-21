-- name: CreateProposal :one
INSERT INTO proposals (user_id, lead_id, company_id, title, description, amount, status, sent_at, valid_until, notes)
VALUES ($1, $2, sqlc.narg('company_id'), $3, sqlc.narg('description'), $4, $5, sqlc.narg('sent_at'), sqlc.narg('valid_until'), sqlc.narg('notes'))
RETURNING *;

-- name: GetProposal :one
SELECT p.*, c.name AS company_name, l.title AS lead_title
FROM proposals p
JOIN leads l ON l.id = p.lead_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE p.id = $1 AND p.user_id = $2;

-- name: ListProposals :many
SELECT p.*, c.name AS company_name, l.title AS lead_title
FROM proposals p
JOIN leads l ON l.id = p.lead_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE p.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR p.status = sqlc.narg('status'))
  AND (sqlc.narg('lead_id')::uuid IS NULL OR p.lead_id = sqlc.narg('lead_id'))
ORDER BY p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateProposal :one
UPDATE proposals SET
  title       = COALESCE(sqlc.narg('title'), title),
  description = COALESCE(sqlc.narg('description'), description),
  amount      = COALESCE(sqlc.narg('amount'), amount),
  status      = COALESCE(sqlc.narg('status'), status),
  sent_at     = CASE WHEN sqlc.narg('status')::text = 'sent' AND sent_at IS NULL THEN now() ELSE sent_at END,
  valid_until = COALESCE(sqlc.narg('valid_until'), valid_until),
  notes       = COALESCE(sqlc.narg('notes'), notes),
  updated_at  = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteProposal :exec
DELETE FROM proposals WHERE id = $1 AND user_id = $2;

-- name: ProposalsNearExpiry :many
SELECT p.*, c.name AS company_name, l.title AS lead_title
FROM proposals p
JOIN leads l ON l.id = p.lead_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE p.user_id = $1 AND p.status IN ('sent','negotiation')
  AND p.valid_until IS NOT NULL
  AND p.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
ORDER BY p.valid_until ASC LIMIT 20;
