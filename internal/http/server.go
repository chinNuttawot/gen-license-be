package http

import (
	"bytes"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"gen-license-be/internal/httperr"
	"gen-license-be/internal/license"
	"gen-license-be/internal/store"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

type Server struct {
	app     *fiber.App
	service *license.Service
	exports *store.ExportStore
}

func New(service *license.Service, exports *store.ExportStore) *Server {
	s := &Server{service: service, exports: exports}
	app := fiber.New(fiber.Config{
		BodyLimit:    10 * 1024 * 1024,
		ErrorHandler: errorHandler,
	})
	app.Use(cors.New(cors.Config{ExposeHeaders: "Content-Disposition"}))
	s.app = app
	s.routes()
	return s
}

func (s *Server) Listen(port string) error {
	return s.app.Listen(":" + port)
}

func (s *Server) routes() {
	s.app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "antigravity-license-api", "timestamp": time.Now().UTC().Format(time.RFC3339Nano)})
	})
	s.app.Post("/api/license/generate", s.generateLicense)
	s.app.Post("/api/license/export", s.exportBundle)
}

func (s *Server) generateLicense(c *fiber.Ctx) error {
	var req license.GenerateRequest
	if err := c.BodyParser(&req); err != nil {
		return httperr.New(400, "Invalid JSON request body.")
	}
	result, err := s.service.Generate(req)
	if err != nil {
		return err
	}
	return c.JSON(result)
}

func (s *Server) exportBundle(c *fiber.Ctx) error {
	var req license.ExportRequest
	if err := c.BodyParser(&req); err != nil {
		return httperr.New(400, "Invalid JSON request body.")
	}
	if len(req.Tokens) == 0 {
		return httperr.New(400, "tokens array is required and must not be empty.")
	}
	if strings.TrimSpace(req.Meta.Company) == "" || req.Meta.Expiry == "" {
		return httperr.New(400, "meta.company and meta.expiry are required.")
	}

	content, err := s.service.EncryptBundle(map[string]any{"version": 1, "meta": req.Meta, "tokens": req.Tokens})
	if err != nil {
		return err
	}
	if err := s.exports.Save(req); err != nil {
		log.Printf("[export] DB save error: %v", err)
	}

	dateStr := time.Now().UTC().Format("2006-01-02")
	if t, err := time.Parse(time.RFC3339, license.NormalizeDate(req.Meta.IssuedAt)); err == nil {
		dateStr = t.UTC().Format("2006-01-02")
	}
	filename := fmt.Sprintf("license-%s-%s.aglic", safeASCIIName(req.Meta.Company), dateStr)
	utf8Filename := fmt.Sprintf("license-%s-%s.aglic", req.Meta.Company, dateStr)

	c.Set("Content-Type", "application/octet-stream")
	c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, filename, url.QueryEscape(utf8Filename)))
	return c.SendString(content)
}

func errorHandler(c *fiber.Ctx, err error) error {
	if e, ok := err.(httperr.Error); ok {
		return c.Status(e.Code).JSON(fiber.Map{"status": "fail", "error": e.Message, "message": e.Message})
	}
	log.Printf("request error: %v", err)
	return c.Status(500).JSON(fiber.Map{"status": "error", "error": "Internal server error", "message": err.Error()})
}

func safeASCIIName(s string) string {
	var b bytes.Buffer
	lastDash := false
	for _, r := range strings.ToLower(s) {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if ok {
			b.WriteRune(r)
			lastDash = false
		} else if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "bundle"
	}
	return out
}
