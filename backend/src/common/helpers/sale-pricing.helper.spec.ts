import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateSaleDto } from "@/modules/sales/dto/sale.dto";
import { RegisterDistributorSaleDto } from "@/modules/distributors/dto/distributor.dto";
import { resolveSaleLines, saleAmounts } from "./sale-pricing.helper";

const product = {
  id: "p",
  name: "Product",
  salePrice: new Prisma.Decimal(10),
  isActive: true,
  deletedAt: null,
  presentations: [
    { id: "box", factor: new Prisma.Decimal(12), price: null, isActive: true },
  ],
};

describe("Server sale pricing", () => {
  it("charges the factor-adjusted price when the presentation has no own price", () => {
    const [line] = resolveSaleLines(
      [product],
      [{ productId: "p", presentationId: "box", quantity: 2 }],
    );
    assert.equal(line.unitPrice.toString(), "120");
    assert.equal(line.totalPrice.toString(), "240");
    assert.equal(line.baseQuantity.toString(), "24");
  });

  it("preserves a presentation's own price and normalizes repeated identical lines", () => {
    const priced = {
      ...product,
      presentations: [
        { ...product.presentations[0], price: new Prisma.Decimal(90) },
      ],
    };
    const lines = resolveSaleLines(
      [priced],
      [
        { productId: "p", presentationId: "box", quantity: 1 },
        { productId: "p", presentationId: "box", quantity: 2 },
      ],
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0].quantity.toString(), "3");
    assert.equal(lines[0].totalPrice.toString(), "270");
  });

  it("does not silently merge different presentations or negotiated prices", () => {
    assert.throws(
      () =>
        resolveSaleLines(
          [product],
          [
            { productId: "p", quantity: 1 },
            { productId: "p", presentationId: "box", quantity: 1 },
          ],
        ),
      BadRequestException,
    );
    assert.throws(
      () =>
        resolveSaleLines(
          [product],
          [
            { productId: "p", quantity: 1, unitPrice: 8 },
            { productId: "p", quantity: 1, unitPrice: 9 },
          ],
          true,
        ),
      BadRequestException,
    );
  });

  it("allows explicit negotiated prices only in the authorized pricing mode", () => {
    assert.throws(
      () =>
        resolveSaleLines(
          [product],
          [{ productId: "p", quantity: 1, unitPrice: 8 }],
        ),
      BadRequestException,
    );
    assert.equal(
      resolveSaleLines(
        [product],
        [{ productId: "p", quantity: 1, unitPrice: 8 }],
        true,
      )[0].totalPrice.toString(),
      "8",
    );
  });

  it("rejects negative tax, excessive discounts, null, nonfinite and over-precision amounts", () => {
    for (const value of [-100, NaN, Infinity, null, 0.001])
      assert.throws(
        () => saleAmounts(new Prisma.Decimal(10), value as number),
        BadRequestException,
      );
    assert.throws(
      () => saleAmounts(new Prisma.Decimal(10), 0, 11),
      BadRequestException,
    );
    assert.equal(
      saleAmounts(new Prisma.Decimal(10), 1.8, 2).totalAmount.toString(),
      "9.8",
    );
  });

  it("rejects inactive presentations and quantities which cannot be represented in stock", () => {
    const inactive = {
      ...product,
      presentations: [{ ...product.presentations[0], isActive: false }],
    };
    assert.throws(
      () =>
        resolveSaleLines(
          [inactive],
          [{ productId: "p", presentationId: "box", quantity: 1 }],
        ),
      BadRequestException,
    );
    const tiny = {
      ...product,
      presentations: [
        { ...product.presentations[0], factor: new Prisma.Decimal("0.001") },
      ],
    };
    assert.throws(
      () =>
        resolveSaleLines(
          [tiny],
          [{ productId: "p", presentationId: "box", quantity: 0.001 }],
        ),
      BadRequestException,
    );
  });

  it("validates the HTTP contract and accepts presentations/fractions in distributor sales", async () => {
    for (const amount of [-1, null, 0.001]) {
      const errors = await validate(
        plainToInstance(CreateSaleDto, {
          paymentMethod: "CASH",
          items: [{ productId: "p", quantity: 1 }],
          taxAmount: amount,
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      );
      assert.ok(errors.length > 0);
    }
    const errors = await validate(
      plainToInstance(RegisterDistributorSaleDto, {
        paymentMethod: "CASH",
        items: [{ productId: "p", presentationId: "box", quantity: 0.5 }],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    assert.equal(errors.length, 0);
  });
});
