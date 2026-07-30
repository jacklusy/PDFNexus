import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ContentPage } from '@/components/ContentPage';
import { CloudConnectionsClient } from './CloudConnectionsClient';

export const metadata: Metadata = pageMetadata({
  title: 'Optional cloud connections — Drive, Dropbox, OneDrive',
  description:
    'Connect Google Drive, Dropbox, or OneDrive for optional PDF import/export. Local tools never require cloud accounts.',
  path: '/cloud',
});

export default function CloudPage() {
  return (
    <ContentPage
      title="Cloud connections"
      description="Optional import and export only. Local PDF tools download immediately without any cloud account."
    >
      <CloudConnectionsClient />
    </ContentPage>
  );
}
