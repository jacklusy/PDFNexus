import { apiFetch, apiPostJson, getApiBase } from '@/lib/api';

export type AdminMe = {
  id: string;
  email: string;
  status: string;
  role: string;
  permissions: string[];
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
};

export type Paginated<T> = {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
};

export type AdminOverview = {
  users: { total: number; active: number; newToday: number };
  files: { total: number; pdf: number; docx: number; storageBytes: number };
  operations: {
    successRate: number;
    failed: number;
    avgProcessingMs: number;
    apiRequests7d: number;
  };
  activity: {
    uploads: number;
    merges: number;
    conversions: number;
    downloads: number;
  };
  admin: { activeSessions: number };
  health: { openErrors: number; uptimeSec: number; queue?: unknown };
  generatedAt?: string;
};

export type AnalyticsReport = {
  from: string;
  to: string;
  filters: {
    type: string[];
    tool: string[];
    device: string[];
    browser: string[];
    country: string[];
    os: string[];
  };
  totalEvents: number;
  byType: Record<string, number>;
  byTool: Record<string, number>;
  byDevice: Record<string, number>;
  byBrowser: Record<string, number>;
  byCountry: Record<string, number>;
  byOs: Record<string, number>;
  byHour: Record<number, number>;
  activityByDay: Array<{ date: string; count: number }>;
  userGrowthByDay: Array<{ date: string; count: number }>;
  processingByDay: Array<{
    date: string;
    avgMs: number;
    count: number;
    failed: number;
  }>;
  storageByDay: Array<{ date: string; bytes: number }>;
  apiByDay: Array<{ date: string; count: number; errors: number }>;
  mostUsedFeatures: Array<{ name: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
};

export type HttpLogRow = {
  id: string;
  createdAt: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string | null;
  userEmail: string | null;
  adminUserId: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  authStatus: string | null;
  userAgent: string | null;
  referrer: string | null;
  errorMessage: string | null;
  queryJson: string | null;
  bodyJson: string | null;
};

export type QueryValue = string | number | boolean | undefined | null;

function qs(params?: Record<string, QueryValue | string[]>) {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','));
    } else {
      q.set(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function adminLogin(email: string, password: string) {
  return apiPostJson<AdminMe>('/api/admin/auth/login', { email, password });
}

export async function adminLogout() {
  return apiPostJson<{ ok: boolean }>('/api/admin/auth/logout', {});
}

export async function adminMe(signal?: AbortSignal) {
  return apiFetch<AdminMe>('/api/admin/auth/me', { signal });
}

export async function adminOverview(signal?: AbortSignal) {
  return apiFetch<AdminOverview>('/api/admin/overview', { signal });
}

export async function adminLogs(
  params?: Record<string, QueryValue>,
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<HttpLogRow>>(`/api/admin/logs${qs(params)}`, {
    signal,
  });
}

export async function adminUsers(
  params?: Record<string, QueryValue>,
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<Record<string, unknown>>>(
    `/api/admin/users${qs(params)}`,
    { signal },
  );
}

export async function adminUserDetail(id: string, signal?: AbortSignal) {
  return apiFetch<Record<string, unknown>>(`/api/admin/users/${id}`, {
    signal,
  });
}

export async function adminUpdateUserStatus(
  id: string,
  status: string,
  notes?: string,
) {
  return apiFetch<Record<string, unknown>>(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
}

export async function adminAnalytics(
  params?: Record<string, QueryValue | string[]>,
  signal?: AbortSignal,
) {
  return apiFetch<AnalyticsReport>(`/api/admin/analytics${qs(params)}`, {
    signal,
  });
}

export async function adminMonitoring(signal?: AbortSignal) {
  return apiFetch<Record<string, unknown>>('/api/admin/monitoring/snapshot', {
    signal,
  });
}

export async function adminAudit(
  params?: Record<string, QueryValue>,
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<Record<string, unknown>>>(
    `/api/admin/audit${qs(params)}`,
    { signal },
  );
}

export async function adminErrors(
  params?: Record<string, QueryValue>,
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<Record<string, unknown>>>(
    `/api/admin/errors${qs(params)}`,
    { signal },
  );
}

export async function adminResolveError(id: string) {
  return apiPostJson(`/api/admin/errors/${id}/resolve`, {});
}

export async function adminNotifications(
  params?: Record<string, QueryValue>,
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<Record<string, unknown>> & { unread: number }>(
    `/api/admin/notifications${qs(params)}`,
    { signal },
  );
}

export async function adminMarkNotificationRead(id: string) {
  return apiPostJson(`/api/admin/notifications/${id}/read`, {});
}

export async function adminMarkAllNotificationsRead() {
  return apiPostJson('/api/admin/notifications/read-all', {});
}

export async function adminSecurity(signal?: AbortSignal) {
  return apiFetch<Record<string, unknown>>('/api/admin/security', { signal });
}

export async function adminRequestPasswordChange(currentPassword: string) {
  return apiPostJson<{ ok: boolean; message: string; debugCode?: string }>(
    '/api/admin/auth/change-password/request',
    { currentPassword },
  );
}

export const adminChangePasswordRequest = adminRequestPasswordChange;

export async function adminConfirmPasswordChange(
  code: string,
  newPassword: string,
) {
  return apiPostJson('/api/admin/auth/change-password/confirm', {
    code,
    newPassword,
  });
}

export const adminChangePasswordConfirm = adminConfirmPasswordChange;

export async function adminRequestEmailChange(
  currentPassword: string,
  newEmail: string,
) {
  return apiPostJson<{ ok: boolean; message: string; debugCode?: string }>(
    '/api/admin/auth/change-email/request',
    { currentPassword, newEmail },
  );
}

export const adminChangeEmailRequest = adminRequestEmailChange;

export async function adminConfirmEmailChange(code: string) {
  return apiPostJson('/api/admin/auth/change-email/confirm', { code });
}

export const adminChangeEmailConfirm = adminConfirmEmailChange;

export function adminExportUrl(
  path: string,
  params?: Record<string, QueryValue | string[]>,
) {
  return `${getApiBase()}${path}${qs(params)}`;
}

/** Download authenticated export via fetch (cookies included). */
export async function adminDownload(
  path: string,
  params?: Record<string, QueryValue | string[]>,
  filename = 'export.bin',
) {
  const url = `${path}${qs(params)}`;
  const blob = await apiFetch<Blob>(url);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
