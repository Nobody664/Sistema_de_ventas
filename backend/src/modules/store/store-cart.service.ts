import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { StoreActor } from "./store.strategy";
import { StoreService } from "./store.service";
import { StoreStockService } from "./store-stock.service";
import { StoreCartItemDto, StoreQuoteDto } from "./dto/store-commerce.dto";
import { StoreSnapshot, storeAmounts } from "./store-pricing";

@Injectable()
export class StoreCartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly stock: StoreStockService,
  ) {}
  private async ensure(actor: StoreActor) {
    return this.prisma.storeCart.upsert({
      where: {
        companyId_accountId: {
          companyId: actor.companyId,
          accountId: actor.accountId,
        },
      },
      create: { companyId: actor.companyId, accountId: actor.accountId },
      update: {},
    });
  }
  async cart(actor: StoreActor) {
    const cart = await this.ensure(actor);
    const items = await this.prisma.storeCartItem.findMany({
      where: { cartId: cart.id },
      include: {
        product: {
          select: {
            name: true,
            salePrice: true,
            baseUnit: true,
            storeVisible: true,
            isActive: true,
            deletedAt: true,
            presentations: {
              select: {
                id: true,
                name: true,
                price: true,
                factor: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });
    return {
      version: cart.version,
      items: items.map((item) => {
        const p = item.product.presentations.find(
          (p) => p.id === item.presentationId && p.isActive,
        );
        return {
          productId: item.productId,
          presentationId: item.presentationId,
          name: item.product.name,
          presentationName: p?.name ?? null,
          quantity: item.quantity.toString(),
          unitPrice: (
            p?.price ?? item.product.salePrice.mul(p?.factor ?? 1)
          ).toString(),
          unavailable:
            !item.product.storeVisible ||
            !item.product.isActive ||
            !!item.product.deletedAt ||
            (!!item.presentationId && !p),
        };
      }),
    };
  }
  async change(slug: string, actor: StoreActor, input: StoreCartItemDto) {
    await this.store.company(slug);
    const cart = await this.ensure(actor);
    await serializableTransaction(this.prisma, async (tx) => {
      const changed = await tx.storeCart.updateMany({
        where: {
          id: cart.id,
          accountId: actor.accountId,
          version: input.version,
        },
        data: { version: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException(
          "El carrito cambió. Actualiza antes de continuar.",
        );
      if (input.quantity === 0) {
        await tx.storeCartItem.deleteMany({
          where: { cartId: cart.id, productId: input.productId },
        });
        return;
      }
      const product = await tx.product.findFirst({
        where: {
          id: input.productId,
          companyId: actor.companyId,
          isActive: true,
          deletedAt: null,
          storeVisible: true,
        },
        include: { presentations: true },
      });
      if (!product) throw new NotFoundException("Producto no disponible");
      const presentation = input.presentationId
        ? product.presentations.find(
            (p) => p.id === input.presentationId && p.isActive,
          )
        : null;
      if (input.presentationId && !presentation)
        throw new BadRequestException("Presentación no disponible");
      if (
        (presentation || product.baseUnit === "UNIT") &&
        !Number.isInteger(input.quantity)
      )
        throw new BadRequestException(
          "Las unidades y presentaciones requieren cantidades enteras",
        );
      if (
        (await tx.storeCartItem.count({ where: { cartId: cart.id } })) >= 100 &&
        !(await tx.storeCartItem.findUnique({
          where: {
            cartId_productId: { cartId: cart.id, productId: product.id },
          },
        }))
      )
        throw new BadRequestException("El carrito admite hasta 100 productos");
      const current = await tx.storeCartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      });
      if (current && current.presentationId !== (input.presentationId ?? null))
        throw new ConflictException(
          "Retira primero este producto para cambiar su presentación",
        );
      await tx.storeCartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: product.id } },
        create: {
          companyId: actor.companyId,
          cartId: cart.id,
          productId: product.id,
          presentationId: input.presentationId,
          quantity: input.quantity,
        },
        update: { quantity: input.quantity },
      });
    });
    return this.cart(actor);
  }
  async quote(slug: string, actor: StoreActor, input: StoreQuoteDto) {
    const company = await this.store.company(slug);
    if (!company.storefront?.checkoutEnabled || company.currency !== "PEN")
      throw new BadRequestException("El checkout no está habilitado");
    const cart = await this.ensure(actor);
    if (cart.version !== input.cartVersion)
      throw new ConflictException("El carrito cambió");
    const [items, customer, payment, shipping, address] = await Promise.all([
      this.prisma.storeCartItem.findMany({
        where: { cartId: cart.id },
        include: { product: { include: { presentations: true } } },
      }),
      this.prisma.customer.findUniqueOrThrow({
        where: { id: actor.customerId },
      }),
      this.prisma.storePaymentMethod.findFirst({
        where: {
          id: input.paymentMethodId,
          companyId: actor.companyId,
          enabled: true,
        },
      }),
      this.prisma.storeShippingMethod.findFirst({
        where: {
          id: input.shippingMethodId,
          companyId: actor.companyId,
          enabled: true,
        },
      }),
      input.addressId
        ? this.prisma.customerAddress.findFirst({
            where: {
              id: input.addressId,
              companyId: actor.companyId,
              accountId: actor.accountId,
            },
          })
        : null,
    ]);
    if (
      !customer.lastName ||
      !customer.phone ||
      !/^\d{8}$/.test(customer.documentValue ?? "")
    )
      throw new BadRequestException(
        "Completa tu perfil, DNI y teléfono antes de comprar",
      );
    if (!items.length || items.length > 100 || !payment || !shipping)
      throw new BadRequestException("Revisa carrito, pago y envío");
    if (
      shipping.kind === "DELIVERY" &&
      (!address || !shipping.districts.includes(address.district))
    )
      throw new BadRequestException(
        "La dirección no tiene cobertura para este envío",
      );
    if (payment.code === "CASH_ON_PICKUP" && shipping.kind !== "PICKUP")
      throw new BadRequestException(
        "El efectivo solo está disponible para retiro",
      );
    const availability = await this.stock.available(
      actor.companyId,
      items.map((item) => item.productId),
    );
    const lines = items.map((item) => {
      const product = item.product;
      const p = item.presentationId
        ? product.presentations.find(
            (p) => p.id === item.presentationId && p.isActive,
          )
        : null;
      if (
        !product.isActive ||
        product.deletedAt ||
        !product.storeVisible ||
        (item.presentationId && !p)
      )
        throw new BadRequestException(
          "Un producto del carrito ya no está disponible",
        );
      const factor = p?.factor ?? new Prisma.Decimal(1);
      const baseQuantity = item.quantity.mul(factor);
      if (
        baseQuantity.decimalPlaces() > 3 ||
        baseQuantity.lte(0) ||
        ((p || product.baseUnit === "UNIT") && !item.quantity.isInteger())
      )
        throw new BadRequestException(
          "Cantidad no representable en inventario",
        );
      if (
        (availability.get(product.id) ?? new Prisma.Decimal(0)).lt(baseQuantity)
      )
        throw new BadRequestException(`Stock insuficiente: ${product.name}`);
      return {
        productId: item.productId,
        presentationId: item.presentationId,
        name: product.name,
        presentationName: p?.name ?? null,
        quantity: item.quantity.toString(),
        factor: factor.toString(),
        baseQuantity: baseQuantity.toString(),
        price: p?.price ?? product.salePrice.mul(factor),
      };
    });
    const calculated = storeAmounts(
      lines.map((line) => ({
        quantity: new Prisma.Decimal(line.quantity),
        price: line.price,
      })),
      shipping.fee,
      company.storefront.taxRate,
      company.storefront.pricesIncludeTax,
    );
    const snapshot: StoreSnapshot = {
      currency: "PEN",
      buyer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        documentValue: customer.documentValue!,
        phone: customer.phone,
      },
      payment: {
        id: payment.id,
        code: payment.code,
        label: payment.label,
        instructions: payment.instructions,
      },
      shipping: {
        id: shipping.id,
        kind: shipping.kind as "PICKUP" | "DELIVERY",
        label: shipping.label,
        pickupAddress: shipping.pickupAddress,
      },
      address:
        shipping.kind === "DELIVERY" && address
          ? {
              recipient: address.recipient,
              phone: address.phone,
              street: address.street,
              district: address.district,
              reference: address.reference,
            }
          : null,
      lines: lines.map(({ price: _price, ...line }, i) => ({
        ...line,
        unitPrice: calculated.lines[i].unitPrice,
        totalPrice: calculated.lines[i].totalPrice,
      })),
      subtotal: calculated.subtotal,
      taxAmount: calculated.taxAmount,
      shippingAmount: calculated.shippingAmount,
      totalAmount: calculated.totalAmount,
    };
    const quote = await this.prisma.storeQuote.create({
      data: {
        companyId: actor.companyId,
        accountId: actor.accountId,
        cartVersion: cart.version,
        settingsVersion: company.storefront.version,
        expiresAt: new Date(Date.now() + 300000),
        snapshot,
      },
    });
    return { id: quote.id, expiresAt: quote.expiresAt, snapshot };
  }
}
