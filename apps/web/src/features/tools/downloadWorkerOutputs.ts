/**
 * Post-worker download gate: skip zip/download when already cancelled.
 * Used by Split / PDF→images so Cancel after the worker does not save artifacts.
 */
export async function downloadWorkerOutputs(options: {
  isCancelled: () => boolean;
  files: Array<{ fileName: string; blob: Blob }>;
  zipName: string;
  download: (blob: Blob, fileName: string) => void;
  zipOutputs: (
    files: Array<{ fileName: string; blob: Blob }>
  ) => Promise<Blob>;
  onBuildingZip?: () => void;
}): Promise<'downloaded' | 'cancelled'> {
  if (options.isCancelled()) return 'cancelled';
  if (options.files.length === 1) {
    options.download(options.files[0].blob, options.files[0].fileName);
    return 'downloaded';
  }
  options.onBuildingZip?.();
  if (options.isCancelled()) return 'cancelled';
  const zip = await options.zipOutputs(options.files);
  if (options.isCancelled()) return 'cancelled';
  options.download(zip, options.zipName);
  return 'downloaded';
}
