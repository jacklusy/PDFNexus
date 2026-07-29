# Phase 3 accessibility checklist (manual)

Use keyboard + screen reader (or browser a11y tree) on each new tool page.

## Shared tool shell

- [ ] Skip / focus: page title (`h1`) is reachable; tool controls are in a logical tab order
- [ ] Upload drop zone is keyboard-activatable (file input / button)
- [ ] Primary export button has a clear accessible name and disabled state when no file / not ready
- [ ] Errors use `role="alert"`; progress uses `aria-live="polite"`
- [ ] Focus ring visible on buttons, inputs, and selects
- [ ] Warnings / notes use `role="note"` or `role="status"` with readable text (not color alone)

## PDF → Excel / PPTX / HTML

- [ ] Table / page selection controls are labeled (checkboxes / range field)
- [ ] OCR or fidelity disclaimers are announced (visible note is enough)
- [ ] Export CTA names the format (`.xlsx` / `.pptx` / `.html`)

## Bates numbering

- [ ] Start, width, prefix, suffix, position, and align fields have associated labels
- [ ] Preview of the Bates string is available to AT (visible text is enough)
- [ ] Page range field is labeled

## Create PDF form

- [ ] Field type, name, page, and geometry inputs are labeled
- [ ] Field list edit/delete controls have accessible names
- [ ] Required checkbox is labeled

## Redact PDF

- [ ] Irreversible warning is an alert; confirmation checkbox is labeled
- [ ] Region page/x/y/w/h fields are labeled
- [ ] Verify phrases control is labeled; results announced politely

## Office → PDF / Cert sign (placeholders)

- [ ] Coming-soon status is exposed (`role="status"` or equivalent)
- [ ] Disabled primary CTA does not imply a silent failure
- [ ] Cert sign copy distinguishes cryptographic vs visual Sign PDF

## SEO / nav

- [ ] New routes appear in site Tools menu: Excel, PPTX, Bates, Forms, Redact, HTML, Office→PDF, Cert sign
- [ ] Each tool page has unique title + description metadata
- [ ] Sitemap lists Phase 3 tool URLs via `TOOL_ROUTES`
