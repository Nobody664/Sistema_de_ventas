import { Module } from '@nestjs/common';

import { PrismaModule } from '@/database/prisma/prisma.module';
import { CompaniesModule } from '@/modules/companies/companies.module';
import { PlansModule } from '@/modules/plans/plans.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { PlatformController } from './platform.controller';
import { PlatformCompaniesController } from './platform-companies.controller';
import { PlatformPlansController } from './platform-plans.controller';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { PlatformCheckoutRequestsController } from './platform-checkout-requests.controller';
import { PlatformUpgradeRequestsController } from './platform-upgrade-requests.controller';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformMetricsController } from './platform-metrics.controller';
import { PlatformAdminsController } from './platform-admins.controller';
import { PlatformMetricsService } from './platform-metrics.service';
import { PlatformAdminsService } from './platform-admins.service';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [
    PrismaModule,
    PaymentsModule,
    CompaniesModule,
    PlansModule,
    SubscriptionsModule,
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
  ],
  providers: [PlatformMetricsService, PlatformAdminsService, PlatformAuditService],
})
export class PlatformModule {}
