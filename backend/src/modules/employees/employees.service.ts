import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  findByCompany(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  create(companyId: string, input: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        companyId,
        ...input,
      },
    });
  }

  async update(companyId: string, id: string, input: UpdateEmployeeDto) {
    await this.ensureEmployee(companyId, id);
    return this.prisma.employee.update({
      where: { id },
      data: input,
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensureEmployee(companyId, id);
    return this.prisma.employee.delete({ where: { id } });
  }

  private async ensureEmployee(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }
}
