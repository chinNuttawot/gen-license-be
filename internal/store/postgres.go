package store

import (
	"database/sql"

	"gen-license-be/internal/config"

	_ "github.com/lib/pq"
)

func Open(cfg config.DBConfig) (*sql.DB, error) {
	db, err := sql.Open("postgres", cfg.ConnString())
	if err != nil {
		return nil, err
	}
	return db, db.Ping()
}

func Migrate(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS companies (id uuid PRIMARY KEY, name varchar UNIQUE NOT NULL, contact_name varchar NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
		`CREATE TABLE IF NOT EXISTS license_records (id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE, license_type varchar NOT NULL, quantity int NOT NULL DEFAULT 1, hwid varchar NULL, valid_until timestamp NOT NULL, encrypted_token text NULL, generated_at timestamp NOT NULL)`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}
