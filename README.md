# PDFNexus

Privacy-first PDF merge & organize tool with email-verified delivery.

## Architecture

| Package | Role |
|---------|------|
| `apps/web` | Next.js 15 (App Router) — marketing, SEO, workspace UI |
| `apps/api` | NestJS — auth OTP, final-file storage, OCR, analytics, feedback |
| `packages/shared` | Zod schemas & shared error codes |

**Hybrid processing:** merge, organize, preview, and PDF→Word run entirely in the browser. Only the **final** PDF/DOCX is uploaded after email verification for delivery, download retention, and analytics.

```
Browser ──merge/convert──► Final blob ──OTP cookie──► NestJS ──► S3 + email queue
                │                                      │
                └── optional OCR page images ──────────┘
```

## Quick start (local)

### 1. Infrastructure

```bash
cp .env.example .env
docker compose up -d postgres redis minio minio-init mailpit
```

Mailpit UI: http://localhost:8025 · MinIO console: http://localhost:9001

### 2. Install & migrate

```bash
npm install
npm run build -w @pdfnexus/shared
npm run db:generate
npm run db:push
```

### 3. Run apps

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

- Web: http://localhost:3000  
- API health: http://localhost:4000/api/health  

Optional: set `GEMINI_API_KEY` in `.env` for AI OCR during Word conversion.

## Download / email verification flow

1. User merges or converts in the browser.
2. If no `verified_email` cookie → OTP sent to email (Mailpit locally / Resend in prod).
3. After verify, final file uploads to object storage; BullMQ emails the attachment; UI offers direct download.
4. Cookie lasts ~60 days — no re-verify on the same browser.

## Security model

- No user accounts / passwords.
- Signed HttpOnly cookie for verified email.
- OCR: same-origin, Redis rate/concurrency/daily budget, typed errors, no payload logging.
- Final files expire after `FILE_TTL_DAYS` (default 7) via cleanup job.
- CSP + security headers on web and API.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Turbo parallel web + api |
| `npm run build` | Build all packages |
| `npm run typecheck` | TypeScript across workspaces |
| `npm run test` | Vitest unit tests |
| `npm run db:push` | Push Prisma schema |
| `node scripts/bundle-budget.mjs` | Enforce Next.js chunk size budget |

## Docker (full stack)

```bash
cp .env.example .env
docker compose up --build
```

## AdSense

Ad slots are reserved and CLS-safe but **inactive**. Provide a publisher ID later to enable.

## Docs

See [docs/architecture.md](docs/architecture.md) and [docs/deployment.md](docs/deployment.md).
