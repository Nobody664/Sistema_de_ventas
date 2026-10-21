import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Job } from "bullmq";
import { EmailProcessor } from "./email.processor";
import { EmailService, EmailTemplate, SendEmailJob } from "./email.service";

function jobOf(data: SendEmailJob, attemptsMade = 0): Job<SendEmailJob> {
  return { id: "job-1", attemptsMade, data } as unknown as Job<SendEmailJob>;
}

const sampleJob: SendEmailJob = {
  to: "cliente@example.com",
  subject: "",
  template: EmailTemplate.WELCOME,
  data: { companyName: "Demo" },
};

describe("EmailProcessor", () => {
  it("delegates the job payload to EmailService.sendEmailDirect", async () => {
    const received: SendEmailJob[] = [];
    const emailService = {
      sendEmailDirect: async (job: SendEmailJob) => {
        received.push(job);
      },
    } as unknown as EmailService;

    const processor = new EmailProcessor(emailService);
    await processor.process(jobOf(sampleJob));

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], sampleJob);
  });

  it("propagates SMTP errors so BullMQ applies retries/backoff", async () => {
    const emailService = {
      sendEmailDirect: async () => {
        throw new Error("smtp down");
      },
    } as unknown as EmailService;

    const processor = new EmailProcessor(emailService);

    await assert.rejects(
      () => processor.process(jobOf(sampleJob, 1)),
      /smtp down/,
    );
  });
});
