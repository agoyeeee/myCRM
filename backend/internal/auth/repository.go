package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Create(ctx context.Context, name, email, passwordHash string) (*User, error) {
	rows := r.pool.QueryRow(ctx,
		`INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
		 RETURNING id, name, email, password_hash, created_at, updated_at`,
		name, email, passwordHash,
	)
	return scanUser(rows)
}

func (r *Repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	rows := r.pool.QueryRow(ctx,
		`SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE email = $1`, email)
	u, err := scanUser(rows)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidCredentials
	}
	return u, err
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	rows := r.pool.QueryRow(ctx,
		`SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE id = $1`, id)
	u, err := scanUser(rows)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidCredentials
	}
	return u, err
}

type Row interface {
	Scan(dest ...any) error
}

func scanUser(row Row) (*User, error) {
	var u User
	var id uuid.UUID
	if err := row.Scan(&id, &u.Name, &u.Email, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	u.ID = id
	return &u, nil
}

// RefreshToken stored server-side, rotated on use.
type RefreshToken struct {
	Token     uuid.UUID
	UserID    uuid.UUID
	ExpiresAt time.Time
}

func (r *Repository) CreateRefreshToken(ctx context.Context, userID uuid.UUID, ttl time.Duration) (*RefreshToken, error) {
	rows := r.pool.QueryRow(ctx,
		`INSERT INTO refresh_tokens (user_id, expires_at) VALUES ($1, $2) RETURNING token, user_id, expires_at`,
		userID, time.Now().Add(ttl),
	)
	var t RefreshToken
	if err := rows.Scan(&t.Token, &t.UserID, &t.ExpiresAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ConsumeRefreshToken(ctx context.Context, token uuid.UUID) (*RefreshToken, error) {
	rows := r.pool.QueryRow(ctx,
		`UPDATE refresh_tokens SET expires_at = now() WHERE token = $1 AND expires_at > now() AND revoked_at IS NULL
		 RETURNING token, user_id, expires_at`,
		token,
	)
	var t RefreshToken
	err := rows.Scan(&t.Token, &t.UserID, &t.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return err
}

// UpdateProfile updates name and/or password hash. Empty strings skip the field.
func (r *Repository) UpdateProfile(ctx context.Context, id uuid.UUID, name, passwordHash string) error {
	if name != "" && passwordHash != "" {
		_, err := r.pool.Exec(ctx, `UPDATE users SET name = $2, password_hash = $3, updated_at = now() WHERE id = $1`, id, name, passwordHash)
		return err
	}
	if name != "" {
		_, err := r.pool.Exec(ctx, `UPDATE users SET name = $2, updated_at = now() WHERE id = $1`, id, name)
		return err
	}
	if passwordHash != "" {
		_, err := r.pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, passwordHash)
		return err
	}
	return nil
}

func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(h), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
