import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DniService } from './dni.service';

@Controller('dni')
export class DniController {
  constructor(private readonly dniService: DniService) {}

  @Get(':dni')
  @UseGuards(JwtAuthGuard)
  async findByDni(@Param('dni') dni: string) {
    return this.dniService.findByDni(dni);
  }

  @Get('ruc/:ruc')
  @UseGuards(JwtAuthGuard)
  async findByRuc(@Param('ruc') ruc: string) {
    return this.dniService.findByRuc(ruc);
  }
}
