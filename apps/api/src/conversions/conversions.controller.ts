import {
  BadRequestException,
  Controller,
  HttpException,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ErrorCodes } from '@pdfnexus/shared';
import { SameOriginGuard } from '../ocr/same-origin.guard';
import { ConversionsService } from './conversions.service';

const MAX_OFFICE_BYTES = 25 * 1024 * 1024;

const OFFICE_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Some browsers send generic types
  'application/octet-stream',
  'application/zip',
]);

const OFFICE_EXT = /\.(docx|xlsx|pptx)$/i;

function isOfficeFile(file: Express.Multer.File): boolean {
  const nameOk = OFFICE_EXT.test(file.originalname || '');
  const mimeOk =
    !file.mimetype ||
    OFFICE_MIME.has(file.mimetype) ||
    file.mimetype.startsWith('application/vnd.openxmlformats');
  return nameOk && mimeOk;
}

@Controller('conversions')
@UseGuards(SameOriginGuard)
export class ConversionsController {
  constructor(private readonly conversions: ConversionsService) {}

  @Post('office-to-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_OFFICE_BYTES, files: 1 },
    }),
  )
  async officeToPdf(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_OFFICE_BYTES }),
        ],
        fileIsRequired: true,
        exceptionFactory: (error) => {
          const msg = typeof error === 'string' ? error : 'Invalid file upload';
          if (/size|large|max/i.test(msg)) {
            return new BadRequestException({
              error: 'File exceeds the 25MB limit',
              code: ErrorCodes.FILE_TOO_LARGE,
            });
          }
          return new BadRequestException({
            error: 'An Office file is required (docx, xlsx, or pptx)',
            code: ErrorCodes.FILE_INVALID,
          });
        },
      }),
    )
    file: Express.Multer.File,
  ): Promise<StreamableFile> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        error: 'Empty file',
        code: ErrorCodes.FILE_INVALID,
      });
    }

    if (!isOfficeFile(file)) {
      throw new BadRequestException({
        error: 'Only .docx, .xlsx, and .pptx files are accepted',
        code: ErrorCodes.FILE_INVALID,
      });
    }

    try {
      const pdf = await this.conversions.officeToPdf(
        file.buffer,
        file.originalname,
      );
      const baseName = file.originalname.replace(/\.[^.]+$/, '') || 'document';
      const safeName = baseName.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120);

      return new StreamableFile(pdf, {
        type: 'application/pdf',
        disposition: `attachment; filename="${safeName}.pdf"`,
        length: pdf.length,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        {
          error: 'Conversion failed',
          code: 'CONVERSION_FAILED',
        },
        502,
      );
    }
  }
}
