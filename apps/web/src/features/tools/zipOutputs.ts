import JSZip from 'jszip';

export interface ZipFileEntry {
  fileName: string;
  blob: Blob;
}

/** Package multiple blobs into a single ZIP archive. */
export async function zipOutputs(
  entries: ZipFileEntry[],
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const used = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let name = entry.fileName.replace(/[\\/]/g, '_').trim() || `file-${i + 1}`;
    if (used.has(name)) {
      const dot = name.lastIndexOf('.');
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let n = 2;
      while (used.has(`${base}-${n}${ext}`)) n += 1;
      name = `${base}-${n}${ext}`;
    }
    used.add(name);
    const data = await entry.blob.arrayBuffer();
    zip.file(name, data);
    onProgress?.(i + 1, entries.length);
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
