import { describe, expect, it } from 'vitest';
import {
  generateOtpCode,
  hashPassword,
  hashToken,
  parsePermissions,
  verifyPassword,
} from './admin-crypto';

describe('admin-crypto', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Admin@PDFNexus1!');
    expect(hash).not.toEqual('Admin@PDFNexus1!');
    expect(await verifyPassword('Admin@PDFNexus1!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('hashes tokens stably', () => {
    expect(hashToken('abc')).toEqual(hashToken('abc'));
    expect(hashToken('abc')).not.toEqual(hashToken('abcd'));
  });

  it('generates 6-digit otp', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('parses permissions json', () => {
    expect(parsePermissions('["a","b"]')).toEqual(['a', 'b']);
    expect(parsePermissions('nope')).toEqual([]);
  });
});
