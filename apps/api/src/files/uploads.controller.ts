import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ErrorCodes,
  initiateUploadSchema,
  uploadPartUrlsSchema,
  uploadReportPartSchema,
} from '@pdfnexus/shared';
import { CookieService } from '../auth/cookie.service';
import { clientIp } from '../common/utils/client-ip';
import { UploadsService } from './uploads.service';

const UPLOAD_TOKEN_HEADER = 'x-upload-token';

@Controller('files/uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly cookies: CookieService,
  ) {}

  /**
   * Start a direct-to-storage upload. Verified users authenticate via
   * cookie; first-time users supply an email (rate-limited) and receive
   * a claim link once the upload completes.
   */
  @Post('initiate')
  async initiate(@Body() body: unknown, @Req() req: Request) {
    const parsed = initiateUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid upload request',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const cookieEmail = this.cookies.readVerifiedEmail(req);
    const ownerEmail = cookieEmail ?? parsed.data.email;
    if (!ownerEmail) {
      throw new UnauthorizedException({
        error: 'Email verification or an email address is required',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }

    return this.uploads.initiate({
      ownerEmail,
      isFirstTimeEmailFlow: !cookieEmail,
      fileName: parsed.data.fileName,
      sizeBytes: parsed.data.sizeBytes,
      mimeType: parsed.data.mimeType,
      // First-time users can only receive the file via the claim email.
      sendEmail: parsed.data.sendEmail || !cookieEmail,
      clientIp: clientIp(req),
    });
  }

  @Post(':sessionId/part-urls')
  async partUrls(
    @Param('sessionId') sessionId: string,
    @Headers(UPLOAD_TOKEN_HEADER) token: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = uploadPartUrlsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid part numbers',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    return this.uploads.getPartUrls(
      sessionId,
      token,
      parsed.data.partNumbers,
      clientIp(req),
    );
  }

  @Post(':sessionId/parts/:partNumber')
  async reportPart(
    @Param('sessionId') sessionId: string,
    @Param('partNumber') partNumberRaw: string,
    @Headers(UPLOAD_TOKEN_HEADER) token: string | undefined,
    @Body() body: unknown,
  ) {
    const partNumber = Number.parseInt(partNumberRaw, 10);
    if (!Number.isInteger(partNumber) || partNumber < 1) {
      throw new BadRequestException({
        error: 'Invalid part number',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const parsed = uploadReportPartSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid part payload',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    return this.uploads.reportPart(
      sessionId,
      token,
      partNumber,
      parsed.data.etag,
    );
  }

  @Get(':sessionId')
  async status(
    @Param('sessionId') sessionId: string,
    @Headers(UPLOAD_TOKEN_HEADER) token: string | undefined,
  ) {
    return this.uploads.getStatus(sessionId, token);
  }

  @Post(':sessionId/complete')
  async complete(
    @Param('sessionId') sessionId: string,
    @Headers(UPLOAD_TOKEN_HEADER) token: string | undefined,
  ) {
    return this.uploads.complete(sessionId, token);
  }

  @Delete(':sessionId')
  @HttpCode(204)
  async abort(
    @Param('sessionId') sessionId: string,
    @Headers(UPLOAD_TOKEN_HEADER) token: string | undefined,
  ): Promise<void> {
    await this.uploads.abort(sessionId, token);
  }
}
