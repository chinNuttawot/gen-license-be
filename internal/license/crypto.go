package license

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"gen-license-be/internal/httperr"
)

type Crypto struct {
	privateKey ed25519.PrivateKey
	bundleKey  []byte
}

func NewCrypto(privateKeyB64 string, bundleKeyB64 string) (*Crypto, error) {
	privateKey, err := loadPrivateKey(privateKeyB64)
	if err != nil {
		return nil, err
	}
	bundleKey, err := loadBundleKey(bundleKeyB64)
	if err != nil {
		return nil, err
	}
	return &Crypto{privateKey: privateKey, bundleKey: bundleKey}, nil
}

func (c *Crypto) BuildToken(payload Payload) string {
	dataBytes, _ := json.Marshal(payload)
	sig := ed25519.Sign(c.privateKey, dataBytes)
	envelope, _ := json.Marshal(map[string]any{"data": string(dataBytes), "signature": hex.EncodeToString(sig)})
	return base64.StdEncoding.EncodeToString(envelope)
}

func (c *Crypto) EncryptBundle(payload any) (string, error) {
	block, err := aes.NewCipher(c.bundleKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	iv := make([]byte, 12)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	plain, _ := json.Marshal(payload)
	sealed := gcm.Seal(nil, iv, plain, nil)
	ciphertext := sealed[:len(sealed)-gcm.Overhead()]
	tag := sealed[len(sealed)-gcm.Overhead():]
	envelope, _ := json.Marshal(map[string]any{
		"v": 1, "alg": "AES-GCM-256",
		"iv":   base64.StdEncoding.EncodeToString(iv),
		"tag":  base64.StdEncoding.EncodeToString(tag),
		"data": base64.StdEncoding.EncodeToString(ciphertext),
	})
	return base64.StdEncoding.EncodeToString(envelope), nil
}

func loadPrivateKey(raw string) (ed25519.PrivateKey, error) {
	if raw == "" {
		return nil, fmt.Errorf("PRIVATE_KEY is not set in environment variables")
	}
	keyDER, err := base64.StdEncoding.DecodeString(stripWhitespace(raw))
	if err != nil {
		return nil, err
	}
	key, err := x509.ParsePKCS8PrivateKey(keyDER)
	if err != nil {
		return nil, err
	}
	edKey, ok := key.(ed25519.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("PRIVATE_KEY must be an Ed25519 PKCS8 private key")
	}
	return edKey, nil
}

func loadBundleKey(raw string) ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil || len(key) != 32 {
		return nil, httperr.New(500, "BUNDLE_KEY must decode to exactly 32 bytes.")
	}
	return key, nil
}

func stripWhitespace(s string) string {
	return strings.Join(strings.Fields(strings.ReplaceAll(s, `\n`, "")), "")
}
