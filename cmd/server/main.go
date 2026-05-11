package main

import (
	"log"

	"gen-license-be/internal/config"
	api "gen-license-be/internal/http"
	"gen-license-be/internal/license"
	"gen-license-be/internal/store"
)

func main() {
	cfg := config.Load()

	db, err := store.Open(cfg.DB)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}

	crypto, err := license.NewCrypto(cfg.PrivateKey, cfg.BundleKey)
	if err != nil {
		log.Fatalf("crypto setup failed: %v", err)
	}
	service := license.NewService(crypto)
	exports := store.NewExportStore(db, service)
	server := api.New(service, exports)

	log.Printf("Generate License API (Go Fiber) running on http://localhost:%s", cfg.Port)
	log.Fatal(server.Listen(cfg.Port))
}
