# Phase 5 — Status

## Architecture summary

PDFNexus is a local-first PDF toolkit (Next.js web + NestJS API).

| Surface | Where it runs | Notes |
| --- | --- | --- |
| Merge, organize, compress, redact, forms, etc. | Browser | Downloads are immediate; no account required |
| Office → PDF | API + Gotenberg | Explicit consent; server processing badge |
| OCR-assisted Excel | API (Gemini) after consent | Cloud-assisted badge when OCR enabled |
| Google Drive | API OAuth + optional Picker | `drive.file` only; never mandatory |

## Privacy matrix

| Mode | Meaning |
| --- | --- |
| **Local** | File never leaves the device for that operation |
| **Partial** | Mostly local; optional steps may upload with consent |
| **Cloud-assisted** | Upload after explicit consent (e.g. OCR page images) |
| **Server** | Document uploaded to conversion server (Office→PDF) |

Email verification and Google Drive are **optional**. Local tool results download without an account.

## Phase 5 hardening completed

- **Drive Picker import** — Google Picker for `drive.file`-compatible selection; list UI shows app-accessible files only
- **Token encryption** — access + refresh encrypted at rest when key ≥32 chars; **required in production** if Drive is enabled
- **50MB** import/export cap; sanitized Drive error messages (no raw Google payloads)
- **Single Redis key** per OAuth session (no dual-write)
- **Copy honesty** — About / live home (`page.tsx`) / PrivacyIllustration / `dropHint` from `processingMode`
- **ToolError** on Excel OCR, redact, protect, batch failures; batch cancel + file/page progress labels
- **Workers** — structural compress path via `compress.worker.ts`; canvas cleanup on image export / JPEG raster
- CSP allows Google Picker script/frame origins

## Known limits

- Drive cannot browse the full library under `drive.file` without Picker
- Raster JPEG compress still uses main-thread canvas (pdf.js)
- Certificate signing remains experimental (see Phase 6)
- No healthcare/legal compliance claims
- Full existing-text editing (§9) is out of scope

## Remaining → Phase 6+

Completed through Phase 8. Authoritative status: [PLATFORM_STATUS.md](./PLATFORM_STATUS.md).

Live home honesty lives in `apps/web/src/app/page.tsx` (MarketingHero removed).
