import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthEmailService } from './auth-email.service';
import { CookieService } from './cookie.service';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

@Controller('auth')
export class AuthEmailController {
  constructor(
    private readonly auth: AuthEmailService,
    private readonly cookies: CookieService,
  ) {}

  @Post('request-otp')
  requestOtp(@Body() body: unknown, @Req() req: Request) {
    return this.auth.requestOtp(body, clientIp(req));
  }

  @Post('verify')
  verify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.verifyOtp(body, clientIp(req), res);
  }

  @Get('me')
  me(@Req() req: Request) {
    const email = this.cookies.readVerifiedEmail(req);
    return this.auth.me(email);
  }
}
