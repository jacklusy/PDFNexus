import {
  Injectable,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Sliding fixed-window rate limit via INCR + EXPIRE.
   * Returns { allowed, count, retryAfterSec }.
   */
  async rateLimit(
    key: string,
    max: number,
    windowMs: number,
  ): Promise<{ allowed: boolean; count: number; retryAfterSec: number }> {
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSec);
    }
    const ttl = await this.client.ttl(key);
    const retryAfterSec = ttl > 0 ? ttl : windowSec;
    return {
      allowed: count <= max,
      count,
      retryAfterSec,
    };
  }

  /**
   * @param ttlSec safety valve — must exceed the longest possible held slot.
   * Without it a slot leaked between incr and decr (container recreated or
   * OOM-killed mid-request) would persist forever, and because redis_data is
   * a durable volume it would survive restarts too, wedging the limiter at
   * its cap permanently. Refreshing the TTL on every acquire lets the counter
   * self-heal once traffic stops.
   */
  async acquireConcurrencySlot(
    key: string,
    max: number,
    ttlSec = 300,
  ): Promise<boolean> {
    const count = await this.client.incr(key);
    await this.client.expire(key, ttlSec);
    if (count > max) {
      await this.client.decr(key);
      return false;
    }
    return true;
  }

  async releaseConcurrencySlot(key: string): Promise<void> {
    const value = await this.client.decr(key);
    if (value < 0) {
      await this.client.set(key, '0');
    }
  }

  async consumeDailyBudget(
    key: string,
    limit: number,
  ): Promise<{ allowed: boolean; used: number }> {
    const used = await this.client.incr(key);
    if (used === 1) {
      // Expire at end of UTC day roughly — 24h TTL is fine for daily budget
      await this.client.expire(key, 86_400);
    }
    if (used > limit) {
      await this.client.decr(key);
      return { allowed: false, used: used - 1 };
    }
    return { allowed: true, used };
  }

  async getDailyBudgetUsed(key: string): Promise<number> {
    const raw = await this.client.get(key);
    return raw ? Number.parseInt(raw, 10) || 0 : 0;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
