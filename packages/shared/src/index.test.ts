import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  requestOtpSchema,
  verifyOtpSchema,
  feedbackSchema,
  analyticsEventSchema,
  ErrorCodes,
} from '../src/index';

describe('@pdfnexus/shared schemas', () => {
  it('normalizes email', () => {
    const parsed = emailSchema.parse('  User@Example.COM ');
    expect(parsed).toBe('user@example.com');
  });

  it('validates OTP request', () => {
    expect(() => requestOtpSchema.parse({ email: 'bad' })).toThrow();
    expect(requestOtpSchema.parse({ email: 'a@b.co' }).email).toBe('a@b.co');
  });

  it('requires 6-digit code', () => {
    expect(() => verifyOtpSchema.parse({ email: 'a@b.co', code: '12' })).toThrow();
    expect(verifyOtpSchema.parse({ email: 'a@b.co', code: '123456' }).code).toBe('123456');
  });

  it('validates feedback', () => {
    const ok = feedbackSchema.parse({
      type: 'bug',
      message: 'Merge fails on blank pages',
    });
    expect(ok.type).toBe('bug');
  });

  it('validates analytics events', () => {
    const ok = analyticsEventSchema.parse({ type: 'merge', tool: 'workspace' });
    expect(ok.type).toBe('merge');
  });

  it('exports error codes', () => {
    expect(ErrorCodes.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
    expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');
  });
});
