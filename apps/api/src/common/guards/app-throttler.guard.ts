import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Skip rate limiting for CORS preflight — OPTIONS must always succeed so
 * the browser can send the real credentialed request.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ method?: string }>();
    if (req?.method === 'OPTIONS') {
      return true;
    }
    return super.canActivate(context);
  }
}
