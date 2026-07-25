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
  FILE_INVALID: 'FILE_INVALID',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
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
  sessionId: z.string().max(128).optional(),
});

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
