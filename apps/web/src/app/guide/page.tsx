import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/ContentPage';

export const metadata: Metadata = {
  title: 'Guide',
  description: 'How to merge and organize PDFs with PDFNexus.',
};

export default function GuidePage() {
  return (
    <ContentPage title="Guide">
      <ol className="list-decimal space-y-3 pl-5">
        <li>
          Open the{' '}
          <Link href="/workspace" className="font-semibold text-teal-800 hover:underline">
            workspace
          </Link>{' '}
          and drop PDFs or images.
        </li>
        <li>Drag cards to reorder. Use shift-click to multi-select for bulk rotate, clone, or delete.</li>
        <li>Insert blank pages or images between pages from each card&apos;s hover controls.</li>
        <li>Preview order, then Merge &amp; Download. Verify your email once to unlock delivery.</li>
        <li>Use Convert to Word for high-fidelity DOCX export (OCR for scanned pages when needed).</li>
      </ol>
      <p className="mt-6">
        Color-code source files from the sidebar palette. Full-screen preview supports keyboard
        arrows, zoom, and rotation.
      </p>
    </ContentPage>
  );
}
