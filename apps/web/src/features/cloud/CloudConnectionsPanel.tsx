'use client';

import React from 'react';
import { GoogleDrivePanel } from './GoogleDrivePanel';
import { GenericCloudPanel } from './GenericCloudPanel';

export interface CloudConnectionsPanelProps {
  onImport?: (file: File) => void;
  exportFile?: File | null;
  className?: string;
}

/**
 * Optional cloud import/export. Local download remains primary — these are never required.
 */
export function CloudConnectionsPanel({
  onImport,
  exportFile = null,
  className,
}: CloudConnectionsPanelProps) {
  return (
    <div className={className ?? 'space-y-4'}>
      <p className="text-sm text-[var(--color-muted)]">
        Cloud connections are optional. Local tools download immediately without
        connecting any provider.
      </p>
      <GoogleDrivePanel onImport={onImport} exportFile={exportFile} />
      <GenericCloudPanel
        provider="dropbox"
        title="Dropbox"
        description="Optional Dropbox import/export (files.content.read/write). Never required."
        onImport={onImport}
        exportFile={exportFile}
      />
      <GenericCloudPanel
        provider="onedrive"
        title="OneDrive"
        description="Optional OneDrive app-folder import/export (Files.ReadWrite.AppFolder). Never required."
        onImport={onImport}
        exportFile={exportFile}
      />
    </div>
  );
}
