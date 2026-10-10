import { Module } from '@nestjs/common';

import { PrismaModule } from '@/database/prisma/prisma.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { PlatformController } from './platform.controller';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
