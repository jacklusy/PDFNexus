import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminSessionGuard } from './admin-session.guard';
import { CurrentAdmin } from './current-admin.decorator';
import type { AdminRequestUser } from './admin-session.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(body, req, res);
  }

  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }

  @Get('me')
  @UseGuards(AdminSessionGuard)
  me(@Req() req: Request) {
    return this.auth.me(req);
  }

  @Post('change-password/request')
  @UseGuards(AdminSessionGuard)
  requestPasswordChange(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.auth.requestPasswordChange(admin.id, body, req);
  }

  @Post('change-password/confirm')
  @UseGuards(AdminSessionGuard)
  confirmPasswordChange(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.auth.confirmPasswordChange(admin.id, body, req);
  }

  @Post('change-email/request')
  @UseGuards(AdminSessionGuard)
  requestEmailChange(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.auth.requestEmailChange(admin.id, body, req);
  }

  @Post('change-email/confirm')
  @UseGuards(AdminSessionGuard)
  confirmEmailChange(
    @CurrentAdmin() admin: AdminRequestUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.auth.confirmEmailChange(admin.id, body, req);
  }
}
