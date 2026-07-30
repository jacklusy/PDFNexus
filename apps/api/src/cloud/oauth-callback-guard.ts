import { timingSafeEqual } from 'crypto';

/**
 * OAuth login-CSRF guard: the browser completing the callback must already
 * hold the same session cookie that started `auth-url` (stored in OAuth state).
 * Uses timing-safe compare when lengths match.
 */
export function oauthCallbackSessionMatches(
  cookieSession: string | null | undefined,
  stateSession: string,
): boolean {
  if (
    !cookieSession ||
    cookieSession.length < 16 ||
    cookieSession.length !== stateSession.length
  ) {
    return false;
  }
  try {
    return timingSafeEqual(
      Buffer.from(cookieSession, 'utf8'),
      Buffer.from(stateSession, 'utf8'),
    );
  } catch {
    return false;
  }
}
