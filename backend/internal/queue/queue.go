package queue

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"
)

// Task types.
const (
	TypeGenerateDigest   = "notifications:digest"
	TypeBillingReminders = "notifications:billing_reminders"
)

// Client enqueues tasks.
type Client struct {
	client *asynq.Client
}

func NewClient(redisAddr string) *Client {
	return &Client{client: asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})}
}

func (c *Client) Close() error {
	return c.client.Close()
}

func (c *Client) EnqueueDigest() error {
	_, err := c.client.Enqueue(asynq.NewTask(TypeGenerateDigest, nil), asynq.MaxRetry(1))
	return err
}

func (c *Client) EnqueueBillingReminders() error {
	_, err := c.client.Enqueue(asynq.NewTask(TypeBillingReminders, nil), asynq.MaxRetry(1))
	return err
}

// EnqueueDigestIn schedules a one-off digest run (used for dev/testing).
func (c *Client) EnqueueDigestIn(d time.Duration) error {
	_, err := c.client.Enqueue(asynq.NewTask(TypeGenerateDigest, nil), asynq.ProcessIn(d), asynq.MaxRetry(1))
	return err
}

// Worker processes tasks.
type Worker struct {
	srv    *asynq.Server
	mux    *asynq.ServeMux
	notify *NotificationJob
}

func NewWorker(redisAddr string, notify *NotificationJob) *Worker {
	srv := asynq.NewServer(asynq.RedisClientOpt{Addr: redisAddr}, asynq.Config{
		Concurrency: 4,
		Logger:      asynqLogger{},
	})
	mux := asynq.NewServeMux()
	w := &Worker{srv: srv, mux: mux, notify: notify}
	mux.HandleFunc(TypeGenerateDigest, w.handleDigest)
	mux.HandleFunc(TypeBillingReminders, w.handleBillingReminders)
	return w
}

func (w *Worker) Run() error {
	return w.srv.Run(w.mux)
}

func (w *Worker) Stop() {
	w.srv.Shutdown()
}

func (w *Worker) handleDigest(_ context.Context, _ *asynq.Task) error {
	if w.notify == nil {
		return nil
	}
	return w.notify.CreateFollowUpDigest()
}

func (w *Worker) handleBillingReminders(_ context.Context, _ *asynq.Task) error {
	if w.notify == nil {
		return nil
	}
	return w.notify.CreateBillingReminders()
}

type asynqLogger struct{}

func (asynqLogger) Debug(args ...any) { slog.Debug(fmt.Sprint(args...)) }
func (asynqLogger) Info(args ...any)  { slog.Info(fmt.Sprint(args...)) }
func (asynqLogger) Warn(args ...any)  { slog.Warn(fmt.Sprint(args...)) }
func (asynqLogger) Error(args ...any) { slog.Error(fmt.Sprint(args...)) }
func (asynqLogger) Fatal(args ...any) { slog.Error(fmt.Sprint(args...)) }
