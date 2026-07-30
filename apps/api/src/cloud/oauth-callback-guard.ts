/**
 * OAuth login-CSRF guard: the browser completing the callback must already
 * hold the same session cookie that started `auth-url` (stored in OAuth state).
 */
export function oauthCallbackSessionMatches(
  cookieSession: string | null | undefined,
  stateSession: string,
): boolean {
  return Boolean(
    cookieSession &&
      cookieSession.length >= 16 &&
      cookieSession === stateSession,
  );
}
