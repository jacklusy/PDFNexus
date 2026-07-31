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
}): Promise<void> {
  if (options.outputs.length === 1) {
    options.download(options.outputs[0].blob, options.outputs[0].fileName);
  } else {
    const zip = await options.zipOutputs(options.outputs);
    options.download(zip, 'bates-numbered.zip');
  }
  options.writeNext(options.next);
}
