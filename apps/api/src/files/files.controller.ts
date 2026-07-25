import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { CookieService } from '../auth/cookie.service';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly cookies: CookieService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @UseGuards(VerifiedEmailGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 52_428_800,
      },
    }),
  )
  async upload(
    @VerifiedEmail() email: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const max = this.config.get<number>('MAX_UPLOAD_BYTES') ?? 52_428_800;
    if (file && file.size > max) {
      throw new BadRequestException({
        error: 'File exceeds maximum upload size',
        code: 'FILE_TOO_LARGE',
      });
    }
    const sendEmail =
      req.body?.sendEmail === 'true' || req.body?.sendEmail === true;
    return this.files.upload(email, file, Boolean(sendEmail));
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
