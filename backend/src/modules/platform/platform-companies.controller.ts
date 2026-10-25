import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuditAction } from "@prisma/client";

import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import {
  CreateCompanyDto,
  CreateCompanyWithPlanDto,
  UpdateCompanyDto,
  UpdateCompanyStatusDto,
} from "@/modules/companies/dto/company.dto";
import { CompaniesService } from "@/modules/companies/companies.service";
import { PlatformAuditService } from "./platform-audit.service";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";

@Controller("platform/companies")
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformCompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  @Permissions(Permission.PLATFORM_VIEW)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.companiesService.findAll(query.page, query.limit);
  }

  @Permissions(Permission.PLATFORM_VIEW)
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.companiesService.findOne(id);
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post()
  async create(@Body() body: CreateCompanyDto, @CurrentUser() user: AuthUser) {
    const company = await this.companiesService.create(body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "Company",
      entityId: company.id,
      changes: { name: company.name },
    });
    return company;
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post("with-plan")
  async createWithPlan(
    @Body() body: CreateCompanyWithPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    const company = await this.companiesService.createWithPlan(body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "Company",
      entityId: company.id,
      changes: { name: company.name, planId: body.planId },
    });
    return company;
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post(":id/approve")
  async approve(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const company = await this.companiesService.approve(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "Company",
      entityId: id,
      changes: { status: "ACTIVE" },
    });
    return company;
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Post(":id/reject")
  async reject(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const company = await this.companiesService.reject(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "Company",
      entityId: id,
      changes: { rejected: true },
    });
    return company;
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateCompanyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const company = await this.companiesService.update(id, body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "Company",
      entityId: id,
      changes: body,
    });
    return company;
  }

  @Permissions(Permission.PLATFORM_MANAGE_COMPANIES)
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateCompanyStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const company = await this.companiesService.updateStatus(id, body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "Company",
      entityId: id,
      changes: { status: body.status },
    });
    return company;
  }
}
