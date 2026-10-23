import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuditAction } from "@prisma/client";

import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { PlatformAuditService } from "./platform-audit.service";
import { PlatformFinanceService } from "./platform-finance.service";
import {
  CreatePlatformAccountDto,
  CreatePlatformTransactionDto,
  QueryPlatformFinanceSummaryDto,
  QueryPlatformTransactionsDto,
  UpdatePlatformAccountDto,
  UpdatePlatformTransactionDto,
} from "./dto/platform-finance.dto";

@Controller("platform/finance")
@Roles("SUPER_ADMIN")
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformFinanceController {
  constructor(
    private readonly finance: PlatformFinanceService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  @Permissions(Permission.PLATFORM_FINANCE_VIEW)
  @Get("summary")
  getSummary(@Query() query: QueryPlatformFinanceSummaryDto) {
    return this.finance.getSummary(query);
  }

  @Permissions(Permission.PLATFORM_FINANCE_VIEW)
  @Get("top-companies")
  getTopCompanies(@Query("limit") limit?: string) {
    const parsed = Number(limit);
    return this.finance.getTopCompanies(
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 5,
    );
  }

  @Permissions(Permission.PLATFORM_FINANCE_VIEW)
  @Get("companies")
  getCompanies(@Query("search") search?: string) {
    return this.finance.getCompaniesRevenue(search);
  }

  @Permissions(Permission.PLATFORM_FINANCE_VIEW)
  @Get("accounts")
  listAccounts() {
    return this.finance.listAccounts();
  }

  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @Post("accounts")
  async createAccount(
    @Body() body: CreatePlatformAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    const account = await this.finance.createAccount(body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "PlatformAccount",
      entityId: account.id,
      changes: { name: account.name, type: account.type },
    });
    return account;
  }

  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @Patch("accounts/:id")
  async updateAccount(
    @Param("id") id: string,
    @Body() body: UpdatePlatformAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    const account = await this.finance.updateAccount(id, body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "PlatformAccount",
      entityId: id,
      changes: { ...body },
    });
    return account;
  }

  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @Delete("accounts/:id")
  async deleteAccount(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const result = await this.finance.deleteAccount(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.DELETE,
      entity: "PlatformAccount",
      entityId: id,
    });
    return result;
  }

  @Permissions(Permission.PLATFORM_FINANCE_VIEW)
  @Get("transactions")
  listTransactions(@Query() query: QueryPlatformTransactionsDto) {
    return this.finance.listTransactions(query);
  }

  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @Post("transactions")
  async createTransaction(
    @Body() body: CreatePlatformTransactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const transaction = await this.finance.createTransaction(body, user.sub);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "PlatformTransaction",
      entityId: transaction.id,
      changes: {
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
      },
    });
    return transaction;
  }

  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @Patch("transactions/:id")
  async updateTransaction(
    @Param("id") id: string,
    @Body() body: UpdatePlatformTransactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const transaction = await this.finance.updateTransaction(id, body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "PlatformTransaction",
      entityId: id,
      changes: { ...body },
    });
    return transaction;
  }

  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @Delete("transactions/:id")
  async deleteTransaction(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.finance.deleteTransaction(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.DELETE,
      entity: "PlatformTransaction",
      entityId: id,
    });
    return result;
  }
}
