/**
 * Build an .xlsx workbook from selected detected tables (SheetJS).
 */

import * as XLSX from 'xlsx';
import type { DetectedTable } from './detectTables';

export interface PdfToExcelOptions {
  tables: DetectedTable[];
  /** Indices into `tables` to include (default: all). */
  selectedIndices?: number[];
}

function sheetNameFor(table: DetectedTable, index: number, used: Set<string>): string {
  const base = `Page${table.page}_T${index + 1}`.slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name)) {
    const suffix = `_${n++}`;
    name = (base.slice(0, 31 - suffix.length) + suffix).slice(0, 31);
  }
  used.add(name);
  return name;
}

export function pdfToExcel(options: PdfToExcelOptions): ArrayBuffer {
  const { tables, selectedIndices } = options;
  const indices =
    selectedIndices && selectedIndices.length
      ? selectedIndices
      : tables.map((_, i) => i);

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  let sheetCount = 0;

  for (const i of indices) {
    const table = tables[i];
    if (!table || !table.rows.length) continue;
    const ws = XLSX.utils.aoa_to_sheet(table.rows);
    const name = sheetNameFor(table, i, usedNames);
    XLSX.utils.book_append_sheet(wb, ws, name);
    sheetCount++;
  }

  if (sheetCount === 0) {
    throw new Error('No tables selected to export.');
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}
