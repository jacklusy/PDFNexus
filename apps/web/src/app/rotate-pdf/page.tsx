import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { RotateTool } from '@/features/tools/simple/SimpleTools';

export const metadata: Metadata = pageMetadata({
  title: 'Rotate PDF Pages Online — Fix Orientation Free',
  description:
    'Rotate all pages in a PDF by 90°, 180°, or 270°. Fix scanned documents and sideways exports — local processing, instant download.',
  path: '/rotate-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Rotate PDF"
      description="Turn every page in a PDF clockwise or counter-clockwise. Fix upside-down scans and landscape pages in one step."
      path="/rotate-pdf"
      howItWorks={[
        'Upload the PDF with incorrect page orientation.',
        'Choose rotation angle: 90°, 180°, or 270°.',
        'Apply rotation to all pages and download the corrected PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Rotates every page in the document by the same angle.',
        'For mixed orientations per page, use the full workspace editor.',
        'Password-protected PDFs should be unlocked before rotating.',
      ]}
      faqs={[
        {
          question: 'Does rotation affect text selectability?',
          answer:
            'Rotation updates page orientation in the PDF structure; text and vectors remain selectable where they were before.',
        },
        {
          question: 'Can I rotate just one page?',
          answer:
            'This dedicated tool rotates all pages uniformly. Use the workspace for per-page rotation control.',
        },
        {
          question: 'Which direction is 90°?',
          answer:
            '90° rotates pages clockwise. Choose 270° for a counter-clockwise quarter turn, or 180° to flip upside down.',
        },
      ]}
      related={[
        { href: '/extract-pdf-pages', label: 'Extract pages' },
        { href: '/split-pdf', label: 'Split PDF' },
        { href: '/merge-pdf', label: 'Merge PDF' },
      ]}
    >
      <RotateTool />
    </ToolPageShell>
  );
}
