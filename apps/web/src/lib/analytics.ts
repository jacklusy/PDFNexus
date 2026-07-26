import type { AnalyticsEventInput } from '@pdfnexus/shared';
import { getApiBase } from './api';

const SESSION_KEY = 'pdfnexus:session-id';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function detectDevice(): AnalyticsEventInput['device'] {
  if (typeof window === 'undefined') return 'unknown';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'edge';
  if (ua.includes('Chrome/')) return 'chrome';
  if (ua.includes('Firefox/')) return 'firefox';
  if (ua.includes('Safari/')) return 'safari';
  return 'other';
}

function detectOs(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return 'other';
}

/** Fire-and-forget analytics — never blocks UI or throws to callers. */
export function trackEvent(
  type: AnalyticsEventInput['type'],
  extra?: Partial<Pick<AnalyticsEventInput, 'tool'>>
): void {
  if (typeof window === 'undefined') return;

  const payload: AnalyticsEventInput = {
    type,
    tool: extra?.tool,
    device: detectDevice(),
    browser: detectBrowser(),
    os: detectOs(),
    sessionId: getSessionId(),
  };

  const url = `${getApiBase()}/api/analytics/events`;
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // swallow
    });
  } catch {
    // swallow
  }
}

export function trackPageview(path?: string): void {
  trackEvent('pageview', path ? { tool: path } : undefined);
}
