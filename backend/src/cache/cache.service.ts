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
  private useMemory = false;

  constructor(@Inject(REDIS_CLIENT) redisClient: Redis | null) {
    this.redis = redisClient;
    this.useMemory = !redisClient;
  }

  async onModuleInit() {
    if (this.redis && !this.useMemory) {
      try {
        await this.redis.connect();
        this.logger.log('✅ CacheService inicializado con Redis');
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`⚠️ Error connecting to Redis: ${err?.message}, usando memoria`);
        this.redis = null;
        this.useMemory = true;
      }
    } else {
      this.useMemory = true;
      this.logger.log('⚠️ CacheService inicializado con memoria local (fallback)');
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore errors on shutdown
      }
    }
    this.memoryCache.clear();
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis && !this.useMemory) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) as T : null;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`⚠️ Redis get error: ${err?.message}, usando memoria`);
        this.useMemory = true;
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

    if (this.redis && !this.useMemory) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttl || this.DEFAULT_TTL);
        return;
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`⚠️ Redis set error: ${err?.message}, usando memoria`);
        this.useMemory = true;
      }
    }

    this.memoryCache.set(key, { value, expires: expireTime });
  }

  async del(key: string): Promise<void> {
    if (this.redis && !this.useMemory) {
      try {
        await this.redis.del(key);
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`⚠️ Redis del error: ${err?.message}`);
      }
    }

    this.memoryCache.delete(key);
  }

  async flush(): Promise<void> {
    if (this.redis && !this.useMemory) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`⚠️ Redis flush error: ${err?.message}`);
      }
    }

    this.memoryCache.clear();
  }

  async has(key: string): Promise<boolean> {
    if (this.redis && !this.useMemory) {
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
    return this.redis !== null && !this.useMemory;
  }

  getMode(): string {
    return this.useMemory ? 'memory' : 'redis';
  }

  async ping(): Promise<string> {
    if (this.redis && !this.useMemory) {
      return this.redis.ping();
    }
    return 'memory';
  }
}