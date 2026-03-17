import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface SendEmailJob {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

export enum EmailTemplate {
  SUBSCRIPTION_PENDING = 'subscription-pending',
  SUBSCRIPTION_APPROVED = 'subscription-approved',
  SUBSCRIPTION_REJECTED = 'subscription-rejected',
  ACCOUNT_ACTIVATED = 'account-activated',
  PAYMENT_RECEIVED = 'payment-received',
  PAYMENT_PROOF_RECEIVED = 'payment-proof-received',
  WELCOME = 'welcome',
}

const EMAIL_TEMPLATES: Record<EmailTemplate, { subject: string; text: string }> = {
  [EmailTemplate.SUBSCRIPTION_PENDING]: {
    subject: 'Tu cuenta está pendiente de aprobación',
    text: `
¡Gracias por registrarte en Ventas SaaS!

Tu empresa ha sido registrada y está esperando ser aprobada por nuestro equipo.

Te notificaremos cuando tu cuenta haya sido activada y puedas comenzar a usar el sistema.

Saludos,
Equipo Ventas SaaS
    `.trim(),
  },
  [EmailTemplate.SUBSCRIPTION_APPROVED]: {
    subject: 'Tu suscripción ha sido aprobada',
    text: `
¡Tu cuenta ha sido aprobada!

Ahora puedes acceder a Ventas SaaS y comenzar a usar todas las funcionalidades de tu plan.

Ingresa a tu cuenta: https://ventas.example.com/sign-in

Saludos,
Equipo Ventas SaaS
    `.trim(),
  },
  [EmailTemplate.SUBSCRIPTION_REJECTED]: {
    subject: 'Tu solicitud de suscripción ha sido rechazada',
    text: `
Lamentamos informarte que tu solicitud de suscripción ha sido rechazada.

Si crees que esto es un error, por favor contacta a nuestro equipo de soporte.

Saludos,
Equipo Ventas SaaS
    `.trim(),
  },
  [EmailTemplate.ACCOUNT_ACTIVATED]: {
    subject: 'Tu cuenta ha sido activada',
    text: `
¡Tu cuenta está ahora activa!

Puedes comenzar a usar todas las funcionalidades de Ventas SaaS.

Ingresa a tu cuenta: https://ventas.example.com/sign-in

Saludos,
Equipo Ventas SaaS
    `.trim(),
  },
  [EmailTemplate.PAYMENT_RECEIVED]: {
    subject: 'Pago recibido',
    text: `
Hemos recibido tu pago correctamente.

Tu suscripción está al día y puedes seguir usando todas las funcionalidades de Ventas SaaS.

Saludos,
Equipo Ventas SaaS
    `.trim(),
  },
  [EmailTemplate.PAYMENT_PROOF_RECEIVED]: {
    subject: 'Comprobante recibido',
    text: `
Hemos recibido tu comprobante de pago para la empresa "{{companyName}}" (plan "{{planName}}").

Nuestro equipo lo revisarÃ¡ y te notificaremos cuando tu cuenta estÃ© lista para ingresar.

Saludos,
Equipo Ventas SaaS
    `.trim(),
  },
  [EmailTemplate.WELCOME]: {
    subject: 'Bienvenido a Ventas SaaS',
    text: `
¡Bienvenido a Ventas SaaS!

Gracias por registrarte. Tu cuenta está en proceso de aprobación.

Te notificaremos cuando tu cuenta haya sido activada.

Saludos,
Equipo Ventas SaaS
    `.trim(),
  },
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.fromEmail = this.configService.get<string >('EMAIL_FROM') || 'noreply@ventassaas.com';
  }

  async sendEmail(job: SendEmailJob): Promise<void> {
    const template = EMAIL_TEMPLATES[job.template];
    
    if (!template) {
      this.logger.warn(`Unknown email template: ${job.template}`);
      return;
    }

    const text = this.interpolateTemplate(template.text, job.data);
    const subject = this.interpolateTemplate(template.subject, job.data);

    await this.emailQueue.add('send-email', {
      to: job.to,
      from: this.fromEmail,
      subject,
      text,
    });

    this.logger.log(`Email queued: ${job.template} to ${job.to}`);
  }

  async sendEmailDirect(job: SendEmailJob): Promise<void> {
    const template = EMAIL_TEMPLATES[job.template];
    
    if (!template) {
      this.logger.warn(`Unknown email template: ${job.template}`);
      return;
    }

    const text = this.interpolateTemplate(template.text, job.data);
    const subject = this.interpolateTemplate(template.subject, job.data);

    this.logger.log(`[DEMO] Sending email to ${job.to}: ${subject}`);
    this.logger.log(`[DEMO] Email content: ${text}`);
  }

  private interpolateTemplate(text: string, data: Record<string, unknown>): string {
    let result = text;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  async sendSubscriptionPending(userEmail: string, companyName: string): Promise<void> {
    await this.sendEmailDirect({
      to: userEmail,
      subject: '',
      template: EmailTemplate.SUBSCRIPTION_PENDING,
      data: { companyName },
    });
  }

  async sendSubscriptionApproved(userEmail: string, companyName: string): Promise<void> {
    await this.sendEmailDirect({
      to: userEmail,
      subject: '',
      template: EmailTemplate.SUBSCRIPTION_APPROVED,
      data: { companyName },
    });
  }

  async sendSubscriptionRejected(userEmail: string, companyName: string): Promise<void> {
    await this.sendEmailDirect({
      to: userEmail,
      subject: '',
      template: EmailTemplate.SUBSCRIPTION_REJECTED,
      data: { companyName },
    });
  }

  async sendAccountActivated(userEmail: string, companyName: string): Promise<void> {
    await this.sendEmailDirect({
      to: userEmail,
      subject: '',
      template: EmailTemplate.ACCOUNT_ACTIVATED,
      data: { companyName },
    });
  }

  async sendPaymentProofReceived(userEmail: string, companyName: string, planName: string): Promise<void> {
    await this.sendEmailDirect({
      to: userEmail,
      subject: '',
      template: EmailTemplate.PAYMENT_PROOF_RECEIVED,
      data: { companyName, planName },
    });
  }

  async sendTrialExpiringSoon(userEmail: string, companyName: string, planName: string, daysLeft: number): Promise<void> {
    await this.sendEmailDirect({
      to: userEmail,
      subject: `Tu período de prueba termina en ${daysLeft} día(s)`,
      template: EmailTemplate.WELCOME,
      data: { 
        companyName, 
        planName,
        message: `Tu período de prueba del plan "${planName}" termina en ${daysLeft} día(s). Mejora tu plan para continuar sin interrupciones.`
      },
    });
  }

  async sendTrialExpired(userEmail: string, companyName: string, planName: string): Promise<void> {
    await this.sendEmailDirect({
      to: userEmail,
      subject: 'Tu período de prueba ha expirado',
      template: EmailTemplate.WELCOME,
      data: { 
        companyName, 
        planName,
        message: `Tu período de prueba del plan "${planName}" ha expirado. Mejora tu plan para continuar usando el sistema.`
      },
    });
  }
}
