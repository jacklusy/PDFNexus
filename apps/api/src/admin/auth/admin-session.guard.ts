import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '@pdfnexus/shared';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminCookieService } from './admin-cookie.service';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import { parsePermissions } from './admin-crypto';

export type AdminRequestUser = {
  id: string;
  email: string;
  roleName: string;
  permissions: string[];
  sessionId: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    adminUser?: AdminRequestUser;
  }
}

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly cookies: AdminCookieService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const tokenHash = this.cookies.tokenHashFromRequest(req);
    if (!tokenHash) {
      throw new UnauthorizedException({
        error: 'Admin authentication required',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }

    const session = await this.auth.resolveSession(tokenHash);
    if (!session) {
      throw new UnauthorizedException({
        error: 'Admin authentication required',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }

    const permissions = parsePermissions(session.user.role.permissions);
    req.adminUser = {
      id: session.user.id,
      email: session.user.email,
      roleName: session.user.role.name,
      permissions,
      sessionId: session.id,
    };

    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required?.length) {
      const ok = required.every((p) => permissions.includes(p));
      if (!ok) {
        throw new ForbiddenException({
          error: 'Insufficient admin permissions',
          code: ErrorCodes.AUTH_FORBIDDEN,
        });
      }
    }

    return true;
  }
}
