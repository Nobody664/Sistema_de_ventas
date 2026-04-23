import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/database/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  checkLive() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backend',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  @Public()
  @Get('ready')
  async checkReady() {
    const start = Date.now();
    let dbStatus: 'connected' | 'error' = 'error';
    let dbLatency = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    const isHealthy = dbStatus === 'connected';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'backend',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: {
          status: dbStatus,
          latency: dbLatency,
        },
      },
    };
  }
}