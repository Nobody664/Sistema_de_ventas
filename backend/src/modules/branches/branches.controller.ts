import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Req() request: { tenantId: string }) {
    return this.branchesService.findAll(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.INVENTORY_VIEW)
  @Get(':id')
  findById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.branchesService.findById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.BRANCH_MANAGE)
  @Post()
  create(@Req() request: { tenantId: string }, @Body() body: CreateBranchDto) {
    return this.branchesService.create(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.BRANCH_MANAGE)
  @Patch(':id')
  update(@Req() request: { tenantId: string }, @Param('id') id: string, @Body() body: UpdateBranchDto) {
    return this.branchesService.update(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.BRANCH_MANAGE)
  @Delete(':id')
  remove(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.branchesService.remove(request.tenantId, id);
  }
}
