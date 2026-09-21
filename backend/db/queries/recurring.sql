-- name: CreateRecurringService :one
INSERT INTO recurring_services (user_id, client_id, project_id, name, amount, billing_cycle, start_date, next_billing_date, status, notes)
VALUES ($1, $2, sqlc.narg('project_id'), $3, $4, $5, sqlc.narg('start_date'), sqlc.narg('next_billing_date'), $6, sqlc.narg('notes'))
RETURNING *;

-- name: GetRecurringService :one
SELECT r.*, c.name AS client_company
FROM recurring_services r
JOIN clients cl ON cl.id = r.client_id
JOIN companies c ON c.id = cl.company_id
WHERE r.id = $1 AND r.user_id = $2;

-- name: ListRecurringServices :many
SELECT r.*, c.name AS client_company
FROM recurring_services r
JOIN clients cl ON cl.id = r.client_id
JOIN companies c ON c.id = cl.company_id
WHERE r.user_id = $1
  AND (sqlc.narg('status')::text IS NULL OR r.status = sqlc.narg('status'))
  AND (sqlc.narg('client_id')::uuid IS NULL OR r.client_id = sqlc.narg('client_id'))
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateRecurringService :one
UPDATE recurring_services SET
  name              = COALESCE(sqlc.narg('name'), name),
  amount            = COALESCE(sqlc.narg('amount'), amount),
  billing_cycle     = COALESCE(sqlc.narg('billing_cycle'), billing_cycle),
  start_date        = COALESCE(sqlc.narg('start_date'), start_date),
  next_billing_date = COALESCE(sqlc.narg('next_billing_date'), next_billing_date),
  status            = COALESCE(sqlc.narg('status'), status),
  notes             = COALESCE(sqlc.narg('notes'), notes),
  updated_at        = now()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id')
RETURNING *;

-- name: DeleteRecurringService :exec
DELETE FROM recurring_services WHERE id = $1 AND user_id = $2;

-- name: RecurringUpcomingBilling :many
SELECT r.*, c.name AS client_company
FROM recurring_services r
JOIN clients cl ON cl.id = r.client_id
JOIN companies c ON c.id = cl.company_id
WHERE r.user_id = $1 AND r.status = 'active'
  AND r.next_billing_date IS NOT NULL
  AND r.next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
ORDER BY r.next_billing_date ASC LIMIT 20;

-- name: ActiveRecurringForMRR :many
SELECT amount, billing_cycle FROM recurring_services WHERE user_id = $1 AND status = 'active';

-- name: SearchRecurring :many
SELECT r.*, c.name AS client_company
FROM recurring_services r
JOIN clients cl ON cl.id = r.client_id
JOIN companies c ON c.id = cl.company_id
WHERE r.user_id = $1 AND r.name ILIKE '%' || $2 || '%'
ORDER BY r.created_at DESC LIMIT 10;
