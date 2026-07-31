/**
 * Allowlist URI schemes for PDF link annotations (viewer attack surface).
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function mailtoRestIsSafe(rest: string): boolean {
  let decoded = rest;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    return false;
  }
  if (!decoded.length) return false;
  // Reject CRLF / header injection and leftover control chars.
  if (/[\r\n\0<>"]/.test(decoded) || /[\r\n\0<>"]/.test(rest)) return false;
  if (/%0[ad]/i.test(rest) || /%0[ad]/i.test(decoded)) return false;
  if (/\s/.test(decoded)) return false;
  return true;
}

export function isAllowedLinkUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  try {
    // mailto: may not parse as absolute URL with URL() in all engines without base
    if (/^mailto:/i.test(trimmed)) {
      const rest = trimmed.slice(trimmed.indexOf(':') + 1);
      return mailtoRestIsSafe(rest);
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
