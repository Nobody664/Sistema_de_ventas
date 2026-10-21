import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { EMAIL_QUEUE } from "./email.constants";
import { EmailService, SendEmailJob } from "./email.service";

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<SendEmailJob>): Promise<void> {
    this.logger.log(
      `Email ${job.id} (${job.data.template}) intento ${job.attemptsMade + 1}`,
    );
    await this.emailService.sendEmailDirect(job.data);
  }
}
