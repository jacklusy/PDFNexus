import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCodes } from '@pdfnexus/shared';
import { CookieService } from '../../auth/cookie.service';
import type { VerifiedRequest } from '../decorators/verified-email.decorator';

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly cookies: CookieService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<VerifiedRequest>();
    const email = this.cookies.readVerifiedEmail(request);
    if (!email) {
      throw new UnauthorizedException({
        error: 'Email verification required',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    request.verifiedEmail = email;
    return true;
  }
}
