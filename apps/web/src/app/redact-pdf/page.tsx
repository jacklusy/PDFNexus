import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { RedactTool } from '@/features/tools/redact/RedactTool';

export const metadata: Metadata = pageMetadata({
  title: 'Redact PDF Online — Remove Content Under Black Boxes',
  description:
    'Draw redaction regions and export a PDF with content removed under black boxes. Confirm the irreversible warning; optional phrase verify is heuristic. Local processing.',
  path: '/redact-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Redact PDF"
      description="Add rectangular redaction regions, confirm the irreversible warning, and export with content removed under black boxes. Phrase verify is a best-effort text-layer check."
      path="/redact-pdf"
      howItWorks={[
        'Upload the PDF that contains sensitive content.',
        'Add redaction rectangles by page and coordinates.',
        'Confirm the warning, export, then optionally verify phrases against the text layer.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Redaction is irreversible on the exported file — keep the original if needed.',
        'Coordinates are manual; there is no draw-on-preview canvas yet.',
        'Phrase verify scans the text layer only and may miss images or vector text.',
      ]}
      faqs={[
        {
          question: 'Is blacking out the same as true redaction?',
          answer:
            'This tool removes content under regions and paints black boxes. Always keep legal/compliance review for highly sensitive documents.',
        },
        {
          question: 'Why might verify still find a phrase?',
          answer:
            'Verify is heuristic on the text layer. Content outside redacted regions, or in images, can still match.',
        },
      ]}
      related={[
        { href: '/bates-numbering', label: 'Bates numbering' },
        { href: '/protect-pdf', label: 'Protect PDF' },
        { href: '/flatten-pdf', label: 'Flatten PDF' },
      ]}
    >
      <RedactTool />
    </ToolPageShell>
  );
}
