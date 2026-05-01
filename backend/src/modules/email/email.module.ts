import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
// import { EmailProcessor } from './email.processor'; // requires BullMQ/Redis

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
