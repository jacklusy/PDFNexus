import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async health() {
    const today = new Date().toISOString().slice(0, 10);
    const budgetKey = `ocr:budget:${today}`;
    const used = await this.redis.getDailyBudgetUsed(budgetKey);
    const limit = this.config.get<number>('OCR_DAILY_BUDGET') ?? 500;
    const geminiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    const aiAvailable = Boolean(
      geminiKey && geminiKey !== 'MY_GEMINI_API_KEY',
    );

    return {
      status: 'ok',
      aiAvailable,
      ocrBudget: {
        remaining: Math.max(0, limit - used),
        limit,
      },
    };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, boolean> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }
    checks.redis = await this.redis.ping();
    const ready = Object.values(checks).every(Boolean);
    return { ready, checks };
  }
}
