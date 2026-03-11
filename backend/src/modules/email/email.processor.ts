import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

interface EmailJobData {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}

@Processor('email', { concurrency: 5 })
@Injectable()
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, text } = job.data;

    this.logger.log(`Processing email to: ${to}, subject: ${subject}`);

    this.logger.log(`[DEMO] =========================================`);
    this.logger.log(`[DEMO] Sending email`);
    this.logger.log(`[DEMO] To: ${to}`);
    this.logger.log(`[DEMO] Subject: ${subject}`);
    this.logger.log(`[DEMO] Body: ${text}`);
    this.logger.log(`[DEMO] =========================================`);

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Email job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Email job ${job.id} failed: ${error.message}`);
  }
}
