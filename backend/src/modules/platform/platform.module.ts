import { Module } from "@nestjs/common";

import { PrismaModule } from "@/database/prisma/prisma.module";
import { CompaniesModule } from "@/modules/companies/companies.module";
import { PlansModule } from "@/modules/plans/plans.module";
import { PaymentsModule } from "@/modules/payments/payments.module";
import { SubscriptionsModule } from "@/modules/subscriptions/subscriptions.module";
import { SupportModule } from "@/modules/support/support.module";
import { PlatformSupportController } from "./platform-support.controller";
import { PlatformController } from "./platform.controller";
import { PlatformCompaniesController } from "./platform-companies.controller";
import { PlatformPlansController } from "./platform-plans.controller";
import { PlatformSubscriptionsController } from "./platform-subscriptions.controller";
import { PlatformCheckoutRequestsController } from "./platform-checkout-requests.controller";
import { PlatformUpgradeRequestsController } from "./platform-upgrade-requests.controller";
import { PlatformAuditController } from "./platform-audit.controller";
import { PlatformMetricsController } from "./platform-metrics.controller";
import { PlatformAdminsController } from "./platform-admins.controller";
import { PlatformFinanceController } from "./platform-finance.controller";
import { PlatformApiUsageController } from "./platform-api-usage.controller";
import { PlatformMetricsService } from "./platform-metrics.service";
import { PlatformAdminsService } from "./platform-admins.service";
import { PlatformAuditService } from "./platform-audit.service";
import { PlatformFinanceService } from "./platform-finance.service";
import { PlatformApiUsageService } from "./platform-api-usage.service";

@Module({
  imports: [
    PrismaModule,
    PaymentsModule,
    CompaniesModule,
    PlansModule,
    SubscriptionsModule,
    SupportModule,
  ],
  controllers: [
    PlatformController,
    PlatformCompaniesController,
    PlatformPlansController,
    PlatformSubscriptionsController,
    PlatformCheckoutRequestsController,
    PlatformUpgradeRequestsController,
    PlatformAuditController,
    PlatformMetricsController,
    PlatformAdminsController,
    PlatformFinanceController,
    PlatformApiUsageController,
    PlatformSupportController,
  ],
  providers: [
    PlatformMetricsService,
    PlatformAdminsService,
    PlatformAuditService,
    PlatformFinanceService,
    PlatformApiUsageService,
  ],
})
export class PlatformModule {}
