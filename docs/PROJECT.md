# PDFNexus — Project Documentation

A privacy-first PDF toolkit that runs its document processing inside the
browser, and treats every byte that leaves the device as a decision the user
has to make explicitly.

| | |
|---|---|
| **Repository** | Monorepo (npm workspaces + Turborepo), branch `main` |
| **Surfaces** | `apps/web` (Next.js 15), `apps/api` (NestJS 11), `packages/shared` (Zod contracts) |
| **Size** | ~51,200 lines of TypeScript across 358 source files (web ~35.4k, api ~9.9k, shared ~0.3k) |
| **Tests** | 53 test files, 182 tests — web 145, api 31, shared 6 (all green as of this writing) |
| **Local entry points** | Web `http://localhost:3000` · API `http://localhost:4000/api` · Admin `/admin` |
| **Status** | Feature-complete through the phase plan; certificate signing and full existing-text editing remain explicitly out of scope |

---

## 1. The Problem

Every general-purpose PDF tool on the web makes the same bargain, usually
without saying so: you upload your document to a server you do not control,
it is processed there, and you download the result. That bargain is fine for
a restaurant menu. It is not fine for a signed contract, a medical intake
form, a deposition exhibit, or an internal financial model — which is exactly
the category of document that most needs merging, redacting, and page
surgery.

Three specific failures motivated this project:

**1. The privacy claim is usually unverifiable and often false.**
"Files deleted after one hour" is a promise about someone else's
infrastructure. There is no way for a user to check it. Meanwhile the actual
operations most people need — merge, split, rotate, reorder, compress,
watermark, redact — are structural manipulations of a file format. They do
not require a server at all. The server exists because it was easier to
build, not because the work demands it.

**2. "Redaction" is routinely a lie.**
A large share of consumer PDF tools implement redaction as a black rectangle
drawn on top of the page. The text underneath survives, selectable and
copyable. This has produced real-world document leaks in litigation and
government publication. Any tool shipping a "redact" button owes the user a
guarantee about what the button actually does.

**3. Capability copy is dishonest by default.**
Tools advertise "Edit PDF" and deliver a text-box overlay. They advertise
"Digital signature" and deliver a picture of a signature. They advertise "PDF
to Word" and deliver a Word file containing one image per page. Users cannot
tell the difference until the output fails somewhere downstream.

The goal was therefore not "build another PDF tool." It was: **build the tool
where the privacy claim is structurally true rather than promised, where
destructive operations are actually destructive, and where the marketing copy
on every tool page is constrained to what the code actually does.**

A secondary constraint shaped everything: no user accounts. Requiring signup
for a merge operation is friction that serves the operator, not the user. But
some genuinely useful features — emailing a finished file to yourself,
retaining a download link, importing from Drive — do need an identity. The
system had to support both without letting the second contaminate the first.

---

## 2. Approach

### 2.1 Local-first, not local-only

The naive framing is "do everything in the browser." That framing breaks on
contact with reality:

- **Office → PDF** requires a LibreOffice-class rendering engine. There is no
  credible browser implementation.
- **Scanned-document OCR** requires either a large WASM model (tens of MB of
  download, poor accuracy) or a cloud vision model.
- **Cloud storage import/export** is definitionally a network operation.
- **Email delivery** of a result cannot happen client-side.

So the architecture is **hybrid with an explicit taxonomy**. Every tool in the
product is statically labeled with one of four processing modes, and that
label drives the UI badge, the drop-zone hint, the privacy note, and the
consent gate. This is not documentation — it is a typed value in the source
that the components consume.

```ts
// apps/web/src/features/tools/processingMode.ts
export type ProcessingMode = 'local' | 'partial' | 'cloud_assisted' | 'server';
```

| Mode | Meaning | Examples |
|---|---|---|
| `local` | The file never leaves the device for this operation. | Merge, split, extract, rotate, crop, resize, compress, watermark, page numbers, Bates, redact, flatten, protect, unlock, forms, annotate, links, PDF→JPG/EPUB/HTML/PPTX, JPG→PDF, cert-sign |
| `partial` | Mostly browser-local; an *optional* step may upload with consent. | PDF→Excel with OCR disabled |
| `cloud_assisted` | Uploads page images or derived data after explicit consent. | PDF→Excel with OCR enabled |
| `server` | Uploads the document itself to a conversion server after consent. | Office→PDF (Gotenberg) |

The rule that follows: **a `local` tool's download is never gated.** No email,
no account, no verification. If the bytes never left, there is nothing to
verify. Email verification exists only to unlock optional *delivery* — mailing
yourself the result, or keeping a retained download link.

### 2.2 Honesty as an engineering constraint

Three concrete practices came out of the "capability copy" problem:

1. **Tool pages describe the mechanism, not the aspiration.** The edit tool is
   labeled "Add text & shapes — overlays only, not full existing-text edit."
   The certificate signing tool ships a constant in its own source file
   describing its own gap:

   ```ts
   // apps/web/src/features/tools/cert-sign/certSignPdf.ts
   export const CERT_SIGN_CMS_GAP = /* ... */;
   // "This is NOT full CMS / PKCS#7 byte-range signing. Adobe and other
   //  viewers will not treat the result as a validated digital signature."
   ```

2. **Destructive operations verify themselves.** `redactPdf` does not draw a
   rectangle. It rasterizes each affected page, paints the regions black,
   rebuilds the document from JPEG page images, strips metadata, and exposes
   a `verifyRedaction()` helper that re-extracts the text layer and reports
   any surviving matches.

3. **The status document forbids inventing test results.** `PLATFORM_STATUS.md`
   carries the literal instruction *"do not invent Passed for unexecuted
   manual cells"* and leaves manual QA rows as `_not recorded_`. Automated
   coverage is cited by test name; manual coverage is marked manual.

### 2.3 Phased delivery

Development ran as ~30 numbered phases over 27 commits, each phase closing a
category of gap rather than adding surface area. The arc:

- **Phases 1–4** — Core workspace, merge/organize, thumbnails, download gate.
- **Phase 5** — Drive Picker, token encryption at rest, 50MB cloud cap, copy
  honesty pass, `ToolError` typed failures, first worker offload.
- **Phases 6–8** — Cloud OAuth hardening (state/CSRF, single Redis key,
  sanitized provider errors), Dropbox + OneDrive, Gotenberg.
- **Phases 9–27** — Worker coverage, cancel honesty, Bates continuity, nested
  pdf.js `disableWorker`, OCR abort, text-layer highlighting, link extraction,
  forms polish.
- **Phase 28–29** — Link export correctness (`writeLinkAnnotationsOnly`),
  mailto CRLF injection rejection, shared `uint8ToBlob` helpers, coverage.
- **Phase 30** — QA evidence pass; honest matrix separating automated from
  manual.
- **Post-phase** — Admin console, direct-to-storage multipart uploads, 500MB
  ceiling, SMTP delivery with branded claim links.

---

## 3. Architecture

### 3.1 System shape

```
                            ┌──────────────────────────────────────┐
                            │            BROWSER                    │
                            │                                       │
  user's PDF ──────────────►│  pdf.js (parse/render)                │
   (never uploaded          │  pdf-lib (structural write)           │
    for local tools)        │  pdfstudio + qpdf.wasm (encrypt)      │
                            │  docx / xlsx / pptxgenjs / jszip      │
                            │                                       │
                            │  ┌─────────────────────────────────┐  │
                            │  │  Module Workers                  │  │
                            │  │  merge · split · extract         │  │
                            │  │  compress · compress-raster      │  │
                            │  │  pdf-to-images                   │  │
                            │  │  (pdf.js runs disableWorker:true)│  │
                            │  └─────────────────────────────────┘  │
                            │                                       │
                            │  IndexedDB: pdfnexus-project          │
                            │  (session recovery, ≤50MB blobs)      │
                            └───────┬───────────────────┬───────────┘
                                    │                   │
                       result blob  │                   │  presigned PUT
                       downloads    │                   │  (10MB parts, ×3)
                       immediately  ▼                   ▼
                                (no server)   ┌──────────────────────┐
                                              │  S3 / R2 / MinIO      │
                                              └──────────┬───────────┘
                                    ┌────────────────────┘
                                    │ initiate / part-urls / complete
                            ┌───────▼───────────────────────────────┐
                            │            NestJS API                  │
                            │                                        │
                            │  AuthEmail · Files+Uploads · Storage    │
                            │  Ocr · Conversions · Cloud · Analytics  │
                            │  Feedback · Admin · Jobs · Mail         │
                            └──┬──────┬──────┬──────┬──────┬─────────┘
                               │      │      │      │      │
                        ┌──────▼─┐ ┌──▼───┐ ┌▼─────┐ ┌▼────────┐ ┌▼──────────┐
                        │Postgres│ │Redis │ │Gemini│ │Gotenberg│ │SMTP/Resend│
                        │  16    │ │  7   │ │ OCR  │ │ LO conv │ │  delivery │
                        └────────┘ └──┬───┘ └──────┘ └─────────┘ └───────────┘
                                      │
                                 BullMQ queues
                              (send-otp, file-email)
```

### 3.2 Repository layout

```
pdfnexus/
├── apps/
│   ├── web/                          Next.js 15 App Router
│   │   ├── src/app/                  50 routes: marketing, 27 SEO tool pages,
│   │   │                             /workspace, /cloud, /admin/*
│   │   ├── src/features/
│   │   │   ├── workspace/            WorkspaceApp, VirtualizedPageGrid,
│   │   │   │                         projectStore (IndexedDB), batchQueue
│   │   │   ├── tools/                22 tool modules + shared harness
│   │   │   │   ├── ToolPageShell     SEO page chrome
│   │   │   │   ├── ToolWorkbench     drop → configure → run → deliver
│   │   │   │   ├── ToolProgress      determinate progress + soft Cancel
│   │   │   │   ├── ToolError         typed failure + matched Retry
│   │   │   │   ├── runInWorker       worker lifecycle + cancel semantics
│   │   │   │   └── processingMode    the four-mode taxonomy
│   │   │   ├── files/                multipartUpload, download gate, OTP modal
│   │   │   ├── cloud/                Drive / Dropbox / OneDrive UI
│   │   │   ├── transfer/             cross-tool handoff
│   │   │   └── admin/                admin console UI
│   │   ├── src/lib/pdf/              pdfHelpers (parse/render/LRU caches),
│   │   │                             pdfToDocx, colorPalette,
│   │   │                             ensurePdfJsWorker, workspaceRecovery
│   │   └── src/shared/ui/            14 primitives (Dialog, Toast, Table, …)
│   ├── api/                          NestJS 11
│   │   ├── src/auth/                 OTP request/verify, signed cookie, claim tokens
│   │   ├── src/files/                FilesService, UploadsService, cleanup job
│   │   ├── src/storage/              S3 put/get/delete/presign + multipart
│   │   ├── src/ocr/                  Gemini structured-layout OCR + guards
│   │   ├── src/conversions/          Gotenberg proxy
│   │   ├── src/cloud/                3 OAuth providers, AES-GCM token store
│   │   ├── src/admin/                10 submodules: auth, users, logs, audit,
│   │   │                             analytics, errors, monitoring, security,
│   │   │                             notifications, overview
│   │   ├── src/jobs/ src/mail/       BullMQ producers/consumers
│   │   └── prisma/schema.prisma      17 models
│   └── packages/shared/              Zod schemas, ErrorCodes, upload contracts
├── scripts/                          copy-pdf-worker, bundle-budget,
│                                     build-and-start, free-ports
├── docker-compose.yml                postgres · redis · minio · mailpit ·
│                                     gotenberg · api · web
└── .github/workflows/ci.yml
```

### 3.3 The browser processing pipeline

The heart of the product. A representative local tool run:

```
File drop
   │
   ├─► parseUploadedFile()         pdf.js or image decode
   │      └─ assertPdfReadable()   fail fast on encrypted/corrupt input
   │
   ├─► renderThumbnailsForPages()  concurrency 3, LRU 250 thumbs / 20 hi-res
   │      └─ blob: URLs tracked in a Set; eviction notifies listeners
   │         so consumers can drop stale <img src>
   │
   ├─► softLargePdfHint()          advisory warning past ~80MB
   │
   ├─► runWorkerTask({ workerUrl, request, transfer, onProgress })
   │      │
   │      └─► Module Worker
   │             pdfJsGetDocumentInit() → { disableWorker: true }
   │             …structural work via pdf-lib…
   │             postMessage({ type:'progress', current, total })
   │             postMessage({ ok:true, result })
   │
   └─► downloadWorkerOutputs() / zipOutputs()
          uint8ToBlob → object URL → anchor click → revoke
```

Two details in that pipeline are load-bearing and non-obvious.

**Nested pdf.js workers.** pdf.js normally spawns its own worker. Inside a
module worker that spawn either fails or silently degrades depending on the
browser. Every worker-side pdf.js call therefore goes through
`pdfJsGetDocumentInit()`, which detects worker context (`typeof window ===
'undefined' && typeof self !== 'undefined'`) and returns `disableWorker: true`.
Main-thread callers get the dedicated `/pdf.worker.min.mjs` instead.

**The pdf.js worker file is copied, not bundled.** Next's SWC transform
rewrites the worker with bare `@swc/helpers` imports that fail to resolve at
runtime. `scripts/copy-pdf-worker.mjs` runs as a `prebuild` hook and copies
the untransformed `pdf.worker.min.mjs` (and `qpdf.wasm`) straight into
`public/`.

### 3.4 Cancellation semantics

Cancel is where most in-browser tools quietly lie: the button greys out, the
work continues, and the promise resolves minutes later against a UI that has
moved on. Two honest mechanisms are implemented.

**Hard cancel (worker tools).** `runWorkerTask` returns `{ promise, cancel }`.
`cancel()` terminates the worker *and* settles the promise immediately with
`WorkerCancelledError` — it does not wait for a timeout. The implementation
handles three races explicitly: cancel before `postMessage` (never starts
work), cancel mid-flight (terminate + reject), and cancel after settle
(no-op). `cancelAndAwait()` exists so callers can await settlement rather than
orphaning a rejection.

```ts
const cancel = () => {
  cancelled = true;
  cleanupWorker();          // worker.terminate()
  if (settled) return;
  settled = true;
  clearTimer();
  rejectFn?.(new WorkerCancelledError());
};
```

**Soft cancel (main-thread tools).** Tools without a worker (Merge, Rotate,
JpgToPdf, annotate, links, forms, overlay) finish the current `await` step,
then stop before the next one. The UI says so rather than implying instant
abort. Mid-operation `AbortSignal` for the remaining main-thread tools
(Flatten, Protect) is a known open gap.

### 3.5 Direct-to-storage multipart upload

When a user *does* opt into delivery, the finished artifact goes straight from
the browser to object storage. Bytes never transit the API. This was the
largest single piece of backend engineering in the project.

```
Browser                          API                        S3/R2/MinIO
   │                              │                              │
   │ POST /files/uploads/initiate │                              │
   │  {fileName,sizeBytes,email}  │                              │
   │─────────────────────────────►│                              │
   │                              │ validate size ≤ 500MB        │
   │                              │ detectFileKind → ext/mime    │
   │                              │ sanitize storage key         │
   │                              │ StoredFile(PENDING) +        │
   │                              │ UploadSession   (1 txn)      │
   │                              │ CreateMultipartUpload ──────►│
   │  {sessionId, sessionToken,   │◄─────────────────────────────│
   │   mode, partSize, totalParts}│                              │
   │◄─────────────────────────────│                              │
   │                              │                              │
   │ POST /uploads/:id/part-urls  │  ← just-in-time, ≤25 at a time
   │  X-Upload-Token: <HMAC>      │                              │
   │─────────────────────────────►│ presign (900s TTL) ─────────►│
   │◄─────────────────────────────│                              │
   │                                                             │
   │  PUT part N  (10MB, 3 parallel workers, retry×5 w/ jitter)  │
   │────────────────────────────────────────────────────────────►│
   │                              │                              │
   │ POST /uploads/:id/complete   │                              │
   │─────────────────────────────►│ ListParts (authoritative) ──►│
   │                              │ CompleteMultipartUpload ────►│
   │                              │ magic-byte check %PDF- / PK  │
   │                              │ StoredFile → READY           │
   │  {downloadUrl (HMAC, 24h),   │ enqueue file-email (BullMQ)  │
   │   emailQueued}               │                              │
   │◄─────────────────────────────│                              │
```

Design choices worth calling out:

- **Part URLs are presigned just-in-time, never in bulk.** A 500MB upload on a
  slow connection can outlive a 15-minute presign window. Requesting ≤25 part
  URLs at a time means the URLs are always fresh relative to the parts about
  to be sent.
- **Client ETags are informational.** `complete` calls S3 `ListParts` and
  treats the server's view as authoritative. A client cannot forge a
  completion.
- **Magic bytes are checked server-side after completion.** The object must
  begin with `%PDF-` or the ZIP signature `PK` before `StoredFile` flips to
  `READY`. Declared MIME type is not trusted.
- **Session calls are HMAC-authenticated** via an `X-Upload-Token` derived
  from `COOKIE_SECRET`, compared with `timingSafeEqual`.
- **Resume is supported.** `GET /uploads/:id` returns completed part numbers;
  the client re-sends only what is missing, up to 2 session resumes.
- **Progress is EWMA-smoothed** (τ = 3s) and emitted at most every 200ms, so
  speed and ETA do not oscillate with per-part completion spikes.

Because the browser PUTs cross-origin, the bucket must allow `PUT` from the
web origin and expose `ETag`; the storage origin must also appear in the web
CSP `connect-src`.

### 3.6 Identity and the download gate

There are two entirely separate identity systems, and they share no tables:

**Product identity — `VerifiedUser`.** No password, ever. Flow: request OTP →
6-digit code, bcrypt-hashed, 10-minute TTL, 5 attempts, rate-limited 5 per 15
minutes per email/IP → verify → signed HttpOnly cookie valid 60 days. The
cookie authorizes *delivery*, not tool use. First-time users who upload before
verifying receive a one-time claim link by email instead.

**Staff identity — `User` + `Role`.** Email + bcrypt password with a
Laravel-style policy (min 10 chars, upper/lower/digit/special), 13 named
permissions, failed-attempt lockout, server-side `AdminSession` rows with
hashed tokens, and OTP step-up for sensitive changes (email change, password
change).

### 3.7 Cloud OAuth

Three optional providers, all following the same shape and all narrowly
scoped:

| Provider | Scope | Consequence |
|---|---|---|
| Google Drive | `drive.file` | Only files the app created or the user picked via Google Picker |
| Dropbox | App Folder | Cannot see the rest of the account |
| OneDrive | AppFolder | Cannot see the rest of the account |

Shared invariants: OAuth `state` must match a per-provider session cookie
(login-CSRF defense); tokens are AES-GCM encrypted at rest under
`CLOUD_TOKEN_ENCRYPTION_KEY` (≥32 chars, **required in production** if any
provider is enabled); one Redis key per session, no dual-write; disconnect
does a best-effort provider revoke then clears Redis; imports are gated to
`application/pdf` *or* a `.pdf` filename — never bare
`application/octet-stream`; 50MB cap both directions; provider errors are
sanitized before reaching the client. Unconfigured providers return 503 rather
than failing obscurely.

### 3.8 Data model

17 Prisma models across four concerns:

- **Product** — `VerifiedUser`, `EmailVerification`, `StoredFile`,
  `UploadSession`, `UploadPart`, `Download`, `ProcessingLog`
- **Telemetry** — `AnalyticsEvent`, `Feedback`
- **Admin identity** — `User`, `Role`, `AdminSession`, `AdminOtpChallenge`
- **Observability** — `HttpRequestLog`, `AuditLog`, `ErrorEvent`,
  `AdminNotification`

Indexing is deliberate: `StoredFile` carries `[expiresAt, status]` for the
cleanup sweep and `[ownerEmail, createdAt]` for user lookup;
`AnalyticsEvent` is indexed on every dimension the admin console can filter
by (`type`, `country`, `device`, `os`, each paired with `createdAt`);
`ErrorEvent` is unique on `fingerprint` so repeat errors increment
`occurrenceCount` instead of flooding the table.

---

## 4. Decisions

### 4.1 Hybrid processing over pure-client or pure-server

**Chosen:** four-mode taxonomy, local by default, server only where the work
genuinely demands it.

**Rejected — pure client.** Would have meant dropping Office→PDF and OCR
outright, or shipping a WASM LibreOffice (impractical) and a WASM OCR model
(tens of MB, materially worse accuracy).

**Rejected — pure server.** Simpler to build, faster on low-end devices, but
it forfeits the entire premise. Every file, including the ones users care most
about, would transit infrastructure they cannot audit.

**Trade-off accepted:** the browser bundle is large (pdf.js + pdf-lib +
qpdf.wasm + docx + xlsx + pptxgenjs + jszip), and low-end mobile devices can
run out of memory on large documents. Mitigated by lazy-loading conversion
code, a CI bundle budget, worker offload, and an ~80MB advisory hint — but not
eliminated. This is the central cost of the architecture and it was paid
knowingly.

### 4.2 Module workers with `disableWorker` for nested pdf.js

**Chosen:** heavy structural operations run in module workers; pdf.js inside
those workers runs with `disableWorker: true`.

**Why:** merging or splitting a 200-page PDF on the main thread freezes the
tab. Workers keep the UI responsive and make cancellation truthful — you can
`terminate()` a worker, you cannot terminate a synchronous loop.

**Why not spawn nested pdf.js workers:** browser support for worker-in-worker
is inconsistent, and failures are silent rather than loud. Disabling the
nested worker costs some parallelism inside an already-backgrounded thread —
an acceptable price for deterministic behavior.

**Not all tools are workerized.** Raster JPEG compression still uses a
main-thread canvas because `OffscreenCanvas` support was not uniform enough
across the target matrix at the time. That is a documented gap, not an
oversight.

### 4.3 Rasterizing redaction rather than editing content streams

**Chosen:** render each affected page, paint regions black, rebuild the
document from JPEG page images, strip metadata, and offer verification.

**Why:** the alternative — surgically editing PDF content streams to delete
the covered glyphs — is the "correct" approach and is very hard to get right.
Text can be split across operators, positioned by cumulative transforms, drawn
via Type 3 glyph procedures, or embedded in an XObject. A partial
implementation of that approach produces output that *looks* redacted and is
not, which is precisely the failure mode the tool exists to prevent.

**Cost, stated plainly:** output pages become images. Text is no longer
selectable *anywhere* on a redacted page, file size grows, and accessibility
regresses. That is a real loss, and it is the right trade for a tool whose
entire value is the guarantee. The `verifyRedaction()` helper closes the loop
by re-extracting text and reporting survivors.

### 4.4 Direct-to-storage upload instead of proxying through the API

**Chosen:** presigned multipart PUT from browser to bucket.

**Why:** proxying 500MB through NestJS means the API holds the transfer for
its full duration, consumes memory or disk buffering it, and becomes the
scaling bottleneck. Direct-to-storage keeps the API stateless — it only ever
handles small JSON control messages, so instances stay cheap and horizontally
scalable.

**Cost:** substantially more complexity. Session tokens, just-in-time
presigning, part accounting, resume, abort, orphaned-session cleanup, and
bucket CORS configuration all become the application's problem. The security
model also has to assume a hostile client, which is why `ListParts` and
magic-byte validation are server-side and non-negotiable.

### 4.5 Passwordless OTP for product identity

**Chosen:** email OTP → signed cookie, 60-day TTL. No passwords, no accounts.

**Why:** the product needs identity for exactly one thing — delivering a file
to an address. A password database is a liability that buys nothing here. It
would also imply that tool use requires an account, which contradicts the
premise.

**Why a 60-day cookie:** re-verifying on every download is friction that
teaches users to disable the feature. Sixty days on a signed HttpOnly cookie
is a reasonable point on the convenience/staleness curve for a tool with no
sensitive stored state.

**Cost:** losing access to the email address means losing the retained
download link. Given a default 7-day file TTL, the blast radius is small.

### 4.6 A separate admin identity system

**Chosen:** `User`/`Role` with passwords, permissions, lockout, server-side
sessions, and OTP step-up — completely disjoint from `VerifiedUser`.

**Why:** the alternative is a role flag on the product user table, which means
a passwordless OTP flow becomes the authentication path to the admin console.
An attacker with momentary access to a staff inbox would get the console. Two
systems, two tables, two cookies, two threat models.

### 4.7 Gotenberg over an in-process LibreOffice

**Chosen:** a separate Gotenberg container; the API is a thin authenticated
proxy with a 25MB cap.

**Why:** LibreOffice conversion is slow, memory-hungry, and occasionally
crashes on malformed input. Isolating it in its own container means a bad
document takes down a conversion worker, not the API. It also keeps the API
image small and lets conversion scale independently.

### 4.8 Zod contracts in a shared workspace package

**Chosen:** `packages/shared` holds every request schema, the `ErrorCode`
union, and the upload response types, consumed by both web and API.

**Why:** the multipart upload protocol has five endpoints and six response
shapes. Duplicating those types across the boundary guarantees eventual drift.
One definition, validated at the API edge and typed at the client, means a
contract change is a compile error rather than a runtime surprise.

**Cost:** an ordering constraint in the build — `@pdfnexus/shared` must be
built before anything that imports it. Turborepo's `dependsOn: ["^build"]`
enforces this, and CI builds it explicitly before typecheck.

### 4.9 Defense in depth on the OCR endpoint

The OCR route is the only endpoint that spends real money per request, which
makes it the most attractive abuse target. It carries five independent guards:
a same-origin guard, a Redis sliding-window rate limit (20/min), a concurrency
cap (2 in flight), a daily budget (500 requests), and a request timeout (45s).
Payloads are size-capped (~5.5M base64 chars ≈ 4MB image) and never logged.
Missing `GEMINI_API_KEY` degrades to a typed 503 with a client-side fallback
rather than an opaque 500.

### 4.10 CSP as a build-time artifact

The Content-Security-Policy is computed in `next.config.ts` from
`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_STORAGE_URL` rather than hardcoded,
because presigned upload and download URLs point at whatever the deployment's
storage origin is. `frame-ancestors 'none'`, `object-src 'none'`, and
`base-uri 'self'` are fixed. `'unsafe-eval'` and `'wasm-unsafe-eval'` are
present and are a real concession — pdf.js and qpdf.wasm both require them.

### 4.11 CORS without wildcards

The API reflects the request `Origin` when allow-listed and never emits
`Access-Control-Allow-Origin: *`, because `credentials: 'include'` forbids the
wildcard. ETag generation is disabled outright: a credentialed cross-origin
response served from browser cache via 304 can cause Chrome to re-apply a
stale ACAO header and fail the request. Both are one-line settings that cost
hours to diagnose the first time.

---

## 5. Outcome

### 5.1 What shipped

**27 tool routes** (plus one SEO alias, `/pdf-to-powerpoint`), 25 of them
fully local. `ToolWorkbench` defaults every tool to `local`; only the two
exceptions declare a different mode:

| Category | Tools | Count |
|---|---|---|
| **Organize** (local) | Merge, Split, Extract pages, Rotate | 4 |
| **Convert** | PDF→JPG, JPG→PDF, PDF→PPTX, PDF→HTML, PDF→EPUB *(local)*; PDF→Excel *(partial → cloud-assisted when OCR is enabled)*; Office→PDF *(server)* | 7 |
| **Edit & markup** (local) | Add text & shapes, Annotate, Watermark, Page numbers, Crop, Resize, Create form, Bates numbering, Redact, Edit links, Flatten | 11 |
| **Secure** (local) | Protect, Unlock, Sign (visual), Cert-sign *(experimental)*, Compress | 5 |

PDF→Word (`convertPDFToDocx`) ships inside the workspace rather than as its
own SEO route.

**A continuous workspace** — multi-file page organizer with a virtualized grid
(`@tanstack/react-virtual`) for large documents, IndexedDB session recovery
(`pdfnexus-project`, ≤50MB blob budget with a typed quota warning), a batch
queue with per-job retry, and cross-tool handoff so output from one tool
becomes input to the next without a round trip through the filesystem.

**A delivery path** — email OTP verification, direct-to-storage multipart
upload up to 500MB with resume and smoothed progress, HMAC download links
(24h default), BullMQ email delivery with branded claim links, and a 7-day
default file TTL enforced by a cleanup job.

**Optional cloud connectors** — Drive (`drive.file` + Picker), Dropbox App
Folder, OneDrive AppFolder, all narrowly scoped and encrypted at rest.

**A full admin console** — 12 routes covering overview, users, HTTP request
logs, audit trail, analytics with multi-dimensional filtering, error events
with fingerprint deduplication, monitoring, security, notifications, and
settings. Exports to CSV, XLSX, and PDF with progress tracking and truncation
headers.

**27 SEO tool pages** plus 4 category pages, sitemap, robots, and generated
OpenGraph images — each page's copy constrained to the tool's actual
capability. `SITEMAP_TOOL_ROUTES` is the single source of truth, so a new
tool cannot ship without appearing in the sitemap.

### 5.2 Verified results

Run against the working tree at the time of writing:

```
apps/web       46 test files   145 tests   passed   4.41s
apps/api        6 test files    31 tests   passed   2.73s
packages/shared 1 test file      6 tests   passed   0.61s
─────────────────────────────────────────────────────────
Total          53 test files   182 tests   passed
```

CI (`.github/workflows/ci.yml`) runs on push to `main` and on every PR against
Postgres 16 and Redis 7 service containers: install → build shared → prisma
generate → typecheck all workspaces → test all workspaces → build API → build
web → **bundle budget gate** (fails if the largest first-load JS chunk exceeds
900KB) → format check and `npm audit --audit-level=high` (both non-blocking).

Test coverage concentrates on the places where a silent bug would be
expensive: worker cancel races (`runInWorker.test.ts`), OCR abort paths (four
separate test files), link annotation writing without burned-in chrome,
`mailto:` CRLF header injection, PDF magic-byte validation, multipart upload
part accounting, cloud OAuth security invariants (18 assertions), and
redaction verification.

### 5.3 What is explicitly not claimed

Stated as bluntly in the repo as here:

- **No healthcare, legal, or regulatory compliance claims.** Not HIPAA, not
  eIDAS, not 21 CFR Part 11.
- **Certificate signing is experimental.** It parses PKCS#12, draws a
  signature appearance, and attaches the signer certificate PEM and a detached
  PKCS#7 as embedded files. It does **not** produce a `/ByteRange` CMS
  signature. Adobe will not validate it. No TSA, no LTV.
- **Existing-text editing is not implemented.** The edit tool adds overlays.
- **The browser/device matrix is manual QA, not CI-validated.** Chromium is
  the primary target; Firefox and Safari rows are marked manual and several
  spot-check cells read `_not recorded_`.
- **Performance figures are design limits, not measured benchmarks.** The
  ~80MB hint and 50MB cloud cap are thresholds chosen during development, not
  results from a profiling harness.

---

## 6. Retrospective

### 6.1 What worked

**Making processing mode a typed value.** `ProcessingMode` is four string
literals, and the badge, drop hint, privacy note, and consent gate all derive
from it. Adding a tool forces the author to declare where its bytes go, and
the UI tells the truth automatically. This is the single highest-leverage
decision in the codebase — it converted a documentation problem, which decays,
into a type problem, which does not.

**Writing the limitation into the code that has the limitation.**
`CERT_SIGN_CMS_GAP` and `REDACT_WARNING` live in the modules they describe.
When someone reads `certSignPdf.ts`, the gap is right there. Marketing copy in
a separate file drifts; a constant next to the implementation does not.

**Refusing to fake test results.** `PLATFORM_STATUS.md` carries an explicit
instruction not to write "Passed" for unexecuted manual checks, and leaves
rows as `_not recorded_`. It is uncomfortable to publish a status document
with blanks in it. It is far worse to publish one where the blanks have been
filled in optimistically and nobody can tell which cells are real.

**Getting cancellation right early.** The three-race analysis in
`runWorkerTask` (cancel-before-post, cancel-in-flight, cancel-after-settle)
took real effort for what looks like a small utility, and it paid for itself
across every tool that uses it. Orphaned promise rejections in a worker
pipeline are miserable to debug later.

**The shared Zod package.** The multipart upload protocol changed shape
several times during development. Every change surfaced as a compile error on
the other side of the boundary rather than a runtime failure in a
half-finished 400MB transfer.

**Turborepo caching.** With three workspaces and a build ordering constraint,
`dependsOn: ["^build"]` removed an entire category of "why is my type stale"
confusion.

### 6.2 What did not work, and what it cost

**The bundle is heavy, and there is no clean fix.** pdf.js, pdf-lib,
qpdf.wasm, docx, xlsx, pptxgenjs, and jszip all have to reach the browser for
the local-first premise to hold. Lazy-loading, `optimizePackageImports`, and a
CI budget gate keep it bounded — the budget sits at 900KB for the largest
first-load chunk — but "bounded" is not "small." Low-end mobile devices remain
a genuinely poor experience for large documents, and the mitigation is an
advisory hint rather than a solution.

**Nested pdf.js workers cost more than they should have.** The failure mode is
silent: pdf.js inside a module worker tries to spawn its own worker, fails,
and degrades in browser-dependent ways. Diagnosing it meant reproducing
inconsistent behavior across engines. The eventual fix —
`pdfJsGetDocumentInit()` centralizing the `disableWorker` decision — is six
lines. Finding it was not. **Lesson:** when a library's own concurrency model
collides with yours, centralize the reconciliation in one function
immediately, before the workaround gets copy-pasted into six workers.

**The pdf.js worker/SWC interaction was pure friction.** Next's transform
rewrote the worker with unresolvable `@swc/helpers` imports. The fix — a
`prebuild` script copying the untransformed file into `public/` — is fine, but
it is a build-system workaround that a future contributor will not understand
without the comment. It is commented.

**Multipart upload was substantially harder than estimated.** The happy path
took an afternoon. Everything else — resume after network loss, presign
expiry on slow connections, part accounting under retry, orphaned session
cleanup, bucket CORS, `ETag` exposure, and treating the client as hostile —
took much longer than the transfer logic itself. **Lesson:** for
direct-to-storage uploads, budget the failure modes as the primary work and
the transfer as the easy part. The just-in-time presigning decision in
particular came only after reasoning about a 500MB upload on a 2Mbps
connection outliving a 15-minute URL.

**CORS and caching burned real hours for one-line fixes.** Two separate
incidents: `ACAO: *` is silently incompatible with `credentials: 'include'`,
and ETag/304 responses can cause Chrome to re-apply a stale ACAO header on a
credentialed cross-origin request. Both produce errors that point nowhere near
the cause. Both fixes are single lines in `main.ts`, and both now carry
comments explaining why they exist, because the code looks arbitrary without
them.

**Redaction's cost is real and unmitigated.** Rasterizing the page is the
honest implementation, but a redacted document loses selectable text
everywhere, gains size, and regresses on accessibility. There is no partial
credit available here — a content-stream implementation is either complete or
it is a security hole. The trade was made deliberately and it still stings.

**Scope grew past the original premise.** The project set out to be a
privacy-first PDF tool. It now also contains a 10-module admin console with
request logging, audit trails, error fingerprinting, and multi-format export —
roughly a fifth of the API surface, serving an operator rather than the user
whose privacy the product is about. It is useful and it works. It is also the
clearest instance of scope that grew because it was *possible*, not because
the premise required it.

### 6.3 Known gaps

Carried openly in `PLATFORM_STATUS.md`:

- Full existing-text editing — evaluated, not implemented
- Adobe-validated `/ByteRange` CMS, TSA, LTV — cert-sign stays experimental
- Mid-operation `AbortSignal` for the remaining soft-cancel tools (Flatten,
  Protect)
- Multi-operation DAG / full batch pipeline in the workspace
- Measured performance benchmarks and a full accessibility pass — both manual
  only today
- Google Picker is required for arbitrary Drive library files under
  `drive.file`
- GoTo / internal link destinations (URI-only extraction today)
- Editable PPTX reconstruction beyond image slides
- Raster JPEG compression still runs on the main-thread canvas

### 6.4 What I would do differently

1. **Set the bundle budget on day one, not at phase 30.** Retrofitting a
   budget means discovering which dependency was a mistake after it is load-
   bearing. A gate from the first commit would have forced the lazy-loading
   discipline earlier and cheaper.

2. **Build the automated browser matrix before writing 27 tools.** The manual
   `_not recorded_` cells exist because Playwright against Chromium, Firefox,
   and WebKit was never wired up. Local PDF processing is exactly the domain
   where engine differences bite — canvas, workers, WASM, download behavior —
   and a real matrix would have caught more than unit tests can.

3. **Decide the admin console's scope explicitly up front.** It should have
   been a deliberate "yes, this is a second product, here is its boundary"
   decision rather than something that accreted module by module.

4. **Write the honest capability copy first, then build to it.** The
   copy-honesty pass in phase 5 was a retrofit across pages already written.
   Writing the constrained description first — "overlays only, not
   existing-text edit" — would have set the implementation target correctly
   from the start and saved the rewrite.

---

## 7. Tech Stack

### Languages & runtime

| | |
|---|---|
| TypeScript | ~5.8.2 (strict, all workspaces) |
| Node.js | ≥ 20 |
| npm | 9.7.2 (workspaces) |

### Frontend — `apps/web`

| Package | Version | Role |
|---|---|---|
| `next` | ^15.2.4 | App Router, standalone output, RSC |
| `react` / `react-dom` | ^19.0.1 | UI runtime |
| `pdfjs-dist` | ^5.4.149 | PDF parse, render, text layer extraction |
| `pdf-lib` | ^1.17.1 | Structural PDF write (merge, split, annotations, forms) |
| `pdfstudio` | ^0.4.0 | qpdf.wasm bindings |
| `@pdfsmaller/pdf-encrypt` | ^1.0.2 | Password protection |
| `node-forge` | ^1.4.0 | PKCS#12 parse, PKCS#7 (experimental cert-sign) |
| `docx` | ^9.7.1 | DOCX generation (PDF→Word) |
| `xlsx` | ^0.18.5 | XLSX generation (PDF→Excel) |
| `pptxgenjs` | ^4.0.1 | PPTX generation (PDF→PowerPoint) |
| `jszip` | ^3.10.1 | Multi-file output archives, EPUB container |
| `@tanstack/react-virtual` | ^3.14.8 | Virtualized page grid |
| `recharts` | ^3.10.1 | Admin analytics charts |
| `motion` | ^12.23.24 | Animation, reduced-motion aware |
| `lucide-react` | ^0.546.0 | Icons (tree-shaken via `optimizePackageImports`) |
| `next-themes` | ^0.4.6 | Dark/light theming |
| `tailwindcss` | ^4.1.14 | Styling (`@tailwindcss/postcss`) |
| `clsx` | ^2.1.1 | Conditional class composition |

**Browser platform APIs:** Web Workers (module type), IndexedDB, Canvas 2D,
`WebAssembly` (`asyncWebAssembly` experiment), Blob/File/`URL.createObjectURL`,
`AbortController`, `crypto.subtle`.

### Backend — `apps/api`

| Package | Version | Role |
|---|---|---|
| `@nestjs/core` / `common` / `platform-express` | ^11.0.12 | Application framework |
| `@nestjs/config` | ^4.0.2 | Env loading + Zod validation |
| `@nestjs/throttler` | ^6.4.0 | Global baseline rate limit (300/min) |
| `@nestjs/bullmq` + `bullmq` | ^11.0.2 / ^5.44.0 | `send-otp` and `file-email` queues |
| `@prisma/client` + `prisma` | ^6.5.0 | ORM, migrations, 17 models |
| `ioredis` | ^5.6.0 | Rate limits, OCR guards, OAuth token store |
| `@aws-sdk/client-s3` | ^3.787.0 | Object storage + multipart |
| `@aws-sdk/s3-request-presigner` | ^3.787.0 | Presigned PUT/GET |
| `@google/genai` | ^1.0.0 | Gemini structured-layout OCR |
| `nodemailer` | ^6.10.0 | SMTP delivery |
| `resend` | ^4.2.0 | Transactional email (production alternative) |
| `bcryptjs` | ^3.0.2 | OTP code hashing, admin password hashing |
| `cookie-parser` / `cookie-signature` | ^1.4.7 / ^1.2.2 | Signed HttpOnly cookies |
| `helmet` | ^8.1.0 | Security headers |
| `nestjs-pino` + `pino` + `pino-http` | ^4.4.0 / ^9.6.0 / ^10.4.0 | Structured logging with redaction |
| `class-validator` / `class-transformer` | ^0.14.1 / ^0.5.1 | DTO validation |
| `exceljs` | ^4.4.0 | Admin XLSX export |
| `pdfkit` | ^0.19.1 | Admin PDF export |
| `zod` | ^3.24.2 | Shared schema validation |
| `rxjs` | ^7.8.2 | Nest reactive primitives |

### Shared — `packages/shared`

`zod` ^3.24.2 — request/response schemas, the `ErrorCodes` union (24 typed
codes), upload protocol contracts (`UPLOAD_PART_SIZE_BYTES = 10MB`), admin
query schemas, and the 13-entry `ADMIN_PERMISSIONS` list.

### Infrastructure

| Service | Image / Provider | Role |
|---|---|---|
| PostgreSQL | `postgres:16-alpine` | Primary datastore (host `:55432` locally) |
| Redis | `redis:7-alpine` | Queues, rate limits, OAuth tokens (host `:56379`) |
| MinIO | `minio/minio:latest` | S3-compatible dev storage (`:9000`, console `:9001`) |
| Mailpit | `axllent/mailpit:latest` | Local SMTP capture (`:1025`, UI `:8025`) |
| Gotenberg | `gotenberg/gotenberg:8` | LibreOffice Office→PDF (host `:3001`) |
| Production storage | AWS S3 / Cloudflare R2 | Final artifacts (CORS + lifecycle rules required) |
| Production email | Resend or Google SMTP | OTP and file delivery |

Host ports are deliberately non-standard (`55432`, `56379`) to avoid colliding
with other local Postgres/Redis instances.

### Build, tooling & CI

| Tool | Version | Role |
|---|---|---|
| Turborepo | ^2.5.0 | Task orchestration, caching, `dependsOn: ["^build"]` |
| Vitest | ^3.0.9 | Unit tests (all three workspaces) |
| `fake-indexeddb` | ^6.2.5 | IndexedDB test double |
| Supertest | ^7.1.0 | API integration tests |
| ESLint | ^10.8.0 | Linting (`@typescript-eslint` ^8.65.0) |
| Prettier | ^3.5.3 | Formatting |
| Docker Compose | — | Full local stack |
| GitHub Actions | — | CI: typecheck → test → build → bundle budget → audit |

**Custom scripts:** `copy-pdf-worker.mjs` (untransformed pdf.js worker +
qpdf.wasm into `public/`), `bundle-budget.mjs` (900KB first-load chunk gate),
`build-and-start.mjs` (orchestrated local production start), `free-ports.mjs`
(port cleanup).

### External APIs

| Service | Scope | Optional |
|---|---|---|
| Google Gemini | Structured-layout page OCR | Yes — degrades to typed 503 |
| Google Drive | `drive.file` + Picker | Yes — 503 when unconfigured |
| Dropbox | App Folder | Yes |
| Microsoft OneDrive | AppFolder | Yes |
| Google AdSense | Slots reserved, CLS-safe, **inactive** | Yes |

---

## 8. Running the project

```bash
# 1. Infrastructure
cp .env.example .env
docker compose up -d postgres redis minio minio-init mailpit gotenberg

# 2. Install, build contracts, migrate
npm install
npm run build -w @pdfnexus/shared
npm run db:generate
npm run db:push

# 3. Run
npm run dev:api     # http://localhost:4000/api
npm run dev:web     # http://localhost:3000

# Verify
npm run typecheck && npm run test
```

Mailpit UI at `http://localhost:8025`, MinIO console at
`http://localhost:9001` (`minioadmin` / `minioadmin`).

Full stack in containers: `docker compose up --build`.

### Required environment

At minimum: `DATABASE_URL`, `REDIS_URL`, `COOKIE_SECRET` (≥32 chars),
`APP_URL`, `ALLOWED_ORIGINS`, the `S3_*` group, `MAIL_PROVIDER`,
`NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_STORAGE_URL`. In production,
`CLOUD_TOKEN_ENCRYPTION_KEY` (≥32 chars) is **required** if any cloud provider
is enabled. `GEMINI_API_KEY`, `COOKIE_SECRET`, and S3 secrets must never be
exposed to the Next.js public env.

### Health

- `GET /api/health` — liveness plus OCR budget hint
- `GET /api/ready` — readiness (database connectivity)

### Related documents

- [architecture.md](./architecture.md) — module-level detail and bucket CORS policy
- [deployment.md](./deployment.md) — production deployment steps
- [PLATFORM_STATUS.md](./PLATFORM_STATUS.md) — authoritative phase status and QA matrix
- [PHASE5_STATUS.md](./PHASE5_STATUS.md) — phase 5 hardening record
