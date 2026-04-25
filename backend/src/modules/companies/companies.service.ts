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
        subscriptions: {
          include: { plan: true },
          take: 1,
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
        subscriptions: {
          include: { plan: true },
          take: 1,
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
        legalName: input.legalName,
        taxId: input.taxId,
        address: input.address,
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
        legalName: input.legalName,
        taxId: input.taxId,
        address: input.address,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone ?? 'America/Lima',
        currency: input.currency ?? 'PEN',
        status: 'TRIAL',
        subscriptions: {
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
        subscriptions: {
          include: { plan: true },
          take: 1,
        },
      },
    });

    return company;
  }

  async approve(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { subscriptions: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    const activeSubscription = company.subscriptions[0];
    if (activeSubscription) {
      return this.prisma.company.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          subscriptions: {
            update: {
              where: { id: activeSubscription.id },
              data: { status: 'ACTIVE' },
            },
          },
        },
        include: {
          subscriptions: {
            include: { plan: true },
            take: 1,
          },
        },
      });
    }

    return this.prisma.company.update({
      where: { id },
      data: { status: 'ACTIVE' },
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
        subscriptions: {
          include: { plan: true },
          take: 1,
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