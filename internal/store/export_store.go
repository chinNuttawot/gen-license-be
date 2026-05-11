package store

import (
	"database/sql"
	"time"

	"gen-license-be/internal/license"

	"github.com/google/uuid"
)

type ExportStore struct {
	db     *sql.DB
	crypto *license.Service
}

func NewExportStore(db *sql.DB, crypto *license.Service) *ExportStore {
	return &ExportStore{db: db, crypto: crypto}
}

func (s *ExportStore) Save(req license.ExportRequest) error {
	generatedAt, err := time.Parse(time.RFC3339, license.NormalizeDate(req.Meta.IssuedAt))
	if err != nil {
		generatedAt = time.Now().UTC()
	}
	expiry, err := time.Parse(time.RFC3339, license.NormalizeDate(req.Meta.Expiry))
	if err != nil {
		return err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	companyID, err := findOrCreateCompany(tx, req.Meta.Company)
	if err != nil {
		return err
	}

	var exists bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM license_records WHERE company_id = $1 AND generated_at = $2)`, companyID, generatedAt).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return tx.Commit()
	}

	for i, token := range req.Tokens {
		var hwid sql.NullString
		if req.Meta.LicenseType == "station-based" && i < len(req.Meta.HWIDs) {
			hwid = sql.NullString{String: req.Meta.HWIDs[i], Valid: true}
		}
		encryptedToken, err := s.crypto.EncryptBundle(map[string]any{"token": token})
		if err != nil {
			return err
		}
		_, err = tx.Exec(`INSERT INTO license_records (id, company_id, license_type, quantity, hwid, valid_until, encrypted_token, generated_at)
			VALUES ($1, $2, $3, 1, $4, $5, $6, $7)`, uuid.NewString(), companyID, req.Meta.LicenseType, hwid, expiry, encryptedToken, generatedAt)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func findOrCreateCompany(tx *sql.Tx, name string) (string, error) {
	var companyID string
	err := tx.QueryRow(`SELECT id FROM companies WHERE name = $1`, name).Scan(&companyID)
	if err == nil {
		return companyID, nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}
	companyID = uuid.NewString()
	_, err = tx.Exec(`INSERT INTO companies (id, name, created_at) VALUES ($1, $2, $3)`, companyID, name, time.Now().UTC())
	return companyID, err
}
