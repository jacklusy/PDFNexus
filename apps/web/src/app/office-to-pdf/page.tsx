import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { OfficeToPdfTool } from '@/features/tools/office-to-pdf/OfficeToPdfTool';

export const metadata: Metadata = pageMetadata({
  title: 'Office to PDF — Convert DOCX, XLSX, PPTX Online',
  description:
    'Convert Word, Excel, or PowerPoint files to PDF with explicit consent. Files are uploaded to the conversion server only after you agree — never silently.',
  path: '/office-to-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Office to PDF"
      description="Convert .docx, .xlsx, or .pptx to PDF. Requires consent before upload to the LibreOffice conversion server (Gotenberg)."
      path="/office-to-pdf"
      howItWorks={[
        'Choose a Word, Excel, or PowerPoint file (max 25MB).',
        'Check the consent box acknowledging the file will be uploaded to the conversion server.',
        'Convert and download the resulting PDF to your device.',
      ]}
      privacyNote="This tool uploads your file only after explicit consent. Local-first PDF tools on this site never upload without asking."
      limits={[
        'Accepted formats: .docx, .xlsx, .pptx (max 25MB).',
        'Requires the Gotenberg conversion service to be running.',
        'Complex layouts may differ slightly from the original Office app.',
      ]}
      faqs={[
        {
          question: 'Why does this need a server?',
          answer:
            'Faithful Office layout conversion needs LibreOffice. Browser engines are not reliable enough for production conversion, so we use Gotenberg with explicit consent.',
        },
        {
          question: 'Is my file stored?',
          answer:
            'The API proxies the file to Gotenberg for conversion and returns the PDF. Files are not kept as long-term storage for this endpoint.',
        },
      ]}
      related={[
        { href: '/pdf-to-jpg', label: 'PDF to JPG' },
        { href: '/jpg-to-pdf', label: 'JPG to PDF' },
        { href: '/compress-pdf', label: 'Compress PDF' },
      ]}
    >
      <OfficeToPdfTool />
    </ToolPageShell>
  );
}
