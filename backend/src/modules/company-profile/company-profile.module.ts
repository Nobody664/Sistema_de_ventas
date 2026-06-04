import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { CompanyProfileService } from './company-profile.service';
import { CompanyProfileController } from './company-profile.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}
