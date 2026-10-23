import { Global, Module } from "@nestjs/common";
import { PlanCapabilitiesService } from "./plan-capabilities.service";
import { ApiQuotaService } from "./api-quota.service";
import { PlanCapabilitiesController } from "./plan-capabilities.controller";

@Global()
@Module({
  controllers: [PlanCapabilitiesController],
  providers: [PlanCapabilitiesService, ApiQuotaService],
  exports: [PlanCapabilitiesService, ApiQuotaService],
})
export class PlanCapabilitiesModule {}
