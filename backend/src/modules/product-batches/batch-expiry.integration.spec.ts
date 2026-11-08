import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  ValidationPipe,
  UnauthorizedException,
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { APP_GUARD } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { NextFunction, Request, Response } from "express";
import { AuditService } from "@/common/services/audit.service";
import { RolesGuard } from "@/common/guards/roles.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { FinanceService } from "@/modules/finance/finance.service";
import { shiftDateKey } from "@/common/helpers/company-timezone.helper";
import { BatchExpiryController } from "./batch-expiry.controller";
import { BatchExpiryService } from "./batch-expiry.service";
import { batchExpiryWindow, batchExpiryDays } from "./batch-expiry.policy";

test("el rango de 3 días usa el calendario del negocio e incluye hoy y el tercer día", () => {
  const window = batchExpiryWindow(
    "America/Lima",
    new Date("2026-11-08T03:00:00Z"),
  );
  assert.equal(window.today, "2026-11-07");
  assert.equal(window.lastDay, "2026-11-10");
  assert.equal(
    batchExpiryDays(new Date("2026-11-10T00:00:00Z"), window.today),
    3,
  );
  assert.equal(
    batchExpiryDays(new Date("2026-11-11T00:00:00Z"), window.today),
    4,
  );
  assert.equal(batchExpiryDays(null, window.today), null);
});

test(
  "baja por lote con PostgreSQL: aísla ingresos vigentes, reservas, costo real, kardex, finanzas y reintentos",
  { timeout: 180000 },
  async () => {
    const db = new PGlite();
    const socket = new PGLiteSocketServer({
      db,
      port: 0,
      host: "127.0.0.1",
      maxConnections: 8,
    });
    let prisma: PrismaClient | undefined;
    let app: INestApplication | undefined;
    try {
      for (const migration of readdirSync(resolve("prisma/migrations"), {
        withFileTypes: true,
      })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name)))
        await db.exec(
          readFileSync(
            resolve("prisma/migrations", migration.name, "migration.sql"),
            "utf8",
          ),
        );
      await socket.start();
      prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`,
          ssl: false,
          max: 4,
        }),
      });
      await prisma.$connect();
      const company = await prisma.company.create({
        data: {
          name: "Empresa A",
          slug: "empresa-a",
          timezone: "America/Lima",
          currency: "PEN",
        },
      });
      const other = await prisma.company.create({
        data: { name: "Empresa B", slug: "empresa-b" },
      });
      const owner = await prisma.user.create({
        data: {
          email: "owner@example.test",
          fullName: "Dueño",
          passwordHash: "unused",
        },
      });
      const audit = new AuditService(
        prisma as never,
        { get: () => undefined } as never,
      );
      const service = new BatchExpiryService(prisma as never, audit);
      const finance = new FinanceService(prisma as never, audit);
      const product = await prisma.product.create({
        data: {
          companyId: company.id,
          name: "Leche",
          stockQuantity: 14,
          reservedQuantity: 1,
          costPrice: 9,
          salePrice: 12,
          isActive: true,
        },
      });
      const today = batchExpiryWindow(company.timezone).today;
      const lot = (
        batchNumber: string,
        quantity: number,
        price: number,
        days: number,
        reservedQuantity = 0,
      ) =>
        prisma!.productBatch.create({
          data: {
            companyId: company.id,
            productId: product.id,
            batchNumber,
            quantityReceived: quantity + 2,
            quantityAvailable: quantity,
            reservedQuantity,
            purchasePrice: price,
            expirationDate: new Date(`${shiftDateKey(today, days)}T00:00:00Z`),
          },
        });
      const expired = await lot("VENCIDO-A", 3, 2, -2);
      const reserved = await lot("VENCIDO-RESERVADO", 2, 3, -1, 1);
      const soon = await lot("TERCER-DIA", 4, 4, 3);
      const fresh = await lot("NUEVO-INGRESO", 5, 5, 4);
      const inheritedProduct = await prisma.product.create({
        data: {
          companyId: company.id,
          name: "Lote heredado",
          stockQuantity: 4,
          costPrice: 2,
          salePrice: 3,
          expiryDate: new Date(`${shiftDateKey(today, -2)}T00:00:00Z`),
        },
      });
      const inherited = await prisma.productBatch.create({
        data: {
          companyId: company.id,
          productId: inheritedProduct.id,
          batchNumber: "HEREDADO-VENCIDO",
          quantityReceived: 4,
          quantityAvailable: 4,
          purchasePrice: 2,
          expirationDate: null,
        },
      });
      const inheritedFreshProduct = await prisma.product.create({
        data: {
          companyId: company.id,
          name: "Lote heredado vigente",
          stockQuantity: 2,
          costPrice: 2,
          salePrice: 3,
          expiryDate: new Date(`${shiftDateKey(today, 10)}T00:00:00Z`),
        },
      });
      const inheritedFresh = await prisma.productBatch.create({
        data: {
          companyId: company.id,
          productId: inheritedFreshProduct.id,
          batchNumber: "HEREDADO-VIGENTE",
          quantityReceived: 2,
          quantityAvailable: 2,
          purchasePrice: 2,
          expirationDate: null,
        },
      });
      await prisma.inventoryKardex.create({
        data: {
          companyId: company.id,
          productId: product.id,
          movementDate: new Date(Date.now() - 60000),
          movementType: "IN",
          qtyIn: 14,
          unitCostIn: 53 / 14,
          totalCostIn: 53,
          balanceQty: 14,
          balanceUnitCost: 53 / 14,
          balanceTotalCost: 53,
        },
      });
      const root = await Test.createTestingModule({
        controllers: [BatchExpiryController],
        providers: [
          { provide: BatchExpiryService, useValue: service },
          PermissionsGuard,
          { provide: APP_GUARD, useClass: RolesGuard },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context: {
            switchToHttp: () => { getRequest: () => { user?: unknown } };
          }) => {
            if (!context.switchToHttp().getRequest().user)
              throw new UnauthorizedException();
            return true;
          },
        })
        .overrideGuard(TenantGuard)
        .useValue({ canActivate: () => true })
        .compile();
      app = root.createNestApplication({ logger: false });
      app.use((req: Request, res: Response, next: NextFunction) => {
        const role = req.headers["x-test-role"];
        if (!role) {
          res.status(401).json({ message: "Sesión requerida" });
          return;
        }
        Object.assign(req, {
          user: { sub: owner.id, roles: [role] },
          tenantId: company.id,
        });
        next();
      });
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/batch-expiry`;
      const input = (batch: typeof expired) => ({
        expectedUpdatedAt: batch.updatedAt.toISOString(),
        expectedQuantityAvailable: batch.quantityAvailable.toString(),
        expectedPurchasePrice: batch.purchasePrice.toString(),
        reason: "Baja decidida por vencimiento",
      });
      const post = (id: string, body: unknown) =>
        fetch(`${base}/${id}/write-off`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-test-role": "COMPANY_ADMIN",
          },
          body: JSON.stringify(body),
        });
      const unauthorized = await fetch(base);
      assert.equal(unauthorized.status, 401);
      await unauthorized.arrayBuffer();
      const cashier = await fetch(base, {
        headers: { "x-test-role": "CASHIER" },
      });
      assert.equal(cashier.status, 403);
      await cashier.arrayBuffer();
      const response = await fetch(base, {
        headers: { "x-test-role": "MANAGER" },
      });
      assert.equal(response.status, 200);
      const list = (await response.json()) as {
        counts: { expired: number; expiring: number };
        data: { id: string; expiryInherited?: boolean }[];
      };
      assert.deepEqual(list.counts, { expired: 3, expiring: 1 });
      assert.equal(
        list.data.some((row) => row.id === fresh.id),
        false,
      );
      assert.equal(
        list.data.find((row) => row.id === inherited.id)?.expiryInherited,
        true,
      );
      assert.equal(
        list.data.some((row) => row.id === inheritedFresh.id),
        false,
      );
      const tampered = await post(expired.id, {
        ...input(expired),
        lossAmount: 0,
        companyId: other.id,
      });
      assert.equal(tampered.status, 400);
      await tampered.arrayBuffer();
      const blocked = await post(reserved.id, input(reserved));
      assert.equal(blocked.status, 409);
      await blocked.arrayBuffer();
      const tooEarly = await post(fresh.id, input(fresh));
      assert.equal(tooEarly.status, 400);
      await tooEarly.arrayBuffer();
      const stale = await post(soon.id, {
        ...input(soon),
        expectedPurchasePrice: "999",
      });
      assert.equal(stale.status, 409);
      await stale.arrayBuffer();
      const written = await post(expired.id, input(expired));
      assert.equal(written.status, 201);
      const result = (await written.json()) as {
        lossAmount: string;
        financeRecordId: string;
      };
      assert.equal(result.lossAmount, "6.00");
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
        ).stockQuantity.toString(),
        "11",
      );
      assert.equal(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .isActive,
        true,
      );
      assert.equal(
        (
          await prisma.productBatch.findUniqueOrThrow({
            where: { id: fresh.id },
          })
        ).quantityAvailable.toString(),
        "5",
      );
      assert.equal(
        (
          await prisma.productBatch.findUniqueOrThrow({
            where: { id: soon.id },
          })
        ).quantityAvailable.toString(),
        "4",
      );
      assert.equal(
        (
          await prisma.productBatch.findUniqueOrThrow({
            where: { id: reserved.id },
          })
        ).quantityAvailable.toString(),
        "2",
      );
      const repeat = await post(expired.id, input(expired));
      assert.equal(repeat.status, 409);
      await repeat.arrayBuffer();
      assert.equal(
        await prisma.financeRecord.count({ where: { companyId: company.id } }),
        1,
      );
      const record = await prisma.financeRecord.findUniqueOrThrow({
        where: { id: result.financeRecordId },
      });
      assert.equal(record.direction, "EXIT");
      assert.equal(record.category, "EXPIRY_LOSS");
      assert.equal(record.amount.toString(), "6");
      assert.equal(
        (await finance.findOne(company.id, record.id)).editable,
        false,
      );
      await assert.rejects(
        finance.update(company.id, record.id, { amount: 1 }),
      );
      await assert.rejects(finance.remove(company.id, record.id));
      await assert.rejects(
        service.writeOff(other.id, soon.id, input(soon), owner.id),
      );
      const early = await post(soon.id, input(soon));
      assert.equal(early.status, 201);
      await early.arrayBuffer();
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
        ).stockQuantity.toString(),
        "7",
      );
      assert.equal(
        (
          await prisma.productBatch.findUniqueOrThrow({
            where: { id: fresh.id },
          })
        ).quantityAvailable.toString(),
        "5",
      );
      assert.equal(
        await prisma.financeRecord.count({ where: { companyId: company.id } }),
        2,
      );
      const undoProduct = await prisma.product.create({
        data: {
          companyId: company.id,
          name: "Lote con fallo simulado",
          stockQuantity: 2,
          costPrice: 7,
          salePrice: 9,
        },
      });
      const undoBatch = await prisma.productBatch.create({
        data: {
          companyId: company.id,
          productId: undoProduct.id,
          batchNumber: "REVERSION",
          quantityReceived: 2,
          quantityAvailable: 2,
          purchasePrice: 7,
          expirationDate: new Date(`${shiftDateKey(today, -1)}T00:00:00Z`),
        },
      });
      const failing = new BatchExpiryService(
        prisma as never,
        {
          log: async () => {
            throw new Error("Fallo final de auditoría");
          },
        } as never,
      );
      await assert.rejects(
        failing.writeOff(company.id, undoBatch.id, input(undoBatch), owner.id),
        /Fallo final/,
      );
      assert.equal(
        (
          await prisma.productBatch.findUniqueOrThrow({
            where: { id: undoBatch.id },
          })
        ).quantityAvailable.toString(),
        "2",
      );
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: undoProduct.id },
          })
        ).stockQuantity.toString(),
        "2",
      );
      assert.equal(
        await prisma.inventoryMovement.count({
          where: { productId: undoProduct.id },
        }),
        0,
      );
      assert.equal(
        await prisma.inventoryKardex.count({
          where: { productId: undoProduct.id },
        }),
        0,
      );
      assert.equal(
        await prisma.financeRecord.count({ where: { companyId: company.id } }),
        2,
      );
      await service.writeOff(
        company.id,
        undoBatch.id,
        input(undoBatch),
        owner.id,
      );
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: undoProduct.id },
          })
        ).isActive,
        true,
      );
      const inheritedWrite = await post(inherited.id, input(inherited));
      assert.equal(inheritedWrite.status, 201);
      await inheritedWrite.arrayBuffer();
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: inheritedProduct.id },
          })
        ).stockQuantity.toString(),
        "0",
      );
      assert.equal(
        await prisma.auditLog.count({ where: { entity: "ProductBatch" } }),
        4,
      );
    } finally {
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
      await socket.stop();
      await db.close();
    }
  },
);
