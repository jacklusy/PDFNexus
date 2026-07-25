import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCodes } from '@pdfnexus/shared';
import type { Request } from 'express';

export type VerifiedRequest = Request & { verifiedEmail?: string };

export const VerifiedEmail = createParamDecorator(
  (required: boolean | undefined, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<VerifiedRequest>();
    const email = request.verifiedEmail;
    if (required !== false && !email) {
      throw new UnauthorizedException({
        error: 'Email verification required',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return email;
  },
);
