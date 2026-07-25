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

function qs(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
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

export async function adminMe() {
  return apiFetch<AdminMe>('/api/admin/auth/me');
}

export async function adminOverview() {
  return apiFetch<any>('/api/admin/overview');
}

export async function adminLogs(params?: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<any>>(`/api/admin/logs${qs(params)}`);
}

export async function adminUsers(params?: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<any>>(`/api/admin/users${qs(params)}`);
}

export async function adminUserDetail(id: string) {
  return apiFetch<any>(`/api/admin/users/${id}`);
}

export async function adminUpdateUserStatus(
  id: string,
  status: string,
  notes?: string,
) {
  return apiFetch<any>(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
}

export async function adminAnalytics(params?: Record<string, string | number | undefined>) {
  return apiFetch<any>(`/api/admin/analytics${qs(params)}`);
}

export async function adminMonitoring() {
  return apiFetch<any>('/api/admin/monitoring/snapshot');
}

export async function adminAudit(params?: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<any>>(`/api/admin/audit${qs(params)}`);
}

export async function adminErrors(params?: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<any>>(`/api/admin/errors${qs(params)}`);
}

export async function adminResolveError(id: string) {
  return apiPostJson(`/api/admin/errors/${id}/resolve`, {});
}

export async function adminNotifications(params?: Record<string, string | number | boolean | undefined>) {
  return apiFetch<Paginated<any> & { unread: number }>(
    `/api/admin/notifications${qs(params)}`,
  );
}

export async function adminMarkNotificationRead(id: string) {
  return apiPostJson(`/api/admin/notifications/${id}/read`, {});
}

export async function adminMarkAllNotificationsRead() {
  return apiPostJson('/api/admin/notifications/read-all', {});
}

export async function adminSecurity() {
  return apiFetch<any>('/api/admin/security');
}

export async function adminRequestPasswordChange(currentPassword: string) {
  return apiPostJson<{ ok: boolean; message: string; debugCode?: string }>(
    '/api/admin/auth/change-password/request',
    { currentPassword },
  );
}

export const adminChangePasswordRequest = adminRequestPasswordChange;

export async function adminConfirmPasswordChange(code: string, newPassword: string) {
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
  params?: Record<string, string | number | undefined>,
) {
  return `${getApiBase()}${path}${qs(params)}`;
}

/** Download authenticated export via fetch (cookies included). */
export async function adminDownload(
  path: string,
  params?: Record<string, string | number | undefined>,
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
