import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { OverlayTool } from '@/features/tools/overlays/OverlayTool';

export const metadata: Metadata = pageMetadata({
  title: 'Watermark PDF Online — Add Text Watermark Free',
  description:
    'Stamp CONFIDENTIAL, DRAFT, or custom text across PDF pages. Diagonal tiled watermarks applied locally — no upload, instant download.',
  path: '/watermark-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Watermark PDF"
      description="Apply a semi-transparent text watermark across every page. Use presets like Confidential or Draft, or enter your own label."
      path="/watermark-pdf"
      howItWorks={[
        'Upload the PDF to watermark.',
        'Enter watermark text or pick a preset, and choose tiled or single placement.',
        'Apply to all pages and download the watermarked PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Text watermarks only on this page; image logos use the workspace.',
        'Opacity and angle use sensible defaults for readability under content.',
        'Watermarks are flattened on export and cannot be toggled off afterward.',
      ]}
      faqs={[
        {
          question: 'Does the watermark appear on every page?',
          answer:
            'Yes. The watermark is applied across all pages in the document when you export.',
        },
        {
          question: 'Can I use my company name?',
          answer:
            'Enter any custom text in the watermark field — for example your company name, project code, or status label.',
        },
        {
          question: 'Will a watermark stop copying?',
          answer:
            'Watermarks deter casual sharing but are not a security control. Combine with Protect PDF for password encryption.',
        },
      ]}
      related={[
        { href: '/protect-pdf', label: 'Protect PDF' },
        { href: '/sign-pdf', label: 'Sign PDF' },
        { href: '/page-numbers-pdf', label: 'Page numbers' },
      ]}
    >
      <OverlayTool mode="watermark" />
    </ToolPageShell>
  );
}
