import type { Metadata } from 'next';
import { ContentPage } from '@/components/ContentPage';

export const metadata: Metadata = {
  title: 'About',
  description: 'About PDFNexus — local PDF merge and organize with verified delivery.',
};

export default function AboutPage() {
  return (
    <ContentPage title="About PDFNexus">
      <p>
        PDFNexus is a hybrid PDF toolkit: merge, reorder, rotate, duplicate, insert blanks and
        images, preview, and convert to Word entirely in your browser.
      </p>
      <p>
        When you download a final PDF or Word file, we ask you to verify your email. That unlocks
        secure storage, a download link, and optional email delivery — while source uploads stay
        on your device during editing.
      </p>
      <p>
        Optional OCR for scanned pages may send page images to our API for layout analysis. We do
        not log document contents or filenames in analytics.
      </p>
    </ContentPage>
  );
}
