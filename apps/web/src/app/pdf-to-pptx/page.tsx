import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { PdfToPptxTool } from '@/features/tools/pdf-to-pptx/PdfToPptxTool';

export const metadata: Metadata = pageMetadata({
  title: 'PDF to PowerPoint Online — PDF Pages as PPTX Slides',
  description:
    'Convert PDF pages into a PowerPoint (.pptx) deck with each page rendered as a slide image. Local processing — not editable text objects.',
  path: '/pdf-to-pptx',
});

export default function Page() {
  return (
    <ToolPageShell
      title="PDF to PPTX"
      description="Render selected PDF pages as images and place each on a PowerPoint slide. Slides are image-based, not editable native text shapes."
      path="/pdf-to-pptx"
      howItWorks={[
        'Upload the PDF you want as a presentation.',
        'Choose a page range and render scale.',
        'Download a .pptx with one image slide per page.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Output slides contain page images — text is not editable in PowerPoint.',
        'Higher scale improves clarity but uses more memory and produces larger files.',
        'Encrypted PDFs must be unlocked first.',
      ]}
      faqs={[
        {
          question: 'Can I edit the slide text in PowerPoint?',
          answer:
            'Not as real text. Each page is a raster image on the slide. Use this for visual decks, not text editing.',
        },
        {
          question: 'Can I convert only some pages?',
          answer: 'Yes. Enter a page range such as 1-5 or 2,4,6 before exporting.',
        },
      ]}
      related={[
        { href: '/pdf-to-excel', label: 'PDF to Excel' },
        { href: '/pdf-to-jpg', label: 'PDF to JPG' },
        { href: '/office-to-pdf', label: 'Office to PDF' },
      ]}
    >
      <PdfToPptxTool />
    </ToolPageShell>
  );
}
