# Phase 5 — Accessibility & manual QA checklist

Extends [PHASE4_A11Y_CHECKLIST.md](./PHASE4_A11Y_CHECKLIST.md).

## Drive / security honesty
- [ ] “Pick PDF from Drive” opens Google Picker (or shows honest fallback copy)
- [ ] Empty / failed Picker does not claim full Drive library search
- [ ] Export still requires consent checkbox
- [ ] Oversized (>50MB) import/export shows clear error
- [ ] Production without `GOOGLE_TOKEN_ENCRYPTION_KEY` refuses Drive token storage

## Copy / transparency
- [ ] About + MarketingHero: local downloads ungated; email optional
- [ ] Privacy illustration aria-label does not require email for local use
- [ ] `dropHint` matches processing mode (local vs server vs cloud-assisted)
- [ ] Excel / Redact / Protect / Batch failures use `ToolError` (`role="alert"`)

## Batch
- [ ] Progress shows **File i / n** for queue jobs (not mislabeled as pages only)
- [ ] Cancel stops after current job; remaining stay pending
- [ ] Keyboard reaches Cancel on `ToolProgress`

## Workers / cleanup
- [ ] Structural compress (rasterize off) can cancel via worker terminate
- [ ] PDF→images / compress JPEG path clears canvas dimensions after encode

## Automated smoke (Vitest)
- [x] `processingMode` drop hints
- [x] Drive consent gate
- [x] Drive 50MB constant (`drive-limits.test.ts` on API)

## Out of scope (do not fail Phase 5)
- Dropbox / OneDrive (Phase 6)
- EPUB (Phase 6)
- Full CMS / Adobe-valid cert signing
- Full text editing
