import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { CertSignTool } from '@/features/tools/cert-sign/CertSignTool';

export const metadata: Metadata = pageMetadata({
  title: 'Certificate Sign PDF (Experimental) — PKCS#12 Appearance',
  description:
    'Experimental certificate signing MVP: import a PKCS#12, stamp CN + date, attach signer PEM. Not a validated CMS digital signature. Distinct from visual Sign PDF.',
  path: '/cert-sign-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Certificate sign (experimental)"
      description="Import a PKCS#12 certificate and apply an experimental crypto-intent appearance. This is not the same as visual Sign PDF, and is not yet a validated CMS byte-range signature."
      path="/cert-sign-pdf"
      howItWorks={[
        'Upload the PDF you want to mark with certificate intent.',
        'Select your .p12 / .pfx file and enter its password (never logged).',
        'Confirm the experimental appearance, then download the PDF with CN stamp, metadata, and signer.pem attachment.',
      ]}
      privacyNote="Runs in your browser. Certificate password and PKCS#12 never leave your device."
      limits={[
        'Experimental MVP — not full CMS / PKCS#7 byte-range signing.',
        'Adobe and other viewers will not show a validated digital signature.',
        'Distinct from /sign-pdf visual electronic stamps.',
      ]}
      faqs={[
        {
          question: 'Is this a legally binding digital signature?',
          answer:
            'No. This MVP parses your certificate and embeds appearance + PEM. Full CMS byte-range signing and long-term validation are not implemented yet.',
        },
        {
          question: 'How is this different from Sign PDF?',
          answer:
            'Sign PDF adds a typed or drawn visual stamp. Certificate sign uses a real PKCS#12 to show CN and attach the certificate PEM, with clear experimental labeling.',
        },
        {
          question: 'What if my password is wrong?',
          answer:
            'You will see a clear error that the PKCS#12 password is wrong or the file is corrupted. The password is cleared from memory after each attempt.',
        },
      ]}
      related={[
        { href: '/sign-pdf', label: 'Sign PDF (visual)' },
        { href: '/protect-pdf', label: 'Protect PDF' },
        { href: '/flatten-pdf', label: 'Flatten PDF' },
      ]}
    >
      <CertSignTool />
    </ToolPageShell>
  );
}
