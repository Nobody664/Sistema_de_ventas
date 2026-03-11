import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto, UpdateCompanyStatusDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: { memberships: true, customers: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return company;
  }

  create(input: CreateCompanyDto) {
    const slug = input.slug ?? input.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    return this.prisma.company.create({
      data: {
        name: input.name,
        slug,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone ?? 'America/Lima',
        currency: input.currency ?? 'PEN',
        status: 'TRIAL',
      },
    });
  }

  async createWithPlan(input: CreateCompanyDto & { planId: string }) {
    const slug = input.slug ?? input.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    const company = await this.prisma.company.create({
      data: {
        name: input.name,
        slug,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone ?? 'America/Lima',
        currency: input.currency ?? 'PEN',
        status: 'TRIAL',
        subscription: {
          create: {
            planId: input.planId,
            status: 'TRIALING',
            billingCycle: 'MONTHLY',
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    return company;
  }

  async approve(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        subscription: {
          update: {
            status: 'ACTIVE',
          },
        },
      },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });
  }

  async reject(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return this.prisma.company.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }

  async findCurrent(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return company;
  }

  async updateCurrent(companyId: string, input: UpdateCompanyDto) {
    await this.findCurrent(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: input,
    });
  }

  async update(companyId: string, input: UpdateCompanyDto) {
    await this.findOne(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: input,
    });
  }

  async updateStatus(companyId: string, input: UpdateCompanyStatusDto) {
    await this.findOne(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: { status: input.status },
    });
  }
}
