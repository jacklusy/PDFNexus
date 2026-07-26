import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCodes } from '@pdfnexus/shared';
import { CookieService } from '../auth/cookie.service';
import { AuthEmailService } from '../auth/auth-email.service';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly cookies: CookieService,
    private readonly auth: AuthEmailService,
  ) {}

  /** Magic link from email: set verified cookie, then redirect to the file. */
  @Get('claim-download')
  async claimDownload(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException({
        error: 'Missing download token',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }

    const { email, redirectUrl } =
      await this.files.claimDownloadAndRedirect(token);
    await this.auth.markEmailVerified(email, res);
    return res.redirect(302, redirectUrl);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
  ) {
    const email = this.cookies.readVerifiedEmail(req);
    return this.files.getDownload(id, email, token);
  }
}
