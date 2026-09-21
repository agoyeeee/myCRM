package middleware

import (
	"net/http"
	"time"

	"golang.org/x/time/rate"
)

// Simple per-IP token bucket limiter.
type RateLimiter struct {
	buckets map[string]*limiterEntry
}

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{buckets: make(map[string]*limiterEntry)}
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		e, ok := rl.buckets[ip]
		if !ok {
			e = &limiterEntry{limiter: rate.NewLimiter(rate.Limit(20), 40)}
			rl.buckets[ip] = e
		}
		e.lastSeen = time.Now()
		if !e.limiter.Allow() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":{"code":"rate_limited","message":"Too many requests"}}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		for i, c := range fwd {
			if c == ',' {
				return fwd[:i]
			}
		}
		return fwd
	}
	return r.RemoteAddr
}
