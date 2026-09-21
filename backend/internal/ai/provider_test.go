package ai

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAICompatComplete(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("missing auth header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hello world"}}]}`))
	}))
	defer srv.Close()

	p := &openAICompat{apiKey: "test-key", model: "m", baseURL: srv.URL, client: srv.Client()}
	out, err := p.Complete(t.Context(), "sys", "user")
	if err != nil {
		t.Fatalf("Complete: %v", err)
	}
	if out != "hello world" {
		t.Fatalf("got %q", out)
	}
}

func TestTruncate(t *testing.T) {
	if got := truncate("abcdefgh", 4); got != "abcd" {
		t.Fatalf("got %q", got)
	}
	if got := truncate("abc", 10); got != "abc" {
		t.Fatalf("got %q", got)
	}
}
