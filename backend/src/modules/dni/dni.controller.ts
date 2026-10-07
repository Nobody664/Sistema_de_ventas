import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { DniService } from './dni.service';

@Controller('dni')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class DniController {
  constructor(private readonly dniService: DniService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get(':dni')
  async findByDni(@Param('dni') dni: string) {
    return this.dniService.findByDni(dni);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get('ruc/:ruc')
  async findByRuc(@Param('ruc') ruc: string) {
    return this.dniService.findByRuc(ruc);
  }
}
