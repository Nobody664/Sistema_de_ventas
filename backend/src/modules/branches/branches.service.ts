import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        companyId,
        name: dto.name,
        address: dto.address,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(companyId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId },
      include: { productBatches: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(companyId: string, id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findFirst({ where: { id, companyId } });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(companyId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, companyId } });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
    return { deactivated: true };
  }
}
