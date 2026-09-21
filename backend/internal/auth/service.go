package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
)

type Service struct {
	repo      *Repository
	tokens    *middleware.TokenMaker
	accessTTL time.Duration
}

func NewService(pool *pgxpool.Pool, tokens *middleware.TokenMaker, accessTTL time.Duration) *Service {
	return &Service{repo: NewRepository(pool), tokens: tokens, accessTTL: accessTTL}
}

func validateEmail(email string) error {
	if email == "" || !strings.Contains(email, "@") || strings.ContainsAny(email, " \t") {
		return fmt.Errorf("valid email required")
	}
	return nil
}

func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	return nil
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (*User, error) {
	if err := validateEmail(in.Email); err != nil {
		return nil, err
	}
	if err := validatePassword(in.Password); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.Name) == "" {
		return nil, fmt.Errorf("name is required")
	}
	hash, err := HashPassword(in.Password)
	if err != nil {
		return nil, err
	}
	user, err := s.repo.Create(ctx, strings.TrimSpace(in.Name), strings.ToLower(strings.TrimSpace(in.Email)), hash)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return user, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (s *Service) Login(ctx context.Context, in LoginInput) (*User, *TokenPair, error) {
	user, err := s.repo.GetByEmail(ctx, strings.ToLower(strings.TrimSpace(in.Email)))
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}
	if !CheckPassword(user.PasswordHash, in.Password) {
		return nil, nil, ErrInvalidCredentials
	}
	pair, err := s.issueTokens(ctx, user.ID)
	if err != nil {
		return nil, nil, err
	}
	return user, pair, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (*TokenPair, error) {
	tokenID, err := uuid.Parse(refreshToken)
	if err != nil {
		return nil, ErrInvalidCredentials
	}
	old, err := s.repo.ConsumeRefreshToken(ctx, tokenID)
	if err != nil {
		return nil, ErrInvalidCredentials
	}
	pair, err := s.issueTokens(ctx, old.UserID)
	if err != nil {
		return nil, err
	}
	return pair, nil
}

func (s *Service) Logout(ctx context.Context, userID uuid.UUID) error {
	return s.repo.RevokeAllForUser(ctx, userID)
}

func (s *Service) issueTokens(ctx context.Context, userID uuid.UUID) (*TokenPair, error) {
	access, err := s.tokens.NewAccessToken(userID.String(), s.accessTTL)
	if err != nil {
		return nil, err
	}
	refresh, err := s.repo.CreateRefreshToken(ctx, userID, 30*24*time.Hour)
	if err != nil {
		return nil, err
	}
	return &TokenPair{AccessToken: access, RefreshToken: refresh.Token.String()}, nil
}

func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, newName, newPasswordHash string) (*User, error) {
	if err := s.repo.UpdateProfile(ctx, userID, newName, newPasswordHash); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, userID)
}

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/auth/register", h.register)
	r.Post("/auth/login", h.login)
	r.Post("/auth/refresh", h.refresh)
	r.Post("/auth/logout", h.logout)
}

func (h *Handler) RegisterAuthedRoutes(r chi.Router) {
	r.Get("/me", h.me)
	r.Patch("/me", h.updateMe)
}

// ---- handlers ----

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var in RegisterInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	user, err := h.svc.Register(r.Context(), in)
	if err != nil {
		switch {
		case errors.Is(err, ErrEmailTaken):
			httpx.Error(w, http.StatusConflict, "email_taken", "Email already registered")
		case isValidationMsg(err):
			httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
		default:
			httpx.Internal(w, err)
		}
		return
	}
	slog.Info("user registered", "email", user.Email)
	httpx.Data(w, http.StatusCreated, map[string]any{"user": user})
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var in LoginInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	user, pair, err := h.svc.Login(r.Context(), in)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			httpx.Error(w, http.StatusUnauthorized, "invalid_credentials", "Invalid email or password")
			return
		}
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{
		"user":          user,
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
	})
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var in RefreshInput
	if err := httpx.DecodeJSON(r, &in); err != nil || in.RefreshToken == "" {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", "refresh_token required")
		return
	}
	pair, err := h.svc.Refresh(r.Context(), in.RefreshToken)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			httpx.Error(w, http.StatusUnauthorized, "invalid_credentials", "Invalid refresh token")
			return
		}
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{"access_token": pair.AccessToken, "refresh_token": pair.RefreshToken})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFrom(r.Context())
	if ok {
		if id, err := uuid.Parse(uid); err == nil {
			_ = h.svc.Logout(r.Context(), id)
		}
	}
	httpx.Data(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	user, ok := h.userFromCtx(w, r)
	if !ok {
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{"user": user})
}

func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request) {
	user, ok := h.userFromCtx(w, r)
	if !ok {
		return
	}
	var in struct {
		Name     *string `json:"name"`
		Password *string `json:"password"`
	}
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	newName := ""
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		newName = strings.TrimSpace(*in.Name)
	}
	newHash := ""
	if in.Password != nil && *in.Password != "" {
		if err := validatePassword(*in.Password); err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", err.Error())
			return
		}
		hash, err := HashPassword(*in.Password)
		if err != nil {
			httpx.Internal(w, err)
			return
		}
		newHash = hash
	}
	updated, err := h.svc.UpdateProfile(r.Context(), user.ID, newName, newHash)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{"user": updated})
}

func (h *Handler) userFromCtx(w http.ResponseWriter, r *http.Request) (*User, bool) {
	uid, ok := middleware.UserIDFrom(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return nil, false
	}
	id, err := uuid.Parse(uid)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Invalid session")
		return nil, false
	}
	user, err := h.svc.repo.GetByID(r.Context(), id)
	if err != nil {
		httpx.Internal(w, err)
		return nil, false
	}
	return user, true
}

func isValidationMsg(err error) bool {
	msg := err.Error()
	return strings.HasPrefix(msg, "password") || strings.HasPrefix(msg, "valid email") || strings.HasPrefix(msg, "name is")
}
