import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PlanUpgradeRequestsController } from './plan-upgrade-requests.controller';
import { PlanUpgradeRequestsService } from './plan-upgrade-requests.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { EmailModule } from '@/modules/email/email.module';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule],
  controllers: [SubscriptionsController, PlanUpgradeRequestsController],
  providers: [SubscriptionsService, PlanUpgradeRequestsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

