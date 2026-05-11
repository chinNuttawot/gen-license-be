package license

type GenerateRequest struct {
	Company     string   `json:"company"`
	LicenseType string   `json:"licenseType"`
	Quantity    int      `json:"quantity"`
	HWIDs       []string `json:"hwids"`
	Expiry      string   `json:"expiry"`
}

type Payload struct {
	Company     string  `json:"company"`
	LicenseType string  `json:"licenseType"`
	Quantity    int     `json:"quantity"`
	Index       int     `json:"index"`
	HWID        *string `json:"hwid"`
	Expiry      string  `json:"expiry"`
	IssuedAt    string  `json:"issuedAt"`
}

type ExportRequest struct {
	Tokens []string `json:"tokens"`
	Meta   Meta     `json:"meta"`
}

type Meta struct {
	Company     string   `json:"company"`
	LicenseType string   `json:"licenseType"`
	Expiry      string   `json:"expiry"`
	IssuedAt    string   `json:"issuedAt"`
	HWIDs       []string `json:"hwids,omitempty"`
}
