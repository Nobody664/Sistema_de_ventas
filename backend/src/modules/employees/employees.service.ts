import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limitService: SubscriptionLimitService,
  ) {}

  async getLimitsInfo(companyId: string) {
    return this.limitService.getAllLimitsInfo(companyId);
  }

  findById(companyId: string, id: string) {
    return this.prisma.employee.findFirst({
      where: { id, companyId },
      include: { user: true },
    });
  }

  findByCompany(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(companyId: string, input: CreateEmployeeDto) {
    await this.limitService.validateLimit(companyId, 'employees');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        fullName: `${input.firstName} ${input.lastName || ''}`.trim(),
        passwordHash,
        globalRole: 'USER',
      },
    });

    await this.prisma.membership.create({
      data: {
        userId: user.id,
        companyId,
        role: input.role,
      },
    });

    return this.prisma.employee.create({
      data: {
        companyId,
        userId: user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        dni: input.dni,
        role: input.role,
        isActive: input.isActive ?? true,
      },
      include: { user: true },
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
