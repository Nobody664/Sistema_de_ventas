import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  findPublicPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  create(input: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        billingCycle: input.billingCycle,
        maxUsers: input.maxUsers,
        maxProducts: input.maxProducts,
        features: input.features,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(id: string, input: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    return this.prisma.plan.update({
      where: { id },
      data: input,
    });
  }

  async remove(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    return this.prisma.plan.delete({ where: { id } });
  }
}
