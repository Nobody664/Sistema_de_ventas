import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  StoreCommerceSettingsDto,
  StorePaymentMethodDto,
  StoreShippingMethodDto,
} from "./dto/store-commerce.dto";

@Injectable()
export class StoreMethodsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(companyId: string, admin = false) {
    const [payment, shipping] = await Promise.all([
      this.prisma.storePaymentMethod.findMany({
        where: { companyId, ...(admin ? {} : { enabled: true }) },
        orderBy: [{ label: "asc" }, { id: "asc" }],
      }),
      this.prisma.storeShippingMethod.findMany({
        where: { companyId, ...(admin ? {} : { enabled: true }) },
        orderBy: [{ label: "asc" }, { id: "asc" }],
      }),
    ]);
    const gateway = admin
      ? true
      : !!(await this.prisma.storePaymentIntegration.findFirst({
          where: { companyId, enabled: true },
          select: { companyId: true },
        }));
    return {
      payment: payment
        .filter((method) => admin || method.code !== "MERCADOPAGO" || gateway)
        .map((method) => ({
          id: method.id,
          code: method.code,
          label: method.label,
          instructions: method.instructions,
          enabled: method.enabled,
        })),
      shipping: shipping.map((method) => ({
        id: method.id,
        kind: method.kind,
        label: method.label,
        fee: method.fee,
        districts: method.districts,
        pickupAddress: method.pickupAddress,
        enabled: method.enabled,
      })),
    };
  }
  async settings(companyId: string, input: StoreCommerceSettingsDto) {
    if (input.checkoutEnabled) {
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
      });
      if (company.currency !== "PEN")
        throw new BadRequestException("El checkout comercial admite PEN");
    }
    return this.prisma.storefrontSettings.update({
      where: { companyId },
      data: { ...input, version: { increment: 1 } },
    });
  }
  async payment(companyId: string, input: StorePaymentMethodDto) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.storePaymentMethod.upsert({
        where: { companyId_code: { companyId, code: input.code } },
        create: { companyId, ...input },
        update: input,
      });
      await tx.storefrontSettings.update({
        where: { companyId },
        data: { version: { increment: 1 } },
      });
      return result;
    });
  }
  async shipping(
    companyId: string,
    input: StoreShippingMethodDto,
    id?: string,
  ) {
    if (input.kind === "DELIVERY" && !input.districts.length)
      throw new BadRequestException("Define al menos un distrito de cobertura");
    if (input.kind === "PICKUP" && !input.pickupAddress?.trim())
      throw new BadRequestException("Indica la dirección de retiro");
    const data = {
      ...input,
      districts: input.kind === "PICKUP" ? [] : input.districts,
      pickupAddress: input.kind === "DELIVERY" ? null : input.pickupAddress,
    };
    return this.prisma.$transaction(async (tx) => {
      if (id) {
        const result = await tx.storeShippingMethod.updateMany({
          where: { companyId, id },
          data,
        });
        if (!result.count) throw new NotFoundException();
      } else
        await tx.storeShippingMethod.create({ data: { companyId, ...data } });
      await tx.storefrontSettings.update({
        where: { companyId },
        data: { version: { increment: 1 } },
      });
      return { saved: true };
    });
  }
}
