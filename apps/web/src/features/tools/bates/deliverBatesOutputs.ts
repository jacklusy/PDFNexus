/**
 * Deliver Bates outputs, then persist the next number.
 * Continuity is written only after a successful download (single or zip).
 * Cancel before download starts skips persist; after download always writeNext.
 */
export async function deliverBatesOutputs(options: {
  outputs: Array<{ fileName: string; blob: Blob }>;
  next: number;
  writeNext: (n: number) => void;
  download: (blob: Blob, fileName: string) => void;
  zipOutputs: (
    files: Array<{ fileName: string; blob: Blob }>
  ) => Promise<Blob>;
  /** Checked before download/zip starts (and mid-zip before download). */
  isCancelled?: () => boolean;
}): Promise<void> {
  if (options.isCancelled?.()) {
    throw new Error('Cancelled');
  }
  if (options.outputs.length === 1) {
    options.download(options.outputs[0].blob, options.outputs[0].fileName);
  } else {
    const zip = await options.zipOutputs(options.outputs);
    if (options.isCancelled?.()) {
      throw new Error('Cancelled');
    }
    options.download(zip, 'bates-numbered.zip');
  }
  // Artifact already delivered — always persist continuity.
  options.writeNext(options.next);
}

/**
 * After successful deliver, always sync UI start to `next`
 * (even if the user cancelled after download).
 */
export function applyBatesDeliverUi(options: {
  next: number;
  fileCount: number;
  cancelledAfterDownload: boolean;
  setStart: (n: number) => void;
}): string {
  options.setStart(options.next);
  return options.cancelledAfterDownload
    ? `Downloaded; next number saved as ${options.next} for continuity.`
    : `Downloaded ${options.fileCount} file(s). Next number saved as ${options.next} for continuity.`;
}
