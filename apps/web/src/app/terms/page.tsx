import type { Metadata } from 'next';
import { ContentPage } from '@/components/ContentPage';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of use for PDFNexus.',
};

export default function TermsPage() {
  return (
    <ContentPage title="Terms of use">
      <p>
        PDFNexus is provided as-is for merging and organizing documents. You are responsible for
        ensuring you have rights to process any files you upload or convert.
      </p>
      <p>
        Do not use the service to process illegal content or to abuse verification, OCR, or upload
        endpoints. We may rate-limit or block abusive traffic.
      </p>
      <p>
        Final file storage is temporary. Keep your own copies of important documents. Features may
        change as the product evolves.
      </p>
    </ContentPage>
  );
}
