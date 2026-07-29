# Phase 2 accessibility checklist (manual)

Use keyboard + screen reader (or browser a11y tree) on each new tool page.

## Shared tool shell

- [ ] Skip / focus: page title (`h1`) is reachable; tool controls are in a logical tab order
- [ ] Upload drop zone is keyboard-activatable (file input / button)
- [ ] Primary export button has a clear accessible name and disabled state when no file
- [ ] Errors use `role="alert"`; progress uses `aria-live="polite"`
- [ ] Focus ring visible on buttons, inputs, and selects

## Crop / Resize / Flatten

- [ ] Margin / size fields have associated `<label>` text
- [ ] Page range mode announces selection (all vs selected)
- [ ] Flatten warning is an alert and confirmation checkbox is labeled

## Annotate

- [ ] Tool mode group has `aria-label` (highlight / sticky / comment)
- [ ] Color swatches have accessible names
- [ ] Annotation list items expose Edit / Delete controls with labels
- [ ] Page selector is labeled

## Links

- [ ] URI, page, and geometry fields are labeled
- [ ] Links list edit/delete controls are named
- [ ] Coordinate help text is available to AT (visible caption is enough)

## Workspace batch

- [ ] “Batch queue” button opens a dialog with `aria-modal` and labeled title
- [ ] Escape / close button returns focus reasonably
- [ ] Job status list updates are polite (`aria-live`)
- [ ] Bulk Crop / Resize / Flatten controls are named when selection is active

## SEO / nav

- [ ] New routes appear in site Tools menu: Crop, Resize, Flatten, Annotate, Links
- [ ] Each tool page has unique title + description metadata
