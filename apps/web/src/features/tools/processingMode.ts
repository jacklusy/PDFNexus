/**
 * Task.md §12 processing transparency modes.
 */

export type ProcessingMode =
  | 'local'
  | 'partial'
  | 'cloud_assisted'
  | 'server';

export const PROCESSING_MODE_BADGE: Record<ProcessingMode, string> = {
  local: 'Processed locally',
  partial: 'Partially local',
  cloud_assisted: 'Cloud-assisted',
  server: 'Cloud processing required',
};

export const PROCESSING_MODE_HINT: Record<ProcessingMode, string> = {
  local: 'Your file never leaves this device for this operation.',
  partial:
    'Most work runs in your browser; optional steps may upload with consent.',
  cloud_assisted:
    'This operation uploads your document (or page images) after you consent.',
  server: 'This operation uploads your document to the conversion server.',
};

export function badgeForProcessingMode(
  mode: ProcessingMode,
  experimental?: boolean
): string {
  const base = PROCESSING_MODE_BADGE[mode];
  return experimental ? `${base} · experimental` : base;
}

export function defaultPrivacyNote(mode: ProcessingMode): string {
  return PROCESSING_MODE_HINT[mode];
}
