import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { PdfToExcelTool } from '@/features/tools/pdf-to-excel/PdfToExcelTool';

export const metadata: Metadata = pageMetadata({
  title: 'PDF to Excel Online — Export Detected Tables to XLSX',
  description:
    'Detect table-like grids from a PDF text layer and export selected tables to .xlsx. Heuristic layout only — scanned PDFs need OCR. Runs locally in your browser.',
  path: '/pdf-to-excel',
});

export default function Page() {
  return (
    <ToolPageShell
      title="PDF to Excel"
      description="Find table-like text grids and export selected ones to .xlsx. Detection is heuristic from the text layer — not a pixel-perfect spreadsheet recreation."
      path="/pdf-to-excel"
      howItWorks={[
        'Upload a PDF that contains a selectable text layer.',
        'Review detected tables and choose which sheets to keep.',
        'Export an .xlsx file processed in your browser.',
      ]}
      privacyNote="Local table detection never uploads. Optional OCR uploads page images to the API only after you check the consent box."
      limits={[
        'Works best on digital PDFs with aligned columns; layout is approximate.',
        'Scanned PDFs without a text layer need the optional OCR path (with consent).',
        'Merged cells, nested tables, and complex borders are not reconstructed.',
      ]}
      faqs={[
        {
          question: 'Will every table look identical to the PDF?',
          answer:
            'No. Cells are clustered by text position. Expect a useful starting sheet, not a pixel-perfect clone.',
        },
        {
          question: 'Does this upload my PDF?',
          answer:
            'Not for local detection. If you enable OCR table detection, page images are uploaded to the conversion API with your explicit consent.',
        },
      ]}
      related={[
        { href: '/pdf-to-pptx', label: 'PDF to PPTX' },
        { href: '/pdf-to-html', label: 'PDF to HTML' },
        { href: '/pdf-to-jpg', label: 'PDF to JPG' },
      ]}
    >
      <PdfToExcelTool />
    </ToolPageShell>
  );
}
