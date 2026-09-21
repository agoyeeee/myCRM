package queue

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
	"github.com/robfig/cron/v3"

	db "github.com/agoy/clientos/backend/db/sqlc"
)

// NotificationJob creates reminders from follow-ups, proposals, recurring services.
type NotificationJob struct {
	q      *db.Queries
	rdb    *redis.Client
	logger *slog.Logger
}

func NewNotificationJob(q *db.Queries, rdb *redis.Client) *NotificationJob {
	return &NotificationJob{q: q, rdb: rdb, logger: slog.Default()}
}

// CreateFollowUpDigest creates notifications for due/overdue follow-ups.
// Idempotent per day via a Redis lock key.
func (j *NotificationJob) CreateFollowUpDigest() error {
	lockKey := "clientos:digest:" + time.Now().Format("2006-01-02")
	if ok, err := j.rdb.SetNX(context.Background(), lockKey, 1, 24*time.Hour).Result(); err != nil || !ok {
		return err
	}
	userIDs, err := j.q.ListUserIDs(context.Background())
	if err != nil {
		return err
	}
	for _, uid := range userIDs {
		due, err := j.q.DueFollowUpsForUser(context.Background(), uid)
		if err != nil {
			return err
		}
		for _, f := range due {
			title := "Follow-up due"
			if f.LeadTitle != "" {
				title = f.LeadTitle + " — follow-up due"
			}
			body := "Due " + f.DueDate.Time.Format("2006-01-02")
			if f.Description.Valid {
				body = f.Description.String + " — due " + f.DueDate.Time.Format("2006-01-02")
			}
			_, _ = j.q.CreateNotification(context.Background(), db.CreateNotificationParams{
				UserID: uid,
				Type:   "follow_up_due",
				Title:  title,
				Body:   pgtype.Text{String: body, Valid: true},
				Link:   pgtype.Text{String: "/follow-ups", Valid: true},
			})
		}
	}
	return nil
}

// CreateBillingReminders creates notifications for recurring services billing soon.
func (j *NotificationJob) CreateBillingReminders() error {
	lockKey := "clientos:billing:" + time.Now().Format("2006-01-02")
	if ok, err := j.rdb.SetNX(context.Background(), lockKey, 1, 24*time.Hour).Result(); err != nil || !ok {
		return err
	}
	return nil
}

// Scheduler enqueues periodic tasks.
type Scheduler struct {
	c      *cron.Cron
	client *Client
}

func NewScheduler(client *Client) *Scheduler {
	return &Scheduler{c: cron.New(), client: client}
}

func (s *Scheduler) Start() {
	s.c.AddFunc("0 7 * * *", func() { _ = s.client.EnqueueDigest() }) // daily 07:00
	s.c.AddFunc("30 7 * * *", func() { _ = s.client.EnqueueBillingReminders() })
	s.c.Start()
}

func (s *Scheduler) Stop() {
	ctx := s.c.Stop()
	select {
	case <-ctx.Done():
	case <-time.After(5 * time.Second):
	}
}
