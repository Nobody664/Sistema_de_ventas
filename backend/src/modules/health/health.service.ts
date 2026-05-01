import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CacheService } from '@/cache/cache.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  async checkLive(): Promise<{
    status: string;
    timestamp: string;
    service: string;
    version: string;
    uptime: number;
  }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backend',
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
    };
  }

  async checkReady(): Promise<{
    status: string;
    timestamp: string;
    service: string;
    version: string;
    checks: {
      database: { status: string; latency: number; error?: string };
      redis: { status: string; latency: number; error?: string };
      memory: { status: string; used: number; total: number };
      uptime: number;
    };
  }> {
    const databaseCheck = await this.checkDatabase();
    const redisCheck = await this.checkRedis();
    const memoryCheck = this.checkMemory();
    const uptime = Math.floor(process.uptime());

    const allHealthy = 
      databaseCheck.status === 'ok' &&
      redisCheck.status === 'ok' &&
      memoryCheck.status === 'ok';

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'backend',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: databaseCheck,
        redis: redisCheck,
        memory: memoryCheck,
        uptime,
      },
    };
  }

  private async checkDatabase(): Promise<{ status: string; latency: number; error?: string }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Database check failed', error);
      return {
        status: 'error',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<{ status: string; latency: number; error?: string }> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      return { status: 'ok', latency: 0 };
    }

    const start = Date.now();
    try {
      await this.cache.ping();
      return {
        status: 'ok',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.warn('Redis check failed, using fallback', error);
      return {
        status: 'ok',
        latency: Date.now() - start,
        error: 'Redis unavailable, using memory fallback',
      };
    }
  }

  private checkMemory(): { status: string; used: number; total: number } {
    const usage = process.memoryUsage();
    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(usage.heapTotal / 1024 / 1024);

    return {
      status: usedMB < totalMB * 0.9 ? 'ok' : 'warning',
      used: usedMB,
      total: totalMB,
    };
  }

  async checkFull(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
    version: string;
    routes: { total: number; public: number; protected: number };
    checks: {
      database: { status: string; latency: number };
      redis: { status: string; latency: number };
      memory: { used: number; total: number };
      uptime: number;
    };
  }> {
    const { status, checks, ...rest } = await this.checkReady();

    return {
      status,
      timestamp: new Date().toISOString(),
      environment: this.config.get<string>('NODE_ENV') || 'development',
      version: process.env.npm_package_version || '1.0.0',
      routes: this.getRouteStats(),
      checks: {
        database: { status: checks.database.status, latency: checks.database.latency },
        redis: { status: checks.redis.status, latency: checks.redis.latency },
        memory: { used: checks.memory.used, total: checks.memory.total },
        uptime: checks.uptime,
      },
    };
  }

  private getRouteStats(): { total: number; public: number; protected: number } {
    return {
      total: 0,
      public: 0,
      protected: 0,
    };
  }
}