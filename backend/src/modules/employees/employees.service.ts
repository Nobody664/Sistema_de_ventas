import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';
import { AuditService } from '@/common/services/audit.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limitService: SubscriptionLimitService,
    private readonly auditService: AuditService,
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dni: true,
        role: true,
        isActive: true,
        createdAt: true,
        user: { select: { email: true } },
      },
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

    const employee = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: `${input.firstName} ${input.lastName || ''}`.trim(),
          passwordHash,
          globalRole: 'USER',
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          companyId,
          role: input.role,
        },
      });

      return tx.employee.create({
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
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: 'Employee',
      entityId: employee.id,
      changes: {
        email: employee.email,
        role: employee.role,
        dni: employee.dni,
        userId: employee.userId,
      },
    });

    return employee;
  }

  async update(companyId: string, id: string, input: UpdateEmployeeDto) {
    const existing = await this.ensureEmployee(companyId, id);

    const employee = await this.prisma.employee.update({
      where: { id },
      data: input,
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: 'Employee',
      entityId: employee.id,
      changes: {
        before: {
          role: existing.role,
          isActive: existing.isActive,
          phone: existing.phone,
        },
        after: input,
      },
    });

    return employee;
  }

  async remove(companyId: string, id: string) {
    const existing = await this.ensureEmployee(companyId, id);

    const salesCount = await this.prisma.sale.count({
      where: { employeeId: id, companyId },
    });

    if (salesCount > 0) {
      const employee = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.employee.update({
          where: { id },
          data: { isActive: false, deletedAt: new Date() },
        });

        if (existing.userId) {
          await tx.membership.updateMany({
            where: { userId: existing.userId, companyId },
            data: { isActive: false },
          });
        }

        return updated;
      });

      await this.auditService.log({
        companyId,
        action: AuditAction.DELETE,
        entity: 'Employee',
        entityId: id,
        changes: { softDelete: true, salesCount, membershipRevoked: true },
      });

      return employee;
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.membership.deleteMany({
          where: { userId: existing.userId, companyId },
        });
      }

      return tx.employee.delete({ where: { id } });
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: 'Employee',
      entityId: id,
      changes: { softDelete: false, email: existing.email },
    });

    return employee;
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
