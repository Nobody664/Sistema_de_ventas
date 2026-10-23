import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EmailService } from "./email.service";
import { EmailProcessor } from "./email.processor";
import { EMAIL_QUEUE } from "./email.constants";

const queueEnabled = Boolean(process.env.REDIS_URL);

@Module({
  imports: queueEnabled
    ? [BullModule.registerQueue({ name: EMAIL_QUEUE })]
    : [],
  providers: [EmailService, ...(queueEnabled ? [EmailProcessor] : [])],
  exports: [EmailService],
})
export class EmailModule {}
