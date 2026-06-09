import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CompanyProfileService } from './company-profile.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly profileService: CompanyProfileService) {}

  @Get('completeness')
  async getCompleteness(@Req() request: { tenantId?: string }) {
    if (!request.tenantId) {
      return { score: 100, totalFields: 0, completedFields: 0, missingFields: [] };
    }
    return this.profileService.getProfileCompleteness(request.tenantId);
  }
}
