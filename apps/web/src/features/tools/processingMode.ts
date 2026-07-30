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

export const PROCESSING_MODE_DROP_HINT: Record<ProcessingMode, string> = {
  local: 'Processed in your browser — files stay on this device',
  partial:
    'Mostly browser-local — optional steps may leave the device with consent',
  cloud_assisted: 'Cloud-assisted — upload happens only after you consent',
  server: 'Uploaded to the conversion server when you run this tool',
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

export function defaultDropHint(mode: ProcessingMode): string {
  return PROCESSING_MODE_DROP_HINT[mode];
}
