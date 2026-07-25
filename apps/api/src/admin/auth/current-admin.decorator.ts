import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminRequestUser } from './admin-session.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminRequestUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.adminUser!;
  },
);
