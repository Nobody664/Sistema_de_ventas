import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { AuditAction, MembershipRole, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  CreateEmployeeDto,
  QueryEmployeeDto,
  UpdateEmployeeDto,
} from "./dto/employee.dto";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { AuditService } from "@/common/services/audit.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";

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
      where: { id, companyId, deletedAt: null },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
      },
    });
  }

  findByCompany(companyId: string, query?: QueryEmployeeDto) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;

    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dni: true,
        role: true,
        isActive: true,
        salary: true,
        paymentDay: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async create(companyId: string, input: CreateEmployeeDto) {
    await this.limitService.validateLimit(companyId, "employees");

    if (input.userId) {
      return this.createForExistingUser(companyId, input.userId, input);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new ConflictException(
        "Ya existe un usuario con ese correo electrónico.",
      );
    }

    const passwordHash = await argon2.hash(input.password);

    const employee = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: `${input.firstName} ${input.lastName || ""}`.trim(),
          passwordHash,
          globalRole: "USER",
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          companyId,
          role: input.role,
          isActive: input.isActive ?? true,
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
          salary: input.salary ?? null,
          paymentDay: input.paymentDay ?? null,
          isActive: input.isActive ?? true,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "Employee",
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

  private async createForExistingUser(
    companyId: string,
    userId: string,
    input: CreateEmployeeDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) {
      throw new BadRequestException("El usuario especificado no existe.");
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!membership) {
      throw new BadRequestException("El usuario no pertenece a esta empresa.");
    }

    const linkedEmployee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (linkedEmployee) {
      throw new BadRequestException(
        "El usuario ya está vinculado a otro empleado.",
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException(
        "Ya existe un usuario con ese correo electrónico.",
      );
    }

    const employee = await serializableTransaction(this.prisma, async (tx) => {
      await this.syncMembership(tx, companyId, userId, {
        role: input.role,
        isActive: input.isActive ?? true,
      });
      return tx.employee.create({
        data: {
          companyId,
          userId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          dni: input.dni,
          role: input.role,
          salary: input.salary ?? null,
          paymentDay: input.paymentDay ?? null,
          isActive: input.isActive ?? true,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "Employee",
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

    if (input.role === null || input.isActive === null)
      throw new BadRequestException("El rol y el estado no pueden ser nulos");
    const employee = await serializableTransaction(this.prisma, async (tx) => {
      if (
        existing.userId &&
        (input.role !== undefined || input.isActive !== undefined)
      ) {
        await this.syncMembership(tx, companyId, existing.userId, {
          role: input.role,
          isActive: input.isActive,
        });
      }
      return tx.employee.update({ where: { id }, data: input });
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "Employee",
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
      const employee = await serializableTransaction(
        this.prisma,
        async (tx) => {
          const updated = await tx.employee.update({
            where: { id },
            data: { isActive: false, deletedAt: new Date() },
          });

          if (existing.userId) {
            await this.syncMembership(tx, companyId, existing.userId, {
              isActive: false,
            });
          }

          return updated;
        },
      );

      await this.auditService.log({
        companyId,
        action: AuditAction.DELETE,
        entity: "Employee",
        entityId: id,
        changes: { softDelete: true, salesCount, membershipRevoked: true },
      });

      return employee;
    }

    const employee = await serializableTransaction(this.prisma, async (tx) => {
      if (existing.userId) {
        await this.syncMembership(tx, companyId, existing.userId, {
          isActive: false,
        });
        await tx.membership.deleteMany({
          where: { userId: existing.userId, companyId },
        });
      }

      return tx.employee.delete({ where: { id } });
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: "Employee",
      entityId: id,
      changes: { softDelete: false, email: existing.email },
    });

    return employee;
  }

  private async ensureEmployee(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    return employee;
  }

  private async syncMembership(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    input: { role?: MembershipRole; isActive?: boolean },
  ): Promise<void> {
    const membership = await tx.membership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!membership)
      throw new BadRequestException(
        "El empleado no tiene una membresía válida",
      );
    if (
      membership.role === "COMPANY_ADMIN" &&
      membership.isActive &&
      ((input.role ?? membership.role) !== "COMPANY_ADMIN" ||
        input.isActive === false)
    ) {
      const admins = await tx.membership.count({
        where: {
          companyId,
          role: "COMPANY_ADMIN",
          isActive: true,
          user: { isActive: true },
        },
      });
      if (admins <= 1)
        throw new ConflictException(
          "La empresa debe conservar al menos un administrador activo",
        );
    }
    await tx.membership.update({
      where: { userId_companyId: { userId, companyId } },
      data: input,
    });
    if (
      (input.role !== undefined && input.role !== membership.role) ||
      (input.isActive !== undefined && input.isActive !== membership.isActive)
    ) {
      await tx.refreshToken.updateMany({
        where: { userId, companyId, type: "SESSION", revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
}
