import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import nodemailer from "nodemailer";
import { EMAIL_JOB_SEND, EMAIL_QUEUE } from "./email.constants";

export interface SendEmailJob {
  messageId?: string;
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

export enum EmailTemplate {
  DAILY_SUMMARY = "daily-summary",
  SUBSCRIPTION_PENDING = "subscription-pending",
  SUBSCRIPTION_APPROVED = "subscription-approved",
  SUBSCRIPTION_REJECTED = "subscription-rejected",
  ACCOUNT_ACTIVATED = "account-activated",
  PAYMENT_RECEIVED = "payment-received",
  PAYMENT_PROOF_RECEIVED = "payment-proof-received",
  PASSWORD_RESET = "password-reset",
  WELCOME = "welcome",
  TRIAL_EXPIRING_SOON = "trial-expiring-soon",
  TRIAL_EXPIRED = "trial-expired",
}

const EMAIL_TEMPLATES: Record<
  EmailTemplate,
  { subject: string; text: string }
> = {
  [EmailTemplate.DAILY_SUMMARY]: {
    subject: "Resumen diario del negocio",
    text: "{{message}}",
  },
  [EmailTemplate.SUBSCRIPTION_PENDING]: {
    subject: "Tu cuenta está pendiente de aprobación",
    text: `
¡Gracias por registrarte en Huanka-Saas!

Tu empresa ha sido registrada y está esperando ser aprobada por nuestro equipo.

Te notificaremos cuando tu cuenta haya sido activada y puedas comenzar a usar el sistema.

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.SUBSCRIPTION_APPROVED]: {
    subject: "Tu suscripción ha sido aprobada",
    text: `
¡Tu cuenta ha sido aprobada!

Ahora puedes acceder a Huanka-Saas y comenzar a usar todas las funcionalidades de tu plan.

Ingresa a tu cuenta: {{signInUrl}}

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.SUBSCRIPTION_REJECTED]: {
    subject: "Tu solicitud de suscripción ha sido rechazada",
    text: `
Lamentamos informarte que tu solicitud de suscripción ha sido rechazada.

Si crees que esto es un error, por favor contacta a nuestro equipo de soporte.

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.ACCOUNT_ACTIVATED]: {
    subject: "Tu cuenta ha sido activada",
    text: `
¡Tu cuenta está ahora activa!

Puedes comenzar a usar todas las funcionalidades de Huanka-Saas.

Ingresa a tu cuenta: {{signInUrl}}

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.PAYMENT_RECEIVED]: {
    subject: "Pago recibido",
    text: `
Hemos recibido tu pago correctamente.

Tu suscripción está al día y puedes seguir usando todas las funcionalidades de Huanka-Saas.

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.PAYMENT_PROOF_RECEIVED]: {
    subject: "Comprobante recibido",
    text: `
Hemos recibido tu comprobante de pago para la empresa "{{companyName}}" (plan "{{planName}}").

Nuestro equipo lo revisará y te notificaremos cuando tu cuenta esté lista para ingresar.

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.PASSWORD_RESET]: {
    subject: "Restablece tu contraseña",
    text: `
Recibimos una solicitud para restablecer la contraseña de tu cuenta.

Usa el siguiente enlace para crear una nueva contraseña (válido por 15 minutos):

{{resetUrl}}

Si no solicitaste este cambio, puedes ignorar este correo.

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.WELCOME]: {
    subject: "Bienvenido a Huanka-Saas",
    text: `
¡Bienvenido a Huanka-Saas!

Gracias por registrarte. Tu cuenta está en proceso de aprobación.

Te notificaremos cuando tu cuenta haya sido activada.

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.TRIAL_EXPIRING_SOON]: {
    subject: "Tu período de prueba está por terminar",
    text: `
{{message}}

Ingresa a tu cuenta: {{signInUrl}}

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
  [EmailTemplate.TRIAL_EXPIRED]: {
    subject: "Tu período de prueba ha expirado",
    text: `
{{message}}

Ingresa a tu cuenta: {{signInUrl}}

Saludos,
Equipo Huanka-Saas
    `.trim(),
  },
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter;
  private readonly fromEmail: string;
  private readonly smtpEnabled: boolean;
  private readonly frontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(EMAIL_QUEUE)
    private readonly queue?: Queue<SendEmailJob>,
  ) {
    this.fromEmail =
      this.configService.get<string>("SMTP_FROM_EMAIL") ||
      "noreply@ventassaas.com";
    this.smtpEnabled = this.configService.get<boolean>("SMTP_ENABLED") ?? false;
    this.frontendUrl = (
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const smtpPort = parseInt(
      this.configService.get<string>("SMTP_PORT") || "587",
      10,
    );

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("SMTP_HOST") || "smtp.gmail.com",
      port: smtpPort,
      secure: smtpPort === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: {
        user: this.configService.get<string>("SMTP_USER"),
        pass: this.configService.get<string>("SMTP_PASSWORD"),
      },
    });
  }

  async sendEmail(job: SendEmailJob): Promise<void> {
    if (!this.queue) {
      await this.sendEmailDirect(job);
      return;
    }

    try {
      await this.queue.add(EMAIL_JOB_SEND, job, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      });
      this.logger.log(
        `Email encolado: ${job.template} to @${this.recipientDomain(job.to)}`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo encolar ${job.template}: ${(error as Error).message}. Reintento sincrono.`,
      );
      await this.sendEmailDirect(job);
    }
  }

  async sendEmailDirect(job: SendEmailJob): Promise<void> {
    const template = EMAIL_TEMPLATES[job.template];

    if (!template) {
      this.logger.warn(`Unknown email template: ${job.template}`);
      return;
    }

    if (this.hasInvalidRecipient(job.to)) {
      this.logger.warn(
        `Envío rechazado: destinatario inválido (posible inyección de headers)`,
      );
      return;
    }

    const data = this.withCommonData(job.data);
    const text = this.interpolateTemplate(template.text, data);
    const subject = this.subjectOf(job, template, data);

    if (!this.smtpEnabled) {
      this.logger.log(
        `[DEMO] Email omitido (SMTP deshabilitado): ${job.template} to @${this.recipientDomain(job.to)}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        messageId: job.messageId,
        from: this.fromEmail,
        to: job.to,
        subject,
        text,
      });
      this.logger.log(
        `Email enviado: ${job.template} to @${this.recipientDomain(job.to)}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enviando email ${job.template}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private recipientDomain(to: string): string {
    return to.includes("@") ? to.split("@")[1] : to;
  }

  private withCommonData(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return { signInUrl: `${this.frontendUrl}/sign-in`, ...data };
  }

  private subjectOf(
    job: { subject?: string },
    template: { subject: string },
    data: Record<string, unknown>,
  ): string {
    return this.interpolateTemplate(job.subject || template.subject, data);
  }

  private hasInvalidRecipient(to: string): boolean {
    return /[\r\n\u2028\u2029]/.test(to);
  }

  private interpolateTemplate(
    text: string,
    data: Record<string, unknown>,
  ): string {
    let result = text;
    for (const [key, value] of Object.entries(data)) {
      const sanitized = String(value ?? "").replace(
        /[\r\n\u2028\u2029\u0000-\u001f\u007f]/g,
        " ",
      );
      result = result.replace(new RegExp(`{{${key}}}`, "g"), sanitized);
    }
    return result.trim();
  }

  async sendSubscriptionPending(
    userEmail: string,
    companyName: string,
  ): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.SUBSCRIPTION_PENDING,
      data: { companyName },
    });
  }

  async sendSubscriptionApproved(
    userEmail: string,
    companyName: string,
  ): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.SUBSCRIPTION_APPROVED,
      data: { companyName },
    });
  }

  async sendSubscriptionRejected(
    userEmail: string,
    companyName: string,
  ): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.SUBSCRIPTION_REJECTED,
      data: { companyName },
    });
  }

  async sendAccountActivated(
    userEmail: string,
    companyName: string,
  ): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.ACCOUNT_ACTIVATED,
      data: { companyName },
    });
  }

  async sendPasswordReset(userEmail: string, resetUrl: string): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.PASSWORD_RESET,
      data: { resetUrl },
    });
  }

  async sendPaymentProofReceived(
    userEmail: string,
    companyName: string,
    planName: string,
  ): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.PAYMENT_PROOF_RECEIVED,
      data: { companyName, planName },
    });
  }

  async sendTrialExpiringSoon(
    userEmail: string,
    companyName: string,
    planName: string,
    daysLeft: number,
  ): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.TRIAL_EXPIRING_SOON,
      data: {
        companyName,
        planName,
        message: `Tu período de prueba del plan "${planName}" de la empresa "${companyName}" termina en ${daysLeft} día(s). Mejora tu plan para continuar sin interrupciones.`,
      },
    });
  }

  async sendTrialExpired(
    userEmail: string,
    companyName: string,
    planName: string,
  ): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: "",
      template: EmailTemplate.TRIAL_EXPIRED,
      data: {
        companyName,
        planName,
        message: `Tu período de prueba del plan "${planName}" de la empresa "${companyName}" ha expirado. Mejora tu plan para continuar usando el sistema.`,
      },
    });
  }
}
