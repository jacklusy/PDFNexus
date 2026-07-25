import type { Metadata } from 'next';
import WorkspaceClient from './WorkspaceClient';

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Merge and organize PDFs locally with PDFNexus.',
};

export const dynamic = 'force-dynamic';

export default function WorkspacePage() {
  return <WorkspaceClient />;
}
