import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

const hasRedis = !!process.env.REDIS_URL;

@Module({
  imports: hasRedis ? [BullModule.registerQueue({ name: 'email' })] : [],
  providers: [EmailService, ...(hasRedis ? [EmailProcessor] : [])],
  exports: [EmailService],
})
export class EmailModule {}
