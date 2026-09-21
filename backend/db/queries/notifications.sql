-- name: CreateNotification :one
INSERT INTO notifications (user_id, type, title, body, link)
VALUES ($1, $2, $3, sqlc.narg('body'), sqlc.narg('link'))
RETURNING *;

-- name: ListNotifications :many
SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3;

-- name: CountNotifications :one
SELECT COUNT(*) FROM notifications WHERE user_id = $1;

-- name: UnreadNotificationCount :one
SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL;

-- name: MarkNotificationRead :one
UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 RETURNING *;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL;

-- name: DeleteNotification :exec
DELETE FROM notifications WHERE id = $1 AND user_id = $2;

-- name: ListUserIDs :many
SELECT id FROM users;

-- name: DueFollowUpsForUser :many
SELECT f.*, l.title AS lead_title, c.name AS company_name
FROM follow_ups f
JOIN leads l ON l.id = f.lead_id
JOIN companies c ON c.id = l.company_id
WHERE f.user_id = $1 AND f.status = 'pending' AND f.due_date <= CURRENT_DATE;
