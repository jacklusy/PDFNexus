# PDFNexus architecture

## Processing model (hybrid)

| Concern | Where it runs |
|---------|----------------|
| Upload / parse PDF & images | Browser |
| Reorder, rotate, delete, blank, insert | Browser |
| Thumbnails & fullscreen preview | Browser (pdf.js, self-hosted worker) |
| Merge / split / extract / compress (structural) | Browser (module workers where wired) |
| Overlay edit (text & shapes), annotate, forms | Browser |
| PDF → Word / Excel / EPUB | Browser; optional OCR via API where applicable |
| Office → PDF | NestJS → Gotenberg (after consent) |
| Experimental cert-sign | Browser (appearance + PEM/PKCS#7 **attachments**) |
| Optional cloud import/export | NestJS OAuth proxies (Drive / Dropbox App Folder / OneDrive AppFolder) |
| Email OTP verification | NestJS + Redis + mail queue |
| Final artifact storage | S3-compatible (MinIO/S3/R2) |
| Email delivery of finals | BullMQ + SMTP/Resend |
| Analytics & feedback | NestJS + PostgreSQL |

Source uploads for local tools are **never** stored on the server. Cloud import/export and Office→PDF send bytes only after explicit consent. Only finals linked to a verified email are retained until TTL expiry.

## Backend modules (`apps/api`)

- `Health` — `/api/health`, `/api/ready`
- `AuthEmail` — request OTP, verify, signed cookie, `/api/auth/me`
- `Files` — direct-to-storage upload sessions, signed download, cleanup
- `Ocr` — Gemini page OCR with Redis guards
- `Convert` / Gotenberg — Office → PDF
- `Cloud` — Google Drive (`drive.file`), Dropbox App Folder, OneDrive AppFolder OAuth + PDF-only import/export (50MB)
- `Analytics` — event ingest + summary aggregates
- `Feedback` — ratings, bugs, features, comments
- `Mail` / `Jobs` — OTP + attachment queues
- `Storage` — S3 put/get/delete/presign + multipart (create/presign part/list/complete/abort)
- `Prisma` — PostgreSQL schema

## Cloud OAuth (optional)

- Session cookies per provider; OAuth `state` must match cookie (login CSRF).
- Tokens encrypted at rest (`CLOUD_TOKEN_ENCRYPTION_KEY` or `GOOGLE_TOKEN_ENCRYPTION_KEY`).
- Disconnect: best-effort provider revoke, then clear Redis.
- PDF gate: `application/pdf` **or** `.pdf` name — never bare `application/octet-stream`.
- Dropbox / OneDrive: **app folder only** (not full library).

## Direct-to-storage uploads

Final artifacts (merged PDF / DOCX) upload straight from the browser to
object storage — bytes never pass through the API:

1. `POST /api/files/uploads/initiate` — validates size/type, sanitizes the
   storage key, creates `StoredFile(PENDING)` + `UploadSession`, and starts
   an S3 multipart upload (files ≤ 10MB use one presigned PUT instead).
   Verified users authenticate via cookie; first-time users pass an email
   (rate-limited) and receive a claim link when the upload completes.
2. `POST /api/files/uploads/:id/part-urls` — short-lived presigned part URLs,
   requested just-in-time per part (never pre-signed in bulk, so long
   uploads cannot outlive URL expiry). Session calls carry the
   `X-Upload-Token` HMAC issued at initiate.
3. Browser PUTs 10MB parts with 3 parallel workers, per-part retry with
   full-jitter exponential backoff, EWMA-smoothed speed/ETA progress, abort,
   and resume of missing parts (`GET /api/files/uploads/:id`).
4. `POST /api/files/uploads/:id/complete` — server verifies parts via
   `ListParts` (client ETags are informational only), completes the
   multipart upload, then magic-byte checks the object (`%PDF-` / ZIP `PK`)
   before flipping `StoredFile` to `READY` and returning an expiring HMAC
   download link (`DOWNLOAD_TOKEN_TTL_HOURS`, default 24h).
5. `DELETE /api/files/uploads/:id` aborts; the hourly cleanup job also
   aborts sessions stale for >24h.

### Bucket CORS (required)

Browsers upload cross-origin, so the bucket must allow `PUT` from the web
origin and expose `ETag`:

- **MinIO (dev)** — `MINIO_API_CORS_ALLOW_ORIGIN: http://localhost:3000`
  (set in `docker-compose.yml`).
- **Cloudflare R2 / AWS S3 (prod)** — apply a CORS policy on the bucket:

```json
[
  {
    "AllowedOrigins": ["https://your-app-domain"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Also recommended: a bucket lifecycle rule that aborts incomplete multipart
uploads after 7 days, as a backstop to the API cleanup job. The storage
endpoint origin must be present in the web CSP `connect-src`
(`NEXT_PUBLIC_STORAGE_URL`).

## Frontend features (`apps/web`)

- `/` — marketing hero (brand-first)
- `/workspace` — full tool
- `/cloud` — optional Drive / Dropbox / OneDrive connections
- `/about`, `/privacy`, `/terms`, `/guide`, `/feedback`
- SEO tool pages (honest capability copy — e.g. Add text & shapes ≠ full §9 text edit)
- Virtualized page grid for large documents
- Accessible dialogs, live announcements, reduced-motion support
- Inactive AdSense slot components

## Data retention

- `VerifiedUser` — email + timestamps
- `StoredFile` — metadata + `expiresAt`
- Cleanup job deletes expired objects from S3 and marks rows `EXPIRED`

## Scaling notes

- Stateless NestJS instances behind a load balancer (`TRUST_PROXY=1`)
- Redis for rate limits, OCR concurrency/budget, BullMQ, cloud OAuth tokens
- Shared S3 bucket; horizontal web/API replicas
- CDN in front of Next.js static assets
