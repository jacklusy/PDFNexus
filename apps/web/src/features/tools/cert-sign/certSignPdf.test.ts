import { describe, expect, it } from 'vitest';
import {
  CERT_SIGN_CMS_GAP,
  CERT_SIGN_EXPERIMENTAL_NOTICE,
  parsePkcs12,
} from './certSignPdf';

describe('certSign honesty + parse errors', () => {
  it('labels experimental and denies Adobe validation', () => {
    const notice = CERT_SIGN_EXPERIMENTAL_NOTICE.toLowerCase();
    expect(notice).toMatch(/experimental/);
    expect(notice).toMatch(/not adobe-validated/);
    expect(CERT_SIGN_CMS_GAP.toLowerCase()).toMatch(/byterange|iso 32000/);
  });

  it('rejects invalid PKCS#12 bytes', () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    expect(() => parsePkcs12(junk, 'password')).toThrow();
  });
});
