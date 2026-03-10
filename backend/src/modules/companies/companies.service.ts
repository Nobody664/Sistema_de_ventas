import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { UpdateCompanyDto, UpdateCompanyStatusDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
      },
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

  async updateStatus(companyId: string, input: UpdateCompanyStatusDto) {
    await this.findCurrent(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: { status: input.status },
    });
  }
}
