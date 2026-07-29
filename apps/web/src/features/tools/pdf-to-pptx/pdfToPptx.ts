/**
 * PDF → PowerPoint (image-based slides). Not editable text reconstruction.
 */

import PptxGenJS from 'pptxgenjs';
import { pdfToImages } from '../pdf-to-images/pdfToImages';

export interface PdfToPptxOptions {
  bytes: ArrayBuffer;
  pages: number[];
  scale?: number;
  baseName?: string;
  onProgress?: (current: number, total: number) => void;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Render each page to PNG and place it full-bleed on one slide.
 * Result is image-based — text is not editable in PowerPoint.
 */
export async function pdfToPptx(options: PdfToPptxOptions): Promise<Blob> {
  const scale = options.scale ?? 2;
  const images = await pdfToImages({
    bytes: options.bytes,
    pages: options.pages,
    format: 'image/png',
    scale,
    quality: 1,
    background: '#ffffff',
    namePattern: '{name}-p{n}',
    baseName: options.baseName || 'page',
    onProgress: options.onProgress,
  });

  if (!images.files.length) {
    throw new Error('No pages to convert.');
  }

  // Probe first image dimensions to size the presentation.
  const firstUrl = URL.createObjectURL(images.files[0].blob);
  let slideW = 10;
  let slideH = 7.5;
  try {
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to read page image'));
      img.src = firstUrl;
    });
    const aspect = dims.w / Math.max(1, dims.h);
    slideW = 10;
    slideH = slideW / aspect;
  } finally {
    URL.revokeObjectURL(firstUrl);
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PDF_PAGE', width: slideW, height: slideH });
  pptx.layout = 'PDF_PAGE';
  pptx.author = 'PDFNexus';
  pptx.title = options.baseName || 'PDF export';

  for (let i = 0; i < images.files.length; i++) {
    options.onProgress?.(i, images.files.length);
    const b64 = await blobToBase64(images.files[i].blob);
    const slide = pptx.addSlide();
    slide.addImage({
      data: `data:image/png;base64,${b64}`,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }
  options.onProgress?.(images.files.length, images.files.length);

  const out = await pptx.write({ outputType: 'blob' });
  return out as Blob;
}
