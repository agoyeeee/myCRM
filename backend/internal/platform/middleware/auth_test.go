package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTokenRoundtrip(t *testing.T) {
	m := NewTokenMaker([]byte("0123456789abcdef0123456789abcdef"))
	tok, err := m.NewAccessToken("user-1", time.Hour)
	if err != nil {
		t.Fatalf("NewAccessToken: %v", err)
	}
	claims, err := m.Parse(tok)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if claims.UserID != "user-1" {
		t.Fatalf("UserID = %q, want user-1", claims.UserID)
	}
}

func TestRequireAuth(t *testing.T) {
	m := NewTokenMaker([]byte("0123456789abcdef0123456789abcdef"))
	tok, _ := m.NewAccessToken("user-1", time.Hour)

	handler := m.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := UserIDFrom(r.Context())
		if !ok || uid != "user-1" {
			t.Errorf("UserIDFrom = %q, ok=%v", uid, ok)
		}
		w.WriteHeader(http.StatusOK)
	}))

	// no token -> 401
	req := httptest.NewRequest("GET", "/x", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: got %d want 401", rec.Code)
	}

	// valid token -> 200
	req = httptest.NewRequest("GET", "/x", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("valid token: got %d want 200", rec.Code)
	}

	// garbage token -> 401
	req = httptest.NewRequest("GET", "/x", nil)
	req.Header.Set("Authorization", "Bearer garbage")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("garbage token: got %d want 401", rec.Code)
	}
}
