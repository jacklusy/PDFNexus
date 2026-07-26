import { z } from 'zod';

export const ErrorCodes = {
  ORIGIN_REQUIRED: 'ORIGIN_REQUIRED',
  ORIGIN_INVALID: 'ORIGIN_INVALID',
  ORIGIN_FORBIDDEN: 'ORIGIN_FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  CONCURRENCY_LIMIT: 'CONCURRENCY_LIMIT',
  OCR_TIMEOUT: 'OCR_TIMEOUT',
  OCR_UNAVAILABLE: 'OCR_UNAVAILABLE',
  OCR_INVALID_BODY: 'OCR_INVALID_BODY',
  OCR_PAYLOAD_TOO_LARGE: 'OCR_PAYLOAD_TOO_LARGE',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_CODE: 'AUTH_INVALID_CODE',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_TOO_MANY_ATTEMPTS: 'AUTH_TOO_MANY_ATTEMPTS',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  FILE_INVALID: 'FILE_INVALID',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  UPLOAD_SESSION_INVALID: 'UPLOAD_SESSION_INVALID',
  UPLOAD_INCOMPLETE: 'UPLOAD_INCOMPLETE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const emailSchema = z.string().trim().email().max(254).toLowerCase();

export const requestOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
});

export const feedbackSchema = z.object({
  type: z.enum(['rating', 'bug', 'feature', 'comment']),
  rating: z.number().int().min(1).max(5).optional(),
  subject: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(5000),
  email: emailSchema.optional().nullable(),
});

export const analyticsEventSchema = z.object({
  type: z.enum([
    'pageview',
    'upload_local',
    'merge',
    'convert',
    'verify_start',
    'verify_success',
    'download',
    'feature_use',
  ]),
  tool: z.string().max(64).optional(),
  device: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).optional(),
  browser: z.string().max(64).optional(),
  os: z.string().max(64).optional(),
  sessionId: z.string().max(128).optional(),
});

/** Comma-separated query values → trimmed non-empty string array. */
const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v == null) return undefined;
    const parts = Array.isArray(v) ? v : v.split(',');
    const out = parts.map((s) => s.trim()).filter(Boolean);
    return out.length ? out : undefined;
  });

const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  });

const optionalBool = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((v) => {
    if (v == null || v === '') return undefined;
    if (typeof v === 'boolean') return v;
    return v === 'true' || v === '1';
  });

export const adminAnalyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  days: optionalInt,
  type: csvArray,
  tool: csvArray,
  device: csvArray,
  browser: csvArray,
  country: csvArray,
  os: csvArray,
  format: z.enum(['csv', 'xlsx', 'excel', 'pdf']).optional(),
});

export const adminLogsQuerySchema = z.object({
  page: optionalInt,
  pageSize: optionalInt,
  search: z.string().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
  statusMin: optionalInt,
  statusMax: optionalInt,
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(['asc', 'desc']).optional(),
  sortBy: z.enum(['createdAt', 'statusCode', 'durationMs']).optional(),
  os: z.string().optional(),
  browser: z.string().optional(),
  deviceType: z.string().optional(),
  authStatus: z.string().optional(),
  ip: z.string().optional(),
  userEmail: z.string().optional(),
  adminUserId: z.string().optional(),
  format: z.enum(['csv', 'xlsx', 'excel']).optional(),
});

export const adminAuditQuerySchema = z.object({
  page: optionalInt,
  pageSize: optionalInt,
  search: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  success: optionalBool,
  resourceType: z.string().optional(),
  actorEmail: z.string().optional(),
  format: z.enum(['csv', 'xlsx', 'excel']).optional(),
});

export const adminErrorsQuerySchema = z.object({
  page: optionalInt,
  pageSize: optionalInt,
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(['csv', 'xlsx', 'excel']).optional(),
});

export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;
export type AdminLogsQuery = z.infer<typeof adminLogsQuerySchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
export type AdminErrorsQuery = z.infer<typeof adminErrorsQuerySchema>;

export const ocrRequestSchema = z.object({
  imageBase64: z.string().min(1),
  pageNumber: z.number().int().min(1).max(10000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type OcrRequestInput = z.infer<typeof ocrRequestSchema>;

export const FILE_KINDS = ['merged_pdf', 'docx'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** Fixed multipart part size (uniform parts satisfy S3 and R2 constraints). */
export const UPLOAD_PART_SIZE_BYTES = 10 * 1024 * 1024;

export const initiateUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().max(255).optional().default(''),
  email: emailSchema.optional(),
  sendEmail: z.boolean().optional().default(false),
});

export const uploadPartUrlsSchema = z.object({
  partNumbers: z
    .array(z.number().int().min(1).max(10_000))
    .min(1)
    .max(25),
});

export const uploadReportPartSchema = z.object({
  etag: z.string().max(256).optional(),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;
export type UploadPartUrlsInput = z.infer<typeof uploadPartUrlsSchema>;
export type UploadReportPartInput = z.infer<typeof uploadReportPartSchema>;

export type UploadMode = 'single' | 'multipart';

export interface InitiateUploadResponse {
  sessionId: string;
  sessionToken: string;
  fileId: string;
  mode: UploadMode;
  partSize: number;
  totalParts: number;
}

export interface UploadPartUrl {
  partNumber: number;
  url: string;
}

export interface UploadSessionStatusResponse {
  status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'ABORTED' | 'FAILED';
  totalParts: number;
  completedParts: number[];
}

export interface CompleteUploadResponse {
  id: string;
  kind: string;
  originalName: string;
  sizeBytes: number;
  status: string;
  expiresAt: string;
  downloadUrl: string;
  emailQueued: boolean;
}

/** Laravel-style password: min 10, upper, lower, digit, special */
export const adminPasswordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[0-9]/, 'Must include a digit')
  .regex(/[^A-Za-z0-9]/, 'Must include a special character');

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const adminChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
});

export const adminChangePasswordConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  newPassword: adminPasswordSchema,
});

export const adminChangeEmailRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newEmail: emailSchema,
});

export const adminChangeEmailConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const ADMIN_PERMISSIONS = [
  'dashboard.read',
  'users.read',
  'users.write',
  'logs.read',
  'analytics.read',
  'analytics.export',
  'monitoring.read',
  'audit.read',
  'errors.read',
  'errors.write',
  'notifications.read',
  'security.read',
  'settings.write',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminChangePasswordRequestInput = z.infer<
  typeof adminChangePasswordRequestSchema
>;
export type AdminChangePasswordConfirmInput = z.infer<
  typeof adminChangePasswordConfirmSchema
>;
export type AdminChangeEmailRequestInput = z.infer<
  typeof adminChangeEmailRequestSchema
>;
export type AdminChangeEmailConfirmInput = z.infer<
  typeof adminChangeEmailConfirmSchema
>;
