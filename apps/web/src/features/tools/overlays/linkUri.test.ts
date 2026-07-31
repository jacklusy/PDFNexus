import { describe, it, expect } from 'vitest';
import { isAllowedLinkUri, assertAllowedLinkUri } from './linkUri';

describe('linkUri allowlist', () => {
  it('allows http https mailto', () => {
    expect(isAllowedLinkUri('https://example.com/a')).toBe(true);
    expect(isAllowedLinkUri('http://example.com')).toBe(true);
    expect(isAllowedLinkUri('mailto:a@b.com')).toBe(true);
  });

  it('rejects dangerous schemes', () => {
    expect(isAllowedLinkUri('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkUri('file:///etc/passwd')).toBe(false);
    expect(isAllowedLinkUri('data:text/html,hi')).toBe(false);
    expect(isAllowedLinkUri('')).toBe(false);
  });

  it('rejects mailto header injection', () => {
    expect(isAllowedLinkUri('mailto:a@b.com%0aBcc:evil@x.com')).toBe(false);
    expect(isAllowedLinkUri('mailto:a@b.com%0d%0aCc:x@y.com')).toBe(false);
    expect(isAllowedLinkUri('mailto:a@b.com\nbad')).toBe(false);
  });

  it('assertAllowedLinkUri throws', () => {
    expect(() => assertAllowedLinkUri('javascript:x')).toThrow(/http/);
  });
});
