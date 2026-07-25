import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcryptjs';
import {
  ErrorCodes,
  requestOtpSchema,
  verifyOtpSchema,
} from '@pdfnexus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CookieService } from './cookie.service';
import type { Response } from 'express';
import { SEND_OTP_QUEUE } from '../jobs/job.constants';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const OTP_REQUEST_LIMIT = 5;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_VERIFY_LIMIT = 20;
const OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly cookies: CookieService,
    private readonly config: ConfigService,
    @InjectQueue(SEND_OTP_QUEUE) private readonly otpQueue: Queue,
  ) {}

  async requestOtp(body: unknown, clientIp: string) {
    const parsed = requestOtpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid email',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const email = parsed.data.email;
    const rateKey = `auth:otp:request:${clientIp}:${email}`;
    const limit = await this.redis.rateLimit(
      rateKey,
      OTP_REQUEST_LIMIT,
      OTP_REQUEST_WINDOW_MS,
    );
    if (!limit.allowed) {
      throw new HttpException(
        {
          error: 'Too many OTP requests. Please wait and try again.',
          code: ErrorCodes.RATE_LIMITED,
          retryAfterSec: limit.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.emailVerification.create({
      data: { email, codeHash, expiresAt },
    });

    await this.otpQueue.add(
      'send-otp',
      { email, code },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    return {
      ok: true,
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
      ...(isDev ? { debugCode: code } : {}),
    };
  }

  async verifyOtp(body: unknown, clientIp: string, res: Response) {
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid verification payload',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const { email, code } = parsed.data;
    const rateKey = `auth:otp:verify:${clientIp}:${email}`;
    const limit = await this.redis.rateLimit(
      rateKey,
      OTP_VERIFY_LIMIT,
      OTP_VERIFY_WINDOW_MS,
    );
    if (!limit.allowed) {
      throw new HttpException(
        {
          error: 'Too many verification attempts',
          code: ErrorCodes.RATE_LIMITED,
          retryAfterSec: limit.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const record = await this.prisma.emailVerification.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException({
        error: 'No active verification code',
        code: ErrorCodes.AUTH_INVALID_CODE,
      });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        error: 'Verification code expired',
        code: ErrorCodes.AUTH_EXPIRED,
      });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException({
        error: 'Too many invalid attempts',
        code: ErrorCodes.AUTH_TOO_MANY_ATTEMPTS,
      });
    }

    const match = await bcrypt.compare(code, record.codeHash);
    if (!match) {
      await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException({
        error: 'Invalid verification code',
        code: ErrorCodes.AUTH_INVALID_CODE,
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { consumedAt: now },
      }),
      this.prisma.verifiedUser.upsert({
        where: { email },
        create: {
          email,
          verifiedAt: now,
          lastSeenAt: now,
        },
        update: {
          verifiedAt: now,
          lastSeenAt: now,
        },
      }),
    ]);

    this.cookies.setVerifiedEmail(res, email);
    return { ok: true, email };
  }

  async me(email: string | null) {
    if (!email) {
      return { authenticated: false };
    }

    const user = await this.prisma.verifiedUser.findUnique({
      where: { email },
    });
    if (!user) {
      return { authenticated: false };
    }

    await this.prisma.verifiedUser.update({
      where: { email },
      data: { lastSeenAt: new Date() },
    });

    return {
      authenticated: true,
      email: user.email,
      verifiedAt: user.verifiedAt.toISOString(),
    };
  }
}
