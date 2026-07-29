import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { OverlayTool } from '@/features/tools/overlays/OverlayTool';

export const metadata: Metadata = pageMetadata({
  title: 'Sign PDF Online — Add Electronic Signature to PDF',
  description:
    'Place a typed or drawn electronic signature stamp on any PDF page. Position, resize, and download — local processing, not a legally binding e-sign platform.',
  path: '/sign-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Sign PDF"
      description="Add an electronic signature stamp to your PDF. Type your name or draw a signature, place it on the page, and flatten it into the document."
      path="/sign-pdf"
      howItWorks={[
        'Upload the PDF you need to sign.',
        'Create a typed or drawn signature and place it on the correct page.',
        'Apply overlays and download the signed PDF with the stamp embedded.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Provides a visual electronic stamp, not a certified digital signature (PKI).',
        'Multi-page placement is supported; each stamp is placed manually.',
        'Flattening merges overlays into page content before download.',
      ]}
      faqs={[
        {
          question: 'Is this a legally binding e-signature?',
          answer:
            'This tool adds a visual stamp for convenience. For regulated contracts, use a qualified e-signature provider that meets your jurisdiction requirements.',
        },
        {
          question: 'Can I save my signature for reuse?',
          answer:
            'Yes. With consent, your typed signature can be stored locally in your browser for faster signing on future visits.',
        },
        {
          question: 'Will the signature be removable after download?',
          answer:
            'Overlays are flattened into the PDF page raster/content on export, making casual removal harder than a separate annotation layer.',
        },
      ]}
      related={[
        { href: '/edit-pdf', label: 'Edit PDF' },
        { href: '/watermark-pdf', label: 'Watermark PDF' },
        { href: '/protect-pdf', label: 'Protect PDF' },
      ]}
    >
      <OverlayTool mode="sign" />
    </ToolPageShell>
  );
}
