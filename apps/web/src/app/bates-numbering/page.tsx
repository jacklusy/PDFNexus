import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { BatesTool } from '@/features/tools/bates/BatesTool';

export const metadata: Metadata = pageMetadata({
  title: 'Bates Numbering Online — Stamp Sequential PDF Labels',
  description:
    'Add prefix + zero-padded Bates numbers + suffix to PDF headers or footers. Continues from a locally stored next number. Runs in your browser.',
  path: '/bates-numbering',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Bates numbering"
      description="Stamp sequential Bates labels (prefix, zero-padded number, suffix) on selected pages. Remembers the next number in localStorage for continuity."
      path="/bates-numbering"
      howItWorks={[
        'Upload the PDF that needs Bates stamps.',
        'Set start number, pad width, prefix/suffix, and header or footer placement.',
        'Download the stamped PDF; the next number is saved locally for the next batch.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded. The next Bates number is stored only in this browser’s localStorage."
      limits={[
        'Stamps are drawn as text overlays — not cryptographic identifiers.',
        'Continuity depends on localStorage in this browser; clearing site data resets the counter.',
        'Encrypted PDFs must be unlocked first.',
      ]}
      faqs={[
        {
          question: 'Does the counter sync across devices?',
          answer:
            'No. The next number is stored in this browser only. Start from a known value if you switch machines.',
        },
        {
          question: 'Can I Bates only some pages?',
          answer: 'Yes. Enter a page range; unselected pages are left unchanged.',
        },
      ]}
      related={[
        { href: '/page-numbers-pdf', label: 'Page numbers' },
        { href: '/watermark-pdf', label: 'Watermark PDF' },
        { href: '/redact-pdf', label: 'Redact PDF' },
      ]}
    >
      <BatesTool />
    </ToolPageShell>
  );
}
