import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { CertSignTool } from '@/features/tools/cert-sign/CertSignTool';

export const metadata: Metadata = pageMetadata({
  title: 'Certificate Sign PDF (Experimental) — PKCS#12 + Detached PKCS#7',
  description:
    'Experimental certificate signing: PKCS#12 appearance, signer PEM, and detached PKCS#7 attachment. Not Adobe-validated ByteRange CMS. Distinct from visual Sign PDF.',
  path: '/cert-sign-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Certificate sign (experimental)"
      description="Import a PKCS#12 certificate and apply an experimental crypto-intent appearance plus a detached PKCS#7 artifact. This is not Adobe-validated PDF signing."
      path="/cert-sign-pdf"
      howItWorks={[
        'Upload the PDF you want to mark with certificate intent.',
        'Select your .p12 / .pfx file and enter its password (never logged).',
        'Confirm the experimental appearance, then download the PDF with CN stamp, signer.pem, and optional signature-detached.p7s.',
      ]}
      privacyNote="Runs in your browser. Certificate password and PKCS#12 never leave your device."
      limits={[
        'Experimental — not ISO 32000 /ByteRange CMS embedded in the PDF.',
        'Adobe Reader will not show a green validated digital signature.',
        'No TSA timestamps or LTV/PAdES long-term validation.',
        'Distinct from /sign-pdf visual electronic stamps.',
      ]}
      faqs={[
        {
          question: 'Will Adobe Reader validate this signature?',
          answer:
            'No. We attach a detached PKCS#7 over the original bytes and a PEM, but we do not embed a PDF signature dictionary with ByteRange. Do not claim Adobe-valid signing.',
        },
        {
          question: 'Is this a legally binding digital signature?',
          answer:
            'No compliance claim is made. Full CMS byte-range signing, TSA, and LTV are out of scope for this MVP.',
        },
        {
          question: 'How is this different from Sign PDF?',
          answer:
            'Sign PDF adds a typed or drawn visual stamp. Certificate sign uses a real PKCS#12 to show CN, attach PEM/PKCS#7 artifacts, with clear experimental labeling.',
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
