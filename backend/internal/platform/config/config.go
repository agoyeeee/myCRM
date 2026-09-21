package config

import (
	"fmt"
	"os"
	"time"
)

type Config struct {
	Addr        string
	DatabaseURL string
	RedisAddr   string
	JWTSecret   []byte

	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration

	LLMProvider string
	LLMAPIKey   string
	LLMModel    string
	LLMBaseURL  string

	SeedEmail    string
	SeedPassword string

	WorkerInterval time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		Addr:            getenv("ADDR", ":8080"),
		DatabaseURL:     getenv("DATABASE_URL", "postgres://clientos:clientos@localhost:5432/clientos?sslmode=disable"),
		RedisAddr:       getenv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:       []byte(getenv("JWT_SECRET", "")),
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 30 * 24 * time.Hour,
		LLMProvider:     getenv("LLM_PROVIDER", "openai"),
		LLMAPIKey:       getenv("LLM_API_KEY", ""),
		LLMModel:        getenv("LLM_MODEL", ""),
		LLMBaseURL:      getenv("LLM_BASE_URL", ""),
		SeedEmail:       getenv("SEED_EMAIL", ""),
		SeedPassword:    getenv("SEED_PASSWORD", ""),
		WorkerInterval:  60 * time.Second,
	}
	if cfg.JWTSecret == nil || len(cfg.JWTSecret) == 0 {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}
	return cfg, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
