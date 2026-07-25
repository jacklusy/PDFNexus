import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  adminChangeEmailConfirmSchema,
  adminChangeEmailRequestSchema,
  adminChangePasswordConfirmSchema,
  adminChangePasswordRequestSchema,
  adminLoginSchema,
  ADMIN_PERMISSIONS,
  ErrorCodes,
} from '@pdfnexus/shared';
import { AdminOtpPurpose, AdminUserStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { AdminCookieService } from './admin-cookie.service';
import {
  clientIp,
  generateOtpCode,
  hashPassword,
  parsePermissions,
  verifyPassword,
} from './admin-crypto';
import * as bcrypt from 'bcryptjs';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly cookies: AdminCookieService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureRolesAndSeedAdmin();
  }

  private async ensureRolesAndSeedAdmin(): Promise<void> {
    const allPerms = JSON.stringify([...ADMIN_PERMISSIONS]);
    const viewerPerms = JSON.stringify(
      ADMIN_PERMISSIONS.filter((p) => p.endsWith('.read')),
    );

    const roles = [
      { name: 'SUPER_ADMIN', permissions: allPerms },
      { name: 'ADMIN', permissions: allPerms },
      { name: 'VIEWER', permissions: viewerPerms },
    ];

    for (const role of roles) {
      await this.prisma.role.upsert({
        where: { name: role.name },
        create: role,
        update: { permissions: role.permissions },
      });
    }

    const email = (this.config.get<string>('ADMIN_SEED_EMAIL') || '').trim();
    const password = this.config.get<string>('ADMIN_SEED_PASSWORD') || '';
    if (!email || !password) {
      this.logger.warn(
        'ADMIN_SEED_EMAIL/PASSWORD not set — no bootstrap admin created',
      );
      return;
    }

    const superRole = await this.prisma.role.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;

    const passwordHash = await hashPassword(password);
    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        roleId: superRole.id,
        status: AdminUserStatus.ACTIVE,
        passwordChangedAt: new Date(),
      },
    });
    this.logger.log(`Seeded SUPER_ADMIN ${email}`);
  }

  async login(body: unknown, req: Request, res: Response) {
    const parsed = adminLoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid credentials payload',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const ip = clientIp(req);
    const rate = await this.redis.rateLimit(
      `admin:login:${ip}`,
      20,
      15 * 60 * 1000,
    );
    if (!rate.allowed) {
      throw new HttpException(
        {
          error: 'Too many login attempts. Try again later.',
          code: ErrorCodes.RATE_LIMITED,
          retryAfterSec: rate.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const email = parsed.data.email;
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });

    const fail = async (reason: string) => {
      await this.audit.record({
        actorEmail: email,
        action: 'admin.login.failed',
        ip,
        userAgent: req.headers['user-agent'],
        after: { reason },
        success: false,
      });
      throw new UnauthorizedException({
        error: 'Invalid email or password',
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      });
    };

    if (!user) {
      await fail('unknown_email');
    }

    if (user!.status === AdminUserStatus.DISABLED) {
      await fail('disabled');
    }

    if (
      user!.lockedUntil &&
      user!.lockedUntil.getTime() > Date.now()
    ) {
      throw new UnauthorizedException({
        error: 'Account temporarily locked. Try again later.',
        code: ErrorCodes.AUTH_ACCOUNT_LOCKED,
      });
    }

    const ok = await verifyPassword(parsed.data.password, user!.passwordHash);
    if (!ok) {
      const max =
        this.config.get<number>('ADMIN_MAX_LOGIN_ATTEMPTS') ?? 5;
      const lockMinutes =
        this.config.get<number>('ADMIN_LOCKOUT_MINUTES') ?? 15;
      const attempts = user!.failedLoginAttempts + 1;
      const locked =
        attempts >= max
          ? new Date(Date.now() + lockMinutes * 60 * 1000)
          : null;
      await this.prisma.user.update({
        where: { id: user!.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: locked,
          status: locked ? AdminUserStatus.LOCKED : user!.status,
        },
      });
      if (locked) {
        await this.prisma.adminNotification.create({
          data: {
            type: 'security.lockout',
            severity: 'WARNING',
            title: 'Admin account locked',
            body: `${email} locked after ${attempts} failed logins from ${ip}`,
            metaJson: JSON.stringify({ email, ip }),
          },
        });
      }
      await fail('bad_password');
    }

    const { raw, hash, expiresAt } = this.cookies.createRawToken();
    await this.prisma.adminSession.create({
      data: {
        userId: user!.id,
        tokenHash: hash,
        ip,
        userAgent: req.headers['user-agent']?.slice(0, 512) ?? null,
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: user!.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: AdminUserStatus.ACTIVE,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    this.cookies.setSessionCookie(res, raw, expiresAt);
    await this.audit.record({
      actorUserId: user!.id,
      actorEmail: user!.email,
      action: 'admin.login',
      ip,
      userAgent: req.headers['user-agent'],
      success: true,
    });

    return this.serializeUser(user!);
  }

  async logout(req: Request, res: Response) {
    const tokenHash = this.cookies.tokenHashFromRequest(req);
    if (tokenHash) {
      const session = await this.prisma.adminSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (session && !session.revokedAt) {
        await this.prisma.adminSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        await this.audit.record({
          actorUserId: session.userId,
          actorEmail: session.user.email,
          action: 'admin.logout',
          ip: clientIp(req),
          userAgent: req.headers['user-agent'],
        });
      }
    }
    this.cookies.clearSessionCookie(res);
    return { ok: true };
  }

  async me(req: Request) {
    const tokenHash = this.cookies.tokenHashFromRequest(req);
    if (!tokenHash) {
      throw new UnauthorizedException({
        error: 'Admin authentication required',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    const session = await this.resolveSession(tokenHash);
    if (!session) {
      throw new UnauthorizedException({
        error: 'Admin authentication required',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return this.serializeUser(session.user);
  }

  async resolveSession(tokenHash: string) {
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });
    if (!session || session.revokedAt) return null;
    if (session.expiresAt.getTime() < Date.now()) return null;
    if (session.user.deletedAt) return null;
    if (session.user.status === AdminUserStatus.DISABLED) return null;
    return session;
  }

  private serializeUser(user: {
    id: string;
    email: string;
    status: AdminUserStatus;
    lastLoginAt: Date | null;
    passwordChangedAt: Date | null;
    createdAt: Date;
    role: { name: string; permissions: string };
  }) {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role.name,
      permissions: parsePermissions(user.role.permissions),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async createOtp(
    userId: string,
    purpose: AdminOtpPurpose,
    payload?: Record<string, unknown>,
  ) {
    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.adminOtpChallenge.create({
      data: {
        userId,
        purpose,
        codeHash,
        payload: payload ? JSON.stringify(payload) : null,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    return code;
  }

  private async consumeOtp(
    userId: string,
    purpose: AdminOtpPurpose,
    code: string,
  ) {
    const challenge = await this.prisma.adminOtpChallenge.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new BadRequestException({
        error: 'No pending verification challenge',
        code: ErrorCodes.AUTH_INVALID_CODE,
      });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        error: 'Verification code expired',
        code: ErrorCodes.AUTH_EXPIRED,
      });
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException({
        error: 'Too many verification attempts',
        code: ErrorCodes.AUTH_TOO_MANY_ATTEMPTS,
      });
    }
    const match = await bcrypt.compare(code, challenge.codeHash);
    await this.prisma.adminOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: { increment: 1 },
        ...(match ? { consumedAt: new Date() } : {}),
      },
    });
    if (!match) {
      throw new BadRequestException({
        error: 'Invalid verification code',
        code: ErrorCodes.AUTH_INVALID_CODE,
      });
    }
    return challenge;
  }

  async requestPasswordChange(
    adminId: string,
    body: unknown,
    req: Request,
  ) {
    const parsed = adminChangePasswordRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid request',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    const ok = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!ok) {
      throw new UnauthorizedException({
        error: 'Current password is incorrect',
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      });
    }
    const rate = await this.redis.rateLimit(
      `admin:otp:pwd:${adminId}`,
      5,
      15 * 60 * 1000,
    );
    if (!rate.allowed) {
      throw new HttpException(
        {
          error: 'Too many OTP requests',
          code: ErrorCodes.RATE_LIMITED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = await this.createOtp(
      adminId,
      AdminOtpPurpose.CHANGE_PASSWORD,
    );
    await this.mail.sendAdminOtp(user.email, code, 'change_password');
    await this.audit.record({
      actorUserId: adminId,
      actorEmail: user.email,
      action: 'admin.password_change.requested',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return {
      ok: true,
      message: 'Verification code sent to your email',
      debugCode:
        this.config.get('NODE_ENV') !== 'production' ? code : undefined,
    };
  }

  async confirmPasswordChange(
    adminId: string,
    body: unknown,
    req: Request,
  ) {
    const parsed = adminChangePasswordConfirmSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: parsed.error.issues[0]?.message || 'Invalid password',
        code: ErrorCodes.WEAK_PASSWORD,
      });
    }
    await this.consumeOtp(
      adminId,
      AdminOtpPurpose.CHANGE_PASSWORD,
      parsed.data.code,
    );
    const passwordHash = await hashPassword(parsed.data.newPassword);
    const user = await this.prisma.user.update({
      where: { id: adminId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await this.revokeOtherSessions(adminId, req);
    await this.audit.record({
      actorUserId: adminId,
      actorEmail: user.email,
      action: 'admin.password_change.completed',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return { ok: true };
  }

  async requestEmailChange(adminId: string, body: unknown, req: Request) {
    const parsed = adminChangeEmailRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid request',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    const ok = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!ok) {
      throw new UnauthorizedException({
        error: 'Current password is incorrect',
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      });
    }
    if (parsed.data.newEmail === user.email) {
      throw new BadRequestException({
        error: 'New email must be different',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const taken = await this.prisma.user.findUnique({
      where: { email: parsed.data.newEmail },
    });
    if (taken) {
      throw new BadRequestException({
        error: 'Email is already in use',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const rate = await this.redis.rateLimit(
      `admin:otp:email:${adminId}`,
      5,
      15 * 60 * 1000,
    );
    if (!rate.allowed) {
      throw new HttpException(
        {
          error: 'Too many OTP requests',
          code: ErrorCodes.RATE_LIMITED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = await this.createOtp(adminId, AdminOtpPurpose.CHANGE_EMAIL, {
      newEmail: parsed.data.newEmail,
    });
    await this.mail.sendAdminOtp(user.email, code, 'change_email');
    await this.audit.record({
      actorUserId: adminId,
      actorEmail: user.email,
      action: 'admin.email_change.requested',
      ip: clientIp(req),
      after: { pendingEmail: parsed.data.newEmail },
    });
    return {
      ok: true,
      message: 'Verification code sent to your current email',
      debugCode:
        this.config.get('NODE_ENV') !== 'production' ? code : undefined,
    };
  }

  async confirmEmailChange(adminId: string, body: unknown, req: Request) {
    const parsed = adminChangeEmailConfirmSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid code',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const challenge = await this.consumeOtp(
      adminId,
      AdminOtpPurpose.CHANGE_EMAIL,
      parsed.data.code,
    );
    let newEmail: string | null = null;
    try {
      const payload = challenge.payload
        ? (JSON.parse(challenge.payload) as { newEmail?: string })
        : {};
      newEmail = payload.newEmail ?? null;
    } catch {
      newEmail = null;
    }
    if (!newEmail) {
      throw new BadRequestException({
        error: 'Invalid challenge payload',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    const user = await this.prisma.user.update({
      where: { id: adminId },
      data: { email: newEmail },
    });
    await this.revokeOtherSessions(adminId, req);
    await this.audit.record({
      actorUserId: adminId,
      actorEmail: user.email,
      action: 'admin.email_change.completed',
      ip: clientIp(req),
      before: { email: before.email },
      after: { email: user.email },
    });
    return { ok: true, email: user.email };
  }

  private async revokeOtherSessions(adminId: string, req: Request) {
    const currentHash = this.cookies.tokenHashFromRequest(req);
    await this.prisma.adminSession.updateMany({
      where: {
        userId: adminId,
        revokedAt: null,
        ...(currentHash ? { NOT: { tokenHash: currentHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }
}
