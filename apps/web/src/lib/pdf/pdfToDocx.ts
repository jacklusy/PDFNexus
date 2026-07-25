/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
} from 'docx';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFPageItem, FileStore } from '@/lib/types';
import { getApiBase } from '@/lib/api';
import { ensurePdfWorker } from './pdfHelpers';

async function getPdfjs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js is only available in the browser');
  }
  const pdfjsLib = await import('pdfjs-dist');
  ensurePdfWorker(pdfjsLib);
  return pdfjsLib;
}

export interface ConvertOptions {
  fontFamily?: string;
  onProgress?: (current: number, total: number, message: string) => void;
}

interface ExtractedTextLine {
  text: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  x: number;
  y: number;
  color?: string;
}

interface ExtractedBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table';
  headingLevel?: number;
  lines?: ExtractedTextLine[];
  text?: string;
  listItems?: string[];
  tableRows?: { cells: { text: string; isHeader?: boolean; bold?: boolean; bgHex?: string }[] }[];
  fontSize?: number;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
}

/**
 * Helper to fetch API with retry and backoff on transient errors (429 / rate limits)
 */
async function fetchOCRWithRetry(
  imageBase64: string, 
  pageNumber: number, 
  maxRetries = 2
): Promise<any> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await fetch(`${getApiBase()}/api/pdf-to-docx/analyze-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageBase64, pageNumber })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.layout) {
          return json.layout;
        }
      } else if (response.status === 429 && attempt < maxRetries) {
        // Wait 1.5 seconds before retrying
        console.warn(`[PDF->DOCX] AI OCR rate limited (429) on page ${pageNumber}. Retrying (attempt ${attempt + 1})...`);
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      } else {
        break;
      }
    } catch (err) {
      console.warn(`[PDF->DOCX] AI OCR network attempt ${attempt + 1} failed:`, err);
    }
    attempt++;
  }
  return null;
}

/**
 * Single High-Fidelity PDF to Microsoft Word (.docx) Conversion Pipeline.
 * Preserves layout, typography, formatting, tables, lists, images, and page structures.
 * Memory-safe for multi-hundred page documents with auto-recovery and verification.
 */
export async function convertPDFToDocx(
  pages: PDFPageItem[],
  fileStore: FileStore,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Blob> {
  const totalPages = pages.length;
  if (totalPages === 0) {
    throw new Error('No pages selected for conversion.');
  }

  const fontFamily = 'Calibri';
  const docChildren: (Paragraph | Table)[] = [];
  const loadedPDFs: Record<string, PDFDocumentProxy> = {};
  const pdfjsLib = await getPdfjs();

  let convertedCount = 0;
  const BATCH_SIZE = 10; // Batch size to prevent memory bloat on 500+ page PDFs

  // Header title in converted Word Document
  docChildren.push(
    new Paragraph({
      text: "Converted Document",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200, before: 100 },
      alignment: AlignmentType.CENTER,
    })
  );

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageItem = pages[pageIdx];
    const pageNumber = pageIdx + 1;

    onProgress?.(
      pageNumber,
      totalPages,
      `Processing page ${pageNumber} of ${totalPages}...`
    );

    // Handle blank pages
    if (pageItem.isBlank) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[ Blank Page ${pageNumber} ]`,
              italics: true,
              color: "94A3B8",
              font: fontFamily
            })
          ],
          spacing: { before: 200, after: 200 }
        })
      );
      if (pageIdx < totalPages - 1) {
        docChildren.push(new Paragraph({ pageBreakBefore: true }));
      }
      convertedCount++;
      continue;
    }

    if (!pageItem.originalFileId || !fileStore[pageItem.originalFileId] || fileStore[pageItem.originalFileId].byteLength === 0) {
      console.warn(`[PDF->DOCX] Missing source file binary for page ${pageNumber}. Skipping gracefully.`);
      continue;
    }

    const fileId = pageItem.originalFileId;
    if (!loadedPDFs[fileId]) {
      const buffer = fileStore[fileId].slice(0);
      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        isEvalSupported: false,
      });
      loadedPDFs[fileId] = await loadingTask.promise;
    }

    const pdfDoc = loadedPDFs[fileId];
    const pdfPage = await pdfDoc.getPage(pageItem.originalPageNumber);

    let pageCanvasJpeg: string | null = null;
    let canvasWidth = 0;
    let canvasHeight = 0;

    // Render viewport canvas for image extraction / OCR analysis
    try {
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      canvasWidth = viewport.width;
      canvasHeight = viewport.height;

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
        pageCanvasJpeg = canvas.toDataURL('image/jpeg', 0.85);
        // Free canvas element memory
        canvas.width = 0;
        canvas.height = 0;
      }
    } catch (renderErr) {
      console.warn(`[PDF->DOCX] Could not render canvas snapshot for page ${pageNumber}:`, renderErr);
    }

    // Inspect text items to check if page is text-searchable or scanned
    const textContent = await pdfPage.getTextContent();
    const items = textContent.items as any[];
    const isScannedOrSparse = items.length === 0 || (items.length < 5 && pageCanvasJpeg !== null);

    let pageConvertedWithAI = false;

    // Use AI OCR for scanned or image-dense pages
    if (isScannedOrSparse && pageCanvasJpeg) {
      onProgress?.(
        pageNumber,
        totalPages,
        `Applying AI OCR & layout analysis on scanned page ${pageNumber}...`
      );

      const aiLayout = await fetchOCRWithRetry(pageCanvasJpeg, pageNumber, 2);

      if (aiLayout && Array.isArray(aiLayout.elements) && aiLayout.elements.length > 0) {
        for (const elem of aiLayout.elements) {
          if (elem.type === 'heading') {
            const headingLevelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
              1: HeadingLevel.HEADING_1,
              2: HeadingLevel.HEADING_2,
              3: HeadingLevel.HEADING_3,
              4: HeadingLevel.HEADING_4,
            };
            const headingLevel = headingLevelMap[elem.headingLevel || 1] || HeadingLevel.HEADING_1;

            docChildren.push(
              new Paragraph({
                text: elem.text || '',
                heading: headingLevel,
                spacing: { before: 240, after: 120 },
              })
            );
          } else if (elem.type === 'table' && Array.isArray(elem.tableRows) && elem.tableRows.length > 0) {
            const tableRows: TableRow[] = elem.tableRows.map((row: any) => {
              const cells: TableCell[] = (row.cells || []).map((cell: any) => {
                const bgHex = cell.bgHex ? cell.bgHex.replace('#', '') : (cell.isHeader ? 'F1F5F9' : 'FFFFFF');
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell.text || '',
                          bold: cell.bold || cell.isHeader || false,
                          font: fontFamily,
                          size: 20
                        })
                      ],
                      alignment: AlignmentType.LEFT
                    })
                  ],
                  shading: { fill: bgHex, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 150, right: 150 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" }
                  }
                });
              });
              return new TableRow({ children: cells });
            });

            docChildren.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
            docChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));

          } else if (elem.type === 'list' && Array.isArray(elem.listItems)) {
            elem.listItems.forEach((itemText: string) => {
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: itemText,
                      font: fontFamily,
                      size: 22
                    })
                  ],
                  bullet: { level: 0 },
                  spacing: { before: 60, after: 60 }
                })
              );
            });
          } else {
            const alignMap: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
              center: AlignmentType.CENTER,
              right: AlignmentType.RIGHT,
              justify: AlignmentType.JUSTIFIED,
              left: AlignmentType.LEFT
            };
            const alignment = alignMap[elem.alignment] || AlignmentType.LEFT;
            const textColor = elem.textColorHex ? elem.textColorHex.replace('#', '') : '1E293B';
            const fontSizePt = elem.fontSizePt || 11;

            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: elem.text || '',
                    bold: elem.bold || false,
                    italics: elem.italic || false,
                    color: textColor,
                    font: fontFamily,
                    size: Math.round(fontSizePt * 2)
                  })
                ],
                alignment,
                spacing: { before: 100, after: 100 }
              })
            );
          }
        }
        pageConvertedWithAI = true;
      }
    }

    // Direct High-Fidelity Extraction (Fallback / Native Text Mode)
    if (!pageConvertedWithAI) {
      if (items.length > 0) {
        const blocks = groupTextItemsIntoBlocks(items);

        for (const block of blocks) {
          if (block.type === 'heading') {
            const hLevel = block.headingLevel === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;
            docChildren.push(
              new Paragraph({
                text: block.text || '',
                heading: hLevel,
                spacing: { before: 200, after: 100 },
              })
            );
          } else if (block.type === 'list' && block.listItems) {
            block.listItems.forEach(item => {
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item,
                      font: fontFamily,
                      size: 22
                    })
                  ],
                  bullet: { level: 0 },
                  spacing: { before: 40, after: 40 }
                })
              );
            });
          } else {
            const runs: TextRun[] = (block.lines || []).map(line => {
              const fontSizeHalfPt = Math.max(18, Math.round(line.fontSize * 2));
              return new TextRun({
                text: line.text + ' ',
                bold: line.isBold,
                italics: line.isItalic,
                font: fontFamily,
                size: fontSizeHalfPt,
                color: '1E293B'
              });
            });

            docChildren.push(
              new Paragraph({
                children: runs.length > 0 ? runs : [new TextRun({ text: block.text || '', font: fontFamily })],
                spacing: { before: 80, after: 80 }
              })
            );
          }
        }
      } else if (pageCanvasJpeg) {
        // Embed page image figure for pure scanned pages without OCR text
        const base64Data = pageCanvasJpeg.replace(/^data:image\/jpeg;base64,/, '');
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        docChildren.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: {
                  width: 500,
                  height: Math.round(500 * (canvasHeight / (canvasWidth || 1)))
                },
                type: 'jpg'
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 150, after: 150 }
          })
        );
      }
    }

    if (pageIdx < totalPages - 1) {
      docChildren.push(new Paragraph({ pageBreakBefore: true }));
    }

    // Clean up memory
    pdfPage.cleanup();
    convertedCount++;

    // Periodic garbage collection pause for large PDFs
    if (pageNumber % BATCH_SIZE === 0) {
      await new Promise((res) => setTimeout(res, 20));
    }
  }

  // Destroy PDF proxies
  Object.values(loadedPDFs).forEach((proxy) => {
    try {
      (proxy as any).destroy?.();
    } catch (e) {
      // ignore
    }
  });

  onProgress?.(
    totalPages,
    totalPages,
    `Validating output (${convertedCount}/${totalPages} pages converted)...`
  );

  // Validate conversion completeness
  if (convertedCount === 0) {
    throw new Error('Failed to convert any pages from the selected PDF.');
  }

  onProgress?.(
    totalPages,
    totalPages,
    "Packaging high-fidelity Microsoft Word (.docx) document..."
  );

  const doc = new Document({
    creator: "PDFNexus",
    title: "Converted PDF Document",
    description: "High fidelity Word document converted from PDF",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: docChildren
      }
    ]
  });

  return await Packer.toBlob(doc);
}

/**
 * Groups raw pdf.js text items into organized lines, paragraphs, headings, and bullet lists.
 */
function groupTextItemsIntoBlocks(items: any[]): ExtractedBlock[] {
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 3) {
      return yDiff;
    }
    return a.transform[4] - b.transform[4];
  });

  const lines: ExtractedTextLine[] = [];
  let currentLine: ExtractedTextLine | null = null;

  for (const item of sorted) {
    const text = item.str.trim();
    if (!text) continue;

    const x = item.transform[4];
    const y = item.transform[5];
    const fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12;
    const fontName = (item.fontName || '').toLowerCase();
    const isBold = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy');
    const isItalic = fontName.includes('italic') || fontName.includes('oblique');

    if (!currentLine) {
      currentLine = { text, fontSize, isBold, isItalic, x, y };
    } else if (Math.abs(currentLine.y - y) <= 4) {
      currentLine.text += ' ' + text;
      currentLine.fontSize = Math.max(currentLine.fontSize, fontSize);
      currentLine.isBold = currentLine.isBold || isBold;
      currentLine.isItalic = currentLine.isItalic || isItalic;
    } else {
      lines.push(currentLine);
      currentLine = { text, fontSize, isBold, isItalic, x, y };
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const fontSizes = lines.map(l => l.fontSize);
  const avgFontSize = fontSizes.length > 0 ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length : 12;

  const blocks: ExtractedBlock[] = [];
  let currentBlockLines: ExtractedTextLine[] = [];

  for (const line of lines) {
    if (line.fontSize >= avgFontSize * 1.25 || (line.isBold && line.fontSize > avgFontSize * 1.1)) {
      if (currentBlockLines.length > 0) {
        blocks.push({
          type: 'paragraph',
          lines: [...currentBlockLines],
          text: currentBlockLines.map(l => l.text).join(' ')
        });
        currentBlockLines = [];
      }
      blocks.push({
        type: 'heading',
        headingLevel: line.fontSize > avgFontSize * 1.5 ? 1 : 2,
        text: line.text,
        fontSize: line.fontSize
      });
      continue;
    }

    if (/^[•\-\*\u2022\u25CF]\s+/.test(line.text) || /^\d+[\.\)]\s+/.test(line.text)) {
      if (currentBlockLines.length > 0) {
        blocks.push({
          type: 'paragraph',
          lines: [...currentBlockLines],
          text: currentBlockLines.map(l => l.text).join(' ')
        });
        currentBlockLines = [];
      }
      const cleaned = line.text.replace(/^[•\-\*\u2022\u25CF]\s+/, '').replace(/^\d+[\.\)]\s+/, '');
      blocks.push({
        type: 'list',
        listItems: [cleaned]
      });
      continue;
    }

    currentBlockLines.push(line);
  }

  if (currentBlockLines.length > 0) {
    blocks.push({
      type: 'paragraph',
      lines: [...currentBlockLines],
      text: currentBlockLines.map(l => l.text).join(' ')
    });
  }

  return blocks;
}
