package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Simple migration runner: applies db/migrations/*.sql in order, tracked in schema_migrations.
// Swap to goose/migrate tooling if versioned down-migrations are needed.
func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://clientos:clientos@localhost:5432/clientos?sslmode=disable"
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	defer db.Close()

	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`); err != nil {
		fmt.Fprintln(os.Stderr, "ensure tracking table:", err)
		os.Exit(1)
	}

	entries, err := os.ReadDir("db/migrations")
	if err != nil {
		fmt.Fprintln(os.Stderr, "read migrations dir:", err)
		os.Exit(1)
	}
	for _, e := range entries {
		if e.IsDir() || len(e.Name()) < 4 || e.Name()[len(e.Name())-4:] != ".sql" {
			continue
		}
		var exists bool
		if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1)`, e.Name()).Scan(&exists); err != nil {
			fmt.Fprintln(os.Stderr, "check applied:", err)
			os.Exit(1)
		}
		if exists {
			continue
		}
		content, err := os.ReadFile("db/migrations/" + e.Name())
		if err != nil {
			fmt.Fprintln(os.Stderr, "read:", err)
			os.Exit(1)
		}
		// strip goose annotations; stop at the Down section
		clean := make([]byte, 0, len(content))
		inDown := false
		for _, line := range splitLines(content) {
			trimmed := trimSpace(line)
			if hasPrefix(trimmed, "-- +goose Down") {
				inDown = true
			}
			if inDown || hasPrefix(trimmed, "-- +goose") {
				continue
			}
			clean = append(clean, line...)
		}
		tx, err := db.Begin()
		if err != nil {
			fmt.Fprintln(os.Stderr, "begin:", err)
			os.Exit(1)
		}
		if _, err := tx.Exec(string(clean)); err != nil {
			_ = tx.Rollback()
			fmt.Fprintf(os.Stderr, "apply %s: %v\n", e.Name(), err)
			os.Exit(1)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (name) VALUES ($1)`, e.Name()); err != nil {
			_ = tx.Rollback()
			fmt.Fprintln(os.Stderr, "record:", err)
			os.Exit(1)
		}
		if err := tx.Commit(); err != nil {
			fmt.Fprintln(os.Stderr, "commit:", err)
			os.Exit(1)
		}
		fmt.Println("applied", e.Name())
	}
}

func splitLines(b []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, c := range b {
		if c == '\n' {
			lines = append(lines, b[start:i+1])
			start = i + 1
		}
	}
	if start < len(b) {
		lines = append(lines, b[start:])
	}
	return lines
}

func trimSpace(line []byte) []byte {
	i := 0
	for i < len(line) && (line[i] == ' ' || line[i] == '\t') {
		i++
	}
	j := len(line)
	for j > i && (line[j-1] == ' ' || line[j-1] == '\t' || line[j-1] == '\n' || line[j-1] == '\r') {
		j--
	}
	return line[i:j]
}

func hasPrefix(line []byte, p string) bool {
	if len(line) < len(p) {
		return false
	}
	for i := 0; i < len(p); i++ {
		if line[i] != p[i] {
			return false
		}
	}
	return true
}
