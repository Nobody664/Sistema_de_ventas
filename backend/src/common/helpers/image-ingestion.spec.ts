import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentProvider } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { AuditService } from "@/common/services/audit.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import { ProductsService } from "@/modules/products/products.service";
import { InvoicesService } from "@/modules/invoices/invoices.service";
import { PaymentsService } from "@/modules/payments/payments.service";
import { PaymentSettingsService } from "@/modules/payments/payment-settings.service";
import { CheckoutRequestsService } from "@/modules/payments/checkout-requests.service";
import { PlanUpgradeRequestsService } from "@/modules/subscriptions/plan-upgrade-requests.service";
import { EmailService } from "@/modules/email/email.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import {
  UpdatePaymentSettingsDto,
  UploadPaymentImageDto,
} from "@/modules/payments/dto/payment-settings.dto";

describe("image ingestion boundaries", () => {
  it("rejects invalid content before writes on every image ingestion path", async () => {
    let writes = 0;
    const write = async (): Promise<never> => {
      writes++;
      throw new Error("Unexpected write");
    };
    const prisma = {
      product: {
        findFirst: async () => ({ id: "product", companyId: "company" }),
        create: write,
        update: write,
        updateMany: write,
      },
      invoiceTemplate: {
        findFirst: async () => ({ id: "template", companyId: "company" }),
        create: write,
        update: write,
        updateMany: write,
      },
      payment: {
        findFirst: async () => ({
          status: "PENDING",
          subscriptionId: "subscription",
        }),
      },
      subscription: { findFirst: async () => ({ id: "subscription" }) },
      paymentProof: { findFirst: async () => null, create: write },
      paymentSetting: {
        findFirst: async () => null,
        create: write,
        update: write,
      },
      checkoutRequest: { updateMany: write },
      planUpgradeRequest: { updateMany: write },
    } as unknown as PrismaService;
    const notifications = {} as NotificationsService;
    const email = {} as EmailService;
    const products = new ProductsService(
      prisma,
      {
        validateLimit: async () => undefined,
      } as unknown as SubscriptionLimitService,
      {} as LowStockService,
      {} as AuditService,
    );
    const settings = new PaymentSettingsService(prisma);
    const payments = new PaymentsService(
      new ConfigService(),
      prisma,
      notifications,
      email,
    );
    const invoices = new InvoicesService(prisma);
    const checkout = new CheckoutRequestsService(prisma, email, notifications);
    const upgrades = new PlanUpgradeRequestsService(
      prisma,
      email,
      notifications,
      {} as PlanCapabilitiesService,
    );
    for (const image of [
      "data:image/png;base64,SGVsbG8=",
      "https://example.com/fake.png",
    ]) {
      const calls: Array<() => Promise<unknown>> = [
        () =>
          products.createProduct("company", {
            name: "Product",
            costPrice: 1,
            salePrice: 2,
            imageUrl: image,
          }),
        () => products.updateProduct("company", "product", { imageUrl: image }),
        () => products.uploadProductImage("company", "product", image),
        () =>
          settings.updateSettings(PaymentProvider.YAPE, {
            qrImageBase64: image,
          }),
        () =>
          settings.uploadPaymentProof(
            "subscription",
            { imageBase64: image, amount: "10" },
            "company",
          ),
        () => payments.uploadProofForPayment("payment", "company", image),
        () =>
          checkout.submitProof("checkout", "company", { imageBase64: image }),
        () =>
          upgrades.submitProof("upgrade", "company", { imageBase64: image }),
        () =>
          invoices.create("company", false, {
            logoUrl: image,
            isDefault: true,
          }),
        () =>
          invoices.update("template", "company", {
            logoUrl: image,
            isDefault: true,
          }),
      ];
      for (const call of calls) await assert.rejects(call, BadRequestException);
    }
    assert.equal(writes, 0);
  });

  it("allows saving settings without a QR and clearing it without bypassing validation", async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    for (const qrImageBase64 of [undefined, null, ""]) {
      const body = { isEnabled: true, qrImageBase64 };
      await pipe.transform(body, {
        type: "body",
        metatype: UpdatePaymentSettingsDto,
      });
      let written: unknown;
      const prisma = {
        paymentSetting: {
          findFirst: async () => ({ id: "setting" }),
          update: async ({ data }: { data: unknown }) => {
            written = data;
            return data;
          },
        },
      } as unknown as PrismaService;
      await new PaymentSettingsService(prisma).updateSettings(
        PaymentProvider.YAPE,
        body as UpdatePaymentSettingsDto,
      );
      assert.ok(written);
    }
    await assert.rejects(
      pipe.transform(
        { qrImageBase64: 0 },
        {
          type: "body",
          metatype: UpdatePaymentSettingsDto,
        },
      ),
      BadRequestException,
    );
  });

  it("validates payment proof DTO types, dates and unexpected request fields", async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    for (const body of [
      { imageBase64: 123 },
      { imageBase64: "data:image/png;base64,AAAA", execute: "command" },
      { imageBase64: "data:image/png;base64,AAAA", paymentDate: "not-a-date" },
    ]) {
      await assert.rejects(
        pipe.transform(body, { type: "body", metatype: UploadPaymentImageDto }),
        BadRequestException,
      );
    }
  });
});
