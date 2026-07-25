import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { FeedbackForm } from '@/features/feedback';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Send feedback to the PDFNexus team.',
};

export default function FeedbackPage() {
  return (
    <div className="min-h-screen atmosphere-light">
      <SiteHeader />
      <main className="px-6 py-12 md:px-10">
        <FeedbackForm />
      </main>
      <SiteFooter />
    </div>
  );
}
