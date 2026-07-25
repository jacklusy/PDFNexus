import {
  Body,
  Controller,
  HttpException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ErrorCodes } from '@pdfnexus/shared';
import { RedisService } from '../redis/redis.service';
import { OcrService } from './ocr.service';
import { SameOriginGuard } from './same-origin.guard';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

@Controller('pdf-to-docx')
@UseGuards(SameOriginGuard)
export class OcrController {
  constructor(
    private readonly ocr: OcrService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Post('analyze-ocr')
  async analyzeOcr(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = clientIp(req);
    const windowMs =
      this.config.get<number>('OCR_RATE_LIMIT_WINDOW_MS') ?? 60_000;
    const rateMax = this.config.get<number>('OCR_RATE_LIMIT_MAX') ?? 20;
    const maxConcurrent = this.config.get<number>('OCR_MAX_CONCURRENT') ?? 2;
    const dailyBudget = this.config.get<number>('OCR_DAILY_BUDGET') ?? 500;
    const maxBase64 =
      this.config.get<number>('OCR_MAX_BASE64_CHARS') ?? 5_500_000;

    const rate = await this.redis.rateLimit(
      `ocr:rate:${ip}`,
      rateMax,
      windowMs,
    );
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      throw new HttpException(
        {
          error: 'Too many OCR requests. Please wait and try again.',
          code: ErrorCodes.RATE_LIMITED,
          fallback: true,
          retryAfterSec: rate.retryAfterSec,
        },
        429,
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const budgetKey = `ocr:budget:${today}`;
    const budget = await this.redis.consumeDailyBudget(budgetKey, dailyBudget);
    if (!budget.allowed) {
      throw new HttpException(
        {
          error:
            'Daily OCR budget exhausted. Native text extraction will still work.',
          code: ErrorCodes.BUDGET_EXCEEDED,
          fallback: true,
        },
        429,
      );
    }

    const concurrencyKey = 'ocr:concurrent';
    const acquired = await this.redis.acquireConcurrencySlot(
      concurrencyKey,
      maxConcurrent,
    );
    if (!acquired) {
      throw new HttpException(
        {
          error: 'OCR service is busy. Please retry shortly.',
          code: ErrorCodes.CONCURRENCY_LIMIT,
          fallback: true,
        },
        429,
      );
    }

    // Release concurrency exactly once (fixes double-release on finish+close)
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      void this.redis.releaseConcurrencySlot(concurrencyKey);
    };
    res.on('finish', releaseOnce);
    res.on('close', releaseOnce);

    try {
      const validated = this.ocr.validateBody(body, maxBase64);
      if (!validated.ok) {
        throw new HttpException(
          {
            error: validated.error,
            code: validated.code,
            fallback: true,
          },
          validated.status,
        );
      }

      if (!this.ocr.getGeminiKey()) {
        throw new HttpException(
          {
            error: 'OCR is not configured on this server.',
            code: 'AI_UNAVAILABLE',
            fallback: true,
          },
          503,
        );
      }

      return await this.ocr.analyze(
        validated.cleanBase64,
        validated.mimeType,
        validated.pageNumber,
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.ocr.safeLog(error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to analyze page with AI OCR';
      const isTimeout = /timed out/i.test(message);
      const status =
        (error as { status?: number })?.status ?? (isTimeout ? 504 : 500);
      const code =
        (error as { code?: string })?.code ??
        (isTimeout ? ErrorCodes.OCR_TIMEOUT : 'OCR_FAILED');
      throw new HttpException(
        {
          error: isTimeout ? 'OCR request timed out' : 'OCR analysis failed',
          code,
          fallback: true,
        },
        status,
      );
    }
  }
}
