import { Injectable, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

interface CacheItem<T> {
  value: T;
  expires: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private memoryCache = new Map<string, CacheItem<unknown>>();
  private readonly DEFAULT_TTL = 3600;

  constructor(@Inject(REDIS_CLIENT) redisClient: Redis | null) {
    this.redis = redisClient;
  }

  async onModuleInit() {
    if (this.redis) {
      try {
        await this.redis.connect();
        this.logger.log('CacheService inicializado con Redis');
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error('Error al conectar Redis:', err?.message ?? String(error));
        this.redis = null;
      }
    } else {
      this.logger.log('CacheService inicializado con memoria local');
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) as T : null;
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Error getting key ${key}:`, err?.message ?? String(error));
      }
    }

    const item = this.memoryCache.get(key);
    if (item && (item.expires === 0 || item.expires > Date.now())) {
      return item.value as T;
    }
    this.memoryCache.delete(key);

    return null;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const expireTime = ttl ? Date.now() + ttl * 1000 : 0;

    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttl || this.DEFAULT_TTL);
        return;
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Error setting key ${key}:`, err?.message ?? String(error));
      }
    }

    this.memoryCache.set(key, { value, expires: expireTime });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Error deleting key ${key}:`, err?.message ?? String(error));
      }
    }

    this.memoryCache.delete(key);
  }

  async flush(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.flushdb();
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error('Error flushing Redis:', err?.message ?? String(error));
      }
    }

    this.memoryCache.clear();
  }

  async has(key: string): Promise<boolean> {
    if (this.redis) {
      try {
        const exists = await this.redis.exists(key);
        return exists === 1;
      } catch {
        return false;
      }
    }

    return this.memoryCache.has(key);
  }

  isConnected(): boolean {
    return this.redis !== null;
  }
}