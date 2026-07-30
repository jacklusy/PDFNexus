import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { UnlockTool } from '@/features/tools/unlock/UnlockTool';

export const metadata: Metadata = pageMetadata({
  title: 'Unlock PDF — Remove PDF Password Online',
  description:
    'Open a password-protected PDF and save an unlocked copy you can edit or merge. Enter the correct password — decryption runs locally, no upload.',
  path: '/unlock-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Unlock PDF"
      description="Remove open-password protection from a PDF when you know the password. Download an unencrypted copy for editing, merging, or archiving."
      path="/unlock-pdf"
      howItWorks={[
        'Upload the password-protected PDF.',
        'Enter the password required to open the document.',
        'Unlock and download a new PDF without password protection.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'You must know the correct open password; this tool does not crack passwords.',
        'Permission-only restrictions without an open password may not be removable here.',
        'Large encrypted files may take longer to decrypt in the browser.',
      ]}
      faqs={[
        {
          question: 'Can this recover a forgotten password?',
          answer:
            'No. Unlock only works when you supply the correct password. There is no brute-force or recovery mode.',
        },
        {
          question: 'Will unlocking change the content?',
          answer:
            'Page content stays the same; only encryption metadata is removed so the file opens without a password.',
        },
        {
          question: 'Is it legal to unlock a PDF?',
          answer:
            'Only unlock documents you own or are authorized to access. Removing protection without permission may violate policy or law.',
        },
      ]}
      related={[
        { href: '/protect-pdf', label: 'Protect PDF' },
        { href: '/edit-pdf', label: 'Add text & shapes' },
        { href: '/extract-pdf-pages', label: 'Extract pages' },
      ]}
    >
      <UnlockTool />
    </ToolPageShell>
  );
}
