/**
 * Deliver Bates outputs, then persist the next number.
 * Continuity is written only after a successful single download or zip.
 */
export async function deliverBatesOutputs(options: {
  outputs: Array<{ fileName: string; blob: Blob }>;
  next: number;
  writeNext: (n: number) => void;
  download: (blob: Blob, fileName: string) => void;
  zipOutputs: (
    files: Array<{ fileName: string; blob: Blob }>
  ) => Promise<Blob>;
  /** If true before writeNext, skip persistence and throw Cancelled. */
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
  if (options.isCancelled?.()) {
    throw new Error('Cancelled');
  }
  options.writeNext(options.next);
}
