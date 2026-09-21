package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Provider abstracts the LLM backend. Keys stay server-side only.
type Provider interface {
	Complete(ctx context.Context, system, user string) (string, error)
}

type Config struct {
	Provider string // openai | groq
	APIKey   string
	Model    string
	BaseURL  string
}

func NewProvider(cfg Config) (Provider, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("LLM_API_KEY not configured")
	}
	switch cfg.Provider {
	case "groq":
		return &openAICompat{
			apiKey: cfg.APIKey, model: orDefault(cfg.Model, "llama-3.3-70b-versatile"),
			baseURL: orDefault(cfg.BaseURL, "https://api.groq.com/openai/v1"), client: &http.Client{Timeout: 120 * time.Second},
		}, nil
	default:
		return &openAICompat{
			apiKey: cfg.APIKey, model: orDefault(cfg.Model, "gpt-4o-mini"),
			baseURL: orDefault(cfg.BaseURL, "https://api.openai.com/v1"), client: &http.Client{Timeout: 120 * time.Second},
		}, nil
	}
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

// openAICompat covers OpenAI-compatible chat completions APIs (OpenAI, Groq, etc).
type openAICompat struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

type chatRequest struct {
	Model     string        `json:"model"`
	Messages  []chatMessage `json:"messages"`
	MaxTokens int           `json:"max_tokens"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

func (p *openAICompat) Complete(ctx context.Context, system, user string) (string, error) {
	body, err := json.Marshal(chatRequest{
		Model: p.model,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		MaxTokens: 1200,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("llm provider returned %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}
	var cr chatResponse
	if err := json.Unmarshal(raw, &cr); err != nil {
		return "", err
	}
	if len(cr.Choices) == 0 {
		return "", fmt.Errorf("llm provider returned no choices")
	}
	return cr.Choices[0].Message.Content, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
