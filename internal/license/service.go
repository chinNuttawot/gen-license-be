package license

import (
	"strings"
	"time"

	"gen-license-be/internal/httperr"
)

type Service struct {
	crypto *Crypto
}

type GenerateResult struct {
	Tokens []string       `json:"tokens"`
	Meta   map[string]any `json:"meta"`
}

func NewService(crypto *Crypto) *Service {
	return &Service{crypto: crypto}
}

func (s *Service) Generate(req GenerateRequest) (GenerateResult, error) {
	if err := validateGenerate(&req); err != nil {
		return GenerateResult{}, err
	}

	issuedAt := time.Now().UTC().Format(time.RFC3339Nano)
	expiryTime, _ := time.Parse(time.RFC3339, NormalizeDate(req.Expiry))
	expiryISO := expiryTime.UTC().Format(time.RFC3339Nano)
	company := strings.TrimSpace(req.Company)

	result := GenerateResult{
		Meta: map[string]any{
			"company": company, "licenseType": req.LicenseType,
			"expiry": expiryISO, "issuedAt": issuedAt,
		},
	}

	if req.LicenseType == "station-based" {
		for i, hwid := range req.HWIDs {
			h := hwid
			payload := Payload{Company: company, LicenseType: req.LicenseType, Quantity: 1, Index: i + 1, HWID: &h, Expiry: expiryISO, IssuedAt: issuedAt}
			result.Tokens = append(result.Tokens, s.crypto.BuildToken(payload))
		}
		result.Meta["hwids"] = req.HWIDs
		return result, nil
	}

	for i := 0; i < req.Quantity; i++ {
		payload := Payload{Company: company, LicenseType: req.LicenseType, Quantity: 1, Index: i + 1, HWID: nil, Expiry: expiryISO, IssuedAt: issuedAt}
		result.Tokens = append(result.Tokens, s.crypto.BuildToken(payload))
	}
	result.Meta["hwid"] = nil
	return result, nil
}

func (s *Service) EncryptBundle(payload any) (string, error) {
	return s.crypto.EncryptBundle(payload)
}

func validateGenerate(req *GenerateRequest) error {
	req.Company = strings.TrimSpace(req.Company)
	if req.Company == "" {
		return httperr.New(400, "company is required.")
	}
	if req.LicenseType != "account-based" && req.LicenseType != "station-based" {
		return httperr.New(400, `licenseType must be "account-based" or "station-based".`)
	}
	expiry, err := time.Parse(time.RFC3339, NormalizeDate(req.Expiry))
	if req.Expiry == "" || err != nil {
		return httperr.New(400, "expiry must be a valid ISO date string (yyyy-mm-dd).")
	}
	if !expiry.After(time.Now()) {
		return httperr.New(400, "expiry must be a future date.")
	}
	if req.LicenseType == "station-based" {
		return validateHWIDs(req)
	}
	if req.Quantity < 1 {
		return httperr.New(400, "quantity must be a positive integer (minimum 1).")
	}
	return nil
}

func validateHWIDs(req *GenerateRequest) error {
	seen := map[string]bool{}
	cleaned := make([]string, len(req.HWIDs))
	if len(req.HWIDs) == 0 {
		return httperr.New(400, "hwids[] is required for station-based licenses.")
	}
	for i, hwid := range req.HWIDs {
		hwid = strings.TrimSpace(hwid)
		if hwid == "" {
			return httperr.New(400, "All hardware IDs must be non-empty strings.")
		}
		if seen[hwid] {
			return httperr.New(400, "Duplicate hardware IDs are not allowed.")
		}
		seen[hwid] = true
		cleaned[i] = hwid
	}
	req.HWIDs = cleaned
	return nil
}

func NormalizeDate(s string) string {
	if len(s) == len("2006-01-02") {
		return s + "T00:00:00Z"
	}
	return s
}
