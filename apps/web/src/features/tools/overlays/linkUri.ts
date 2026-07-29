/**
 * Allowlist URI schemes for PDF link annotations (viewer attack surface).
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

export function isAllowedLinkUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  try {
    // mailto: may not parse as absolute URL with URL() in all engines without base
    if (/^mailto:/i.test(trimmed)) {
      const rest = trimmed.slice(7);
      return rest.length > 0 && !/[\s<>"]/.test(rest);
    }
    const parsed = new URL(trimmed);
    return ALLOWED_SCHEMES.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export function assertAllowedLinkUri(uri: string): string {
  const trimmed = uri.trim();
  if (!isAllowedLinkUri(trimmed)) {
    throw new Error(
      'Link URI must use http:, https:, or mailto: schemes only.'
    );
  }
  return trimmed;
}
