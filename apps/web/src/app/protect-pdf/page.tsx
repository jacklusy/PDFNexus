import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { ProtectTool } from '@/features/tools/protect/ProtectTool';

export const metadata: Metadata = pageMetadata({
  title: 'Protect PDF with Password — Encrypt PDF Online',
  description:
    'Add password protection and permission controls to your PDF. Set open passwords, restrict printing or editing, and encrypt locally in your browser.',
  path: '/protect-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Protect PDF"
      description="Encrypt a PDF with a user password and optional owner controls. Limit printing, editing, and content extraction before sharing sensitive documents."
      path="/protect-pdf"
      howItWorks={[
        'Upload the PDF you want to lock.',
        'Set a user password (required to open) and optional owner password.',
        'Choose permissions for printing and editing, then download the encrypted PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Uses 256-bit AES encryption via a local WASM engine.',
        'Choose a strong password — lost passwords cannot be recovered here.',
        'Some third-party viewers may ignore permission flags even when set.',
      ]}
      faqs={[
        {
          question: 'What is the difference between user and owner password?',
          answer:
            'The user password is required to open the file. The owner password controls permission changes; if omitted, the user password is reused.',
        },
        {
          question: 'Can I restrict printing?',
          answer:
            'Yes. You can allow full printing or block it entirely in the permission settings before encrypting.',
        },
        {
          question: 'Is my password sent to a server?',
          answer:
            'No. Encryption runs entirely in your browser; passwords never leave your device.',
        },
      ]}
      related={[
        { href: '/unlock-pdf', label: 'Unlock PDF' },
        { href: '/watermark-pdf', label: 'Watermark PDF' },
        { href: '/sign-pdf', label: 'Sign PDF' },
      ]}
    >
      <ProtectTool />
    </ToolPageShell>
  );
}
