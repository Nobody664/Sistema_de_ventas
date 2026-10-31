import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { EmailService, EmailTemplate } from "@/modules/email/email.service";
import { StoreCryptoService } from "./store-crypto.service";

@Injectable()
export class StoreMailService {
  private readonly logger = new Logger(StoreMailService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: StoreCryptoService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}
  async enqueue(
    tx: Prisma.TransactionClient | PrismaClient,
    to: string,
    subject: string,
    message: string,
  ) {
    await tx.storeMail.create({
      data: {
        encryptedBody: this.crypto.encrypt(
          JSON.stringify({ to, subject, message }),
        ),
      },
    });
  }
  @Interval(30000)
  async deliver(): Promise<void> {
    if (!this.config.get<boolean>("SMTP_ENABLED")) return;
    try {
      const now = new Date();
      const rows = await this.prisma.storeMail.findMany({
        where: {
          deliveredAt: null,
          attempts: { lt: 10 },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      });
      for (const row of rows) {
        const leaseUntil = new Date(Date.now() + 120000);
        const claim = await this.prisma.storeMail.updateMany({
          where: {
            id: row.id,
            deliveredAt: null,
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
          },
          data: { leaseUntil, attempts: { increment: 1 } },
        });
        if (!claim.count) continue;
        try {
          const body = JSON.parse(this.crypto.decrypt(row.encryptedBody)) as {
            to: string;
            subject: string;
            message: string;
          };
          await this.email.sendEmailDirect({
            to: body.to,
            subject: body.subject,
            template: EmailTemplate.STORE_MESSAGE,
            messageId: `<store-${row.id}@huanka.local>`,
            data: { message: body.message },
          });
          await this.prisma.storeMail.updateMany({
            where: { id: row.id, leaseUntil },
            data: {
              deliveredAt: new Date(),
              encryptedBody: "",
              leaseUntil: null,
            },
          });
        } catch {
          this.logger.warn(`Correo comercial pendiente: ${row.id}`);
        }
      }
    } catch {
      this.logger.warn("No se pudo procesar la cola comercial");
    }
  }
}
