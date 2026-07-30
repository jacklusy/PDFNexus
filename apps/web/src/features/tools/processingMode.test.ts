import { describe, expect, it } from 'vitest';
import {
  PROCESSING_MODE_BADGE,
  badgeForProcessingMode,
  defaultPrivacyNote,
} from './processingMode';

describe('processingMode', () => {
  it('maps Task.md labels', () => {
    expect(PROCESSING_MODE_BADGE.local).toBe('Processed locally');
    expect(PROCESSING_MODE_BADGE.server).toBe('Cloud processing required');
    expect(PROCESSING_MODE_BADGE.cloud_assisted).toBe('Cloud-assisted');
  });

  it('adds experimental suffix', () => {
    expect(badgeForProcessingMode('local', true)).toBe(
      'Processed locally · experimental'
    );
  });

  it('mentions upload for server/cloud modes', () => {
    expect(defaultPrivacyNote('server')).toMatch(/uploads/i);
    expect(defaultPrivacyNote('cloud_assisted')).toMatch(/uploads/i);
    expect(defaultPrivacyNote('local')).toMatch(/never leaves/i);
  });
});
