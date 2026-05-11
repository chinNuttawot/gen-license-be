# Gen License Backend

Go Fiber backend for generating signed license tokens and exporting encrypted `.aglic` bundles.

## Requirements

- Go 1.23+
- PostgreSQL
- Environment variables from `.env.example`

## Run

```bash
go run ./cmd/server
```

Default port: `4000`

## Build

```bash
go build -o bin/gen-license-be ./cmd/server
```

## Test

```bash
go test ./...
```

## API

### `GET /health`

Health check.

### `POST /api/license/generate`

Generates one signed token per account seat or HWID.

Request:

```json
{
  "company": "Example Co",
  "licenseType": "account-based",
  "quantity": 3,
  "expiry": "2027-01-01"
}
```

Station-based request:

```json
{
  "company": "Example Co",
  "licenseType": "station-based",
  "hwids": ["HWID-001", "HWID-002"],
  "expiry": "2027-01-01"
}
```

### `POST /api/license/export`

Encrypts generated tokens into an `.aglic` bundle and saves export records to PostgreSQL.

Request:

```json
{
  "tokens": ["..."],
  "meta": {
    "company": "Example Co",
    "licenseType": "account-based",
    "expiry": "2027-01-01T00:00:00Z",
    "issuedAt": "2026-05-11T00:00:00Z"
  }
}
```

## Project Structure

```text
cmd/server              application entrypoint
internal/config         environment and database config
internal/http           Fiber routes, handlers, response errors
internal/httperr        shared HTTP error type
internal/license        license validation, token signing, bundle encryption
internal/store          PostgreSQL connection, schema, export persistence
```

## Environment

```bash
PRIVATE_KEY=
BUNDLE_KEY=
PORT=4000
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_SSL=true
```
