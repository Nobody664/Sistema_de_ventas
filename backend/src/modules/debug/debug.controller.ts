import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';

interface RouteInfo {
  method: string;
  path: string;
  controller: string;
  module: string;
}

@ApiTags('Debug')
@Controller('debug')
export class DebugController {
  @Public()
  @Get('routes')
  @ApiOperation({ summary: 'List all registered routes' })
  @ApiResponse({ status: 200, description: 'All routes' })
  getAllRoutes(): {
    prefix: string;
    total: number;
    routes: RouteInfo[];
    note: string;
  } {
    return {
      prefix: '/api',
      total: 0,
      routes: [],
      note: 'Use Swagger at /api/docs for full route listing',
    };
  }
}