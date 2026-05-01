import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CheckoutRequestsController } from './checkout-requests.controller';
import { CheckoutRequestsService } from './checkout-requests.service';
import { PaymentSettingsController } from './payment-settings.controller';
import { PaymentSettingsService } from './payment-settings.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { EmailModule } from '@/modules/email/email.module';
import { PrismaModule } from '@/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule],
  controllers: [PaymentsController, PaymentSettingsController, CheckoutRequestsController],
  providers: [PaymentsService, PaymentSettingsService, CheckoutRequestsService],
  exports: [PaymentsService, PaymentSettingsService, CheckoutRequestsService],
})
export class PaymentsModule {}
