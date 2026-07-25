# PDFNexus architecture

## Processing model (hybrid)

| Concern | Where it runs |
|---------|----------------|
| Upload / parse PDF & images | Browser |
| Reorder, rotate, delete, blank, insert | Browser |
| Thumbnails & fullscreen preview | Browser (pdf.js, self-hosted worker) |
| Merge (pdf-lib) | Browser worker with main-thread fallback |
| PDF → Word (docx) | Browser; optional OCR via API |
| Email OTP verification | NestJS + Redis + mail queue |
| Final artifact storage | S3-compatible (MinIO/S3/R2) |
| Email delivery of finals | BullMQ + SMTP/Resend |
| Analytics & feedback | NestJS + PostgreSQL |

Source uploads are **never** stored on the server. Only finals linked to a verified email are retained until TTL expiry.

## Backend modules (`apps/api`)

- `Health` — `/api/health`, `/api/ready`
- `AuthEmail` — request OTP, verify, signed cookie, `/api/auth/me`
- `Files` — multipart upload (auth required), signed download, cleanup
- `Ocr` — Gemini page OCR with Redis guards
- `Analytics` — event ingest + summary aggregates
- `Feedback` — ratings, bugs, features, comments
- `Mail` / `Jobs` — OTP + attachment queues
- `Storage` — S3 put/get/delete/presign
- `Prisma` — PostgreSQL schema

## Frontend features (`apps/web`)

- `/` — marketing hero (brand-first)
- `/workspace` — full tool
- `/about`, `/privacy`, `/terms`, `/guide`, `/feedback`
- SEO: metadata API, sitemap, robots, Open Graph
- Virtualized page grid for large documents
- Accessible dialogs, live announcements, reduced-motion support
- Inactive AdSense slot components

## Data retention

- `VerifiedUser` — email + timestamps
- `StoredFile` — metadata + `expiresAt`
- Cleanup job deletes expired objects from S3 and marks rows `EXPIRED`

## Scaling notes

- Stateless NestJS instances behind a load balancer (`TRUST_PROXY=1`)
- Redis for rate limits, OCR concurrency/budget, BullMQ
- Shared S3 bucket; horizontal web/API replicas
- CDN in front of Next.js static assets
