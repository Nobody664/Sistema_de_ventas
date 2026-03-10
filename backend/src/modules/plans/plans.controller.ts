import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get()
  findPublicPlans() {
    return this.plansService.findPublicPlans();
  }

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @Post()
  create(@Body() body: CreatePlanDto) {
    return this.plansService.create(body);
  }

  @Roles('SUPER_ADMIN', 'SUPPORT_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePlanDto) {
    return this.plansService.update(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
