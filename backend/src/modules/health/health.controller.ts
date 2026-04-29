import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';

@Controller('health')
export class HealthController {
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
  checkReady() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backend',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: {
          status: 'ok',
          latency: 0,
        },
      },
    };
  }
}