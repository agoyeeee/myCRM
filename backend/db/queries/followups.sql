-- name: CreateFollowUp :one
INSERT INTO follow_ups (user_id, lead_id, due_date, description)
VALUES ($1, $2, $3, sqlc.narg('description'))
RETURNING *;

-- name: GetFollowUp :one
SELECT f.*, l.title AS lead_title, c.name AS company_name
FROM follow_ups f
JOIN leads l ON l.id = f.lead_id
JOIN companies c ON c.id = l.company_id
WHERE f.id = $1 AND f.user_id = $2;

-- name: ListFollowUps :many
SELECT f.*, l.title AS lead_title, c.name AS company_name
FROM follow_ups f
JOIN leads l ON l.id = f.lead_id
JOIN companies c ON c.id = l.company_id
WHERE f.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR f.status = sqlc.narg('status'))
  AND (
    sqlc.arg('view')::text = 'all'
    OR (sqlc.arg('view')::text = 'overdue' AND f.status = 'pending' AND f.due_date < CURRENT_DATE)
    OR (sqlc.arg('view')::text = 'today'   AND f.status = 'pending' AND f.due_date = CURRENT_DATE)
    OR (sqlc.arg('view')::text = 'upcoming' AND f.status = 'pending' AND f.due_date > CURRENT_DATE)
  )
ORDER BY f.due_date ASC, f.created_at ASC
LIMIT $2 OFFSET $3;

-- name: CountFollowUps :one
SELECT COUNT(*)
FROM follow_ups f
WHERE f.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR f.status = sqlc.narg('status'))
  AND (
    sqlc.narg('view')::text = 'all' OR sqlc.narg('view')::text IS NULL
    OR (sqlc.narg('view')::text = 'overdue' AND f.status = 'pending' AND f.due_date < CURRENT_DATE)
    OR (sqlc.narg('view')::text = 'today'   AND f.status = 'pending' AND f.due_date = CURRENT_DATE)
    OR (sqlc.narg('view')::text = 'upcoming' AND f.status = 'pending' AND f.due_date > CURRENT_DATE)
  );

-- name: UpdateFollowUp :one
UPDATE follow_ups SET
  description  = COALESCE(sqlc.narg('description'), description),
  status       = COALESCE(sqlc.narg('status'), status),
  due_date     = COALESCE(sqlc.narg('due_date'), due_date),
  completed_at = CASE
    WHEN sqlc.narg('status')::text = 'completed' THEN now()
    WHEN sqlc.narg('status')::text IN ('pending','cancelled') THEN NULL
    ELSE completed_at END
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: FollowUpsToday :many
SELECT f.*, l.title AS lead_title, c.name AS company_name
FROM follow_ups f
JOIN leads l ON l.id = f.lead_id
JOIN companies c ON c.id = l.company_id
WHERE f.user_id = $1 AND f.status = 'pending' AND f.due_date <= CURRENT_DATE
ORDER BY f.due_date ASC LIMIT 50;
