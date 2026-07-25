# Deployment

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (recommended)
- PostgreSQL 16, Redis 7, S3-compatible storage
- SMTP (Mailpit locally) or Resend API key in production
- Optional: `GEMINI_API_KEY` for OCR

## Environment

Copy `.env.example` → `.env` and set at minimum:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis for queues & limits |
| `COOKIE_SECRET` | ≥32 char secret for signed cookies |
| `APP_URL` / `ALLOWED_ORIGINS` | Public web origin(s) |
| `S3_*` | Object storage |
| `MAIL_PROVIDER` | `smtp` or `resend` |
| `RESEND_API_KEY` | Required when `MAIL_PROVIDER=resend` |
| `NEXT_PUBLIC_API_URL` | Browser → API base URL |

Never expose `GEMINI_API_KEY`, `COOKIE_SECRET`, or S3 secrets to the Next.js public env.

## Compose (production-like)

```bash
cp .env.example .env
# edit secrets, APP_URL, API_URL, MAIL_*, S3_*
docker compose up --build -d
```

Run migrations inside the API container (or a one-shot job):

```bash
docker compose exec api npx prisma db push
# or: prisma migrate deploy
```

## Manual process deploy

1. `npm ci && npm run build`
2. Start infra (Postgres, Redis, MinIO)
3. `npm run db:push` (or migrate deploy)
4. `npm run start -w @pdfnexus/api`
5. `npm run start -w @pdfnexus/web`

Put TLS termination (Caddy, nginx, Cloudflare) in front. Enable HSTS at the edge.

## Health checks

- `GET /api/health` — liveness + OCR budget hint
- `GET /api/ready` — readiness (DB connectivity)

## File cleanup

`FilesCleanupService` periodically deletes expired finals. Tune `FILE_TTL_DAYS`.

## Observability

API uses structured Pino logs. Do not log filenames, emails in free text beyond necessary auth flow, or base64 payloads.
