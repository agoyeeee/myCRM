package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/agoy/clientos/backend/internal/activities"
	"github.com/agoy/clientos/backend/internal/ai"
	"github.com/agoy/clientos/backend/internal/auth"
	"github.com/agoy/clientos/backend/internal/clients"
	"github.com/agoy/clientos/backend/internal/companies"
	"github.com/agoy/clientos/backend/internal/contacts"
	"github.com/agoy/clientos/backend/internal/dashboard"
	"github.com/agoy/clientos/backend/internal/followups"
	"github.com/agoy/clientos/backend/internal/leads"
	"github.com/agoy/clientos/backend/internal/notifications"
	"github.com/agoy/clientos/backend/internal/platform/config"
	"github.com/agoy/clientos/backend/internal/platform/database"
	middleware2 "github.com/agoy/clientos/backend/internal/platform/middleware"
	"github.com/agoy/clientos/backend/internal/platform/router"
	"github.com/agoy/clientos/backend/internal/projects"
	"github.com/agoy/clientos/backend/internal/proposals"
	"github.com/agoy/clientos/backend/internal/queue"
	"github.com/agoy/clientos/backend/internal/recurring"
	"github.com/agoy/clientos/backend/internal/research"
	"github.com/agoy/clientos/backend/internal/revenue"
	"github.com/agoy/clientos/backend/internal/search"
	"github.com/agoy/clientos/backend/internal/templates"

	db "github.com/agoy/clientos/backend/db/sqlc"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connect failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("database connected")

	queries := db.New(pool)

	var rdb *redis.Client
	if cfg.RedisAddr != "" {
		rdb = redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
		if err := rdb.Ping(ctx).Err(); err != nil {
			slog.Warn("redis not reachable — background jobs disabled", "err", err)
			rdb = nil
		} else {
			slog.Info("redis connected")
		}
	}

	// seed bootstrap user
	if cfg.SeedEmail != "" && cfg.SeedPassword != "" {
		if err := seedUser(ctx, pool, cfg); err != nil {
			slog.Error("seed failed", "err", err)
		} else {
			slog.Info("seed user ready", "email", cfg.SeedEmail)
		}
	}

	// background jobs
	var scheduler *queue.Scheduler
	if rdb != nil {
		qc := queue.NewClient(cfg.RedisAddr)
		defer qc.Close()
		scheduler = queue.NewScheduler(qc)
		scheduler.Start()
		defer scheduler.Stop()
		// kick one digest shortly after boot so reminders exist on restart
		_ = qc.EnqueueDigestIn(10 * time.Second)
	}

	// queue worker runs in-process for MVP (single binary, lazy but honest).
	// Move to cmd/worker binary when load justifies it.
	notifyJob := queue.NewNotificationJob(queries, rdb)
	worker := queue.NewWorker(cfg.RedisAddr, notifyJob)
	go func() {
		if err := worker.Run(); err != nil {
			slog.Error("worker stopped", "err", err)
		}
	}()
	defer worker.Stop()

	tokens := middleware2.NewTokenMaker(cfg.JWTSecret)
	authSvc := auth.NewService(pool, tokens, cfg.AccessTokenTTL)
	authHandler := auth.NewHandler(authSvc)

	aiProvider, err := ai.NewProvider(ai.Config{
		Provider: cfg.LLMProvider, APIKey: cfg.LLMAPIKey, Model: cfg.LLMModel, BaseURL: cfg.LLMBaseURL,
	})
	if err != nil {
		slog.Warn("AI disabled", "reason", err)
	}

	r := router.New()
	r.Use(middleware2.SecureHeaders)
	r.Use(middleware2.CORS)
	rl := middleware2.NewRateLimiter()
	r.Use(rl.Middleware)

	r.Route("/api/v1", func(r chi.Router) {
		router.MountHealth(r)
		authHandler.RegisterRoutes(r)

		// authenticated API
		r.Group(func(r chi.Router) {
			r.Use(tokens.RequireAuth)
			authHandler.RegisterAuthedRoutes(r)

			companies.New(queries, pool).Mount(r)
			contacts.New(queries).Mount(r)
			leads.New(queries, pool).Mount(r)
			activities.New(queries).Mount(r)
			followups.New(queries).Mount(r)
			proposals.New(queries).Mount(r)
			clients.New(queries).Mount(r)
			projects.New(queries).Mount(r)
			recurring.New(queries).Mount(r)
			revenue.New(queries).Mount(r)
			research.New(queries).Mount(r)
			templates.New(queries).Mount(r)
			notifications.New(queries).Mount(r)
			dashboard.New(queries).Mount(r)
			search.New(queries).Mount(r)
			ai.New(queries, aiProvider).Mount(r)
		})
	})

	slog.Info("listening", "addr", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, r); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func seedUser(ctx context.Context, pool *pgxpool.Pool, cfg *config.Config) error {
	repo := auth.NewRepository(pool)
	if _, err := repo.GetByEmail(ctx, cfg.SeedEmail); err == nil {
		return nil // already exists
	}
	hash, err := auth.HashPassword(cfg.SeedPassword)
	if err != nil {
		return err
	}
	u, err := repo.Create(ctx, "Owner", cfg.SeedEmail, hash)
	if err != nil {
		return err
	}
	_ = u
	return nil
}
