import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, CustomerAccount, User } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import {
  StoreCryptoService,
  storeHash,
  storeToken,
} from "./store-crypto.service";
import { StoreMailService } from "./store-mail.service";
import { StoreService } from "./store.service";
import { StoreActor } from "./store.strategy";
import {
  StoreAddressDto,
  StoreLoginDto,
  StoreProfileDto,
  StoreRegisterDto,
  StoreResetDto,
} from "./dto/store.dto";

const GENERIC = {
  message:
    "Si los datos corresponden a una cuenta de esta tienda recibirás instrucciones por correo.",
};

@Injectable()
export class StoreAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly crypto: StoreCryptoService,
    private readonly jwt: JwtService,
    private readonly mail: StoreMailService,
    private readonly config: ConfigService,
  ) {}
  private async action(
    tx: Prisma.TransactionClient,
    account: CustomerAccount & { user: User },
    slug: string,
    purpose: "VERIFY" | "RESET",
  ) {
    const token = storeToken();
    await tx.storeAccountAction.create({
      data: {
        hash: storeHash(token),
        companyId: account.companyId,
        accountId: account.id,
        purpose,
        expiresAt: new Date(
          Date.now() + (purpose === "RESET" ? 900000 : 3600000),
        ),
      },
    });
    const base = this.config
      .getOrThrow<string>("FRONTEND_URL")
      .replace(/\/+$/, "");
    const link = `${base}/tienda/${encodeURIComponent(slug)}/${purpose === "VERIFY" ? "verificar" : "restablecer"}?token=${token}`;
    await this.mail.enqueue(
      tx,
      account.user.email,
      purpose === "VERIFY"
        ? "Verifica tu cuenta de cliente"
        : "Recupera tu cuenta de cliente",
      `Usa este enlace de un solo uso: ${link}`,
    );
  }
  async register(slug: string, input: StoreRegisterDto) {
    const company = await this.store.company(slug);
    if (!company.storefront?.registrationEnabled)
      throw new ForbiddenException("El registro está cerrado");
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (
      existing &&
      (!existing.isActive ||
        !(await argon2.verify(existing.passwordHash, input.password)))
    )
      return GENERIC;
    const passwordHash =
      existing?.passwordHash ?? (await argon2.hash(input.password));
    await serializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT company_id FROM storefront_settings WHERE company_id = ${company.id} FOR UPDATE`;
      const settings = await tx.storefrontSettings.findUniqueOrThrow({
        where: { companyId: company.id },
      });
      if (
        (await tx.customerAccount.count({
          where: { companyId: company.id },
        })) >= settings.maxCustomers
      )
        throw new ForbiddenException(
          "La tienda alcanzó su capacidad de cuentas comerciales",
        );
      const user =
        existing ??
        (await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: `${input.firstName.trim()} ${input.lastName.trim()}`,
            globalRole: "USER",
          },
        }));
      let account = await tx.customerAccount.findUnique({
        where: { companyId_userId: { companyId: company.id, userId: user.id } },
        include: { user: true },
      });
      if (!account) {
        const customer = await tx.customer.upsert({
          where: { companyId_email: { companyId: company.id, email } },
          create: {
            companyId: company.id,
            email,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
          },
          update: {},
        });
        if (customer.deletedAt)
          throw new ConflictException(
            "Solicita al negocio la vinculación de tu ficha",
          );
        account = await tx.customerAccount.create({
          data: {
            companyId: company.id,
            userId: user.id,
            customerId: customer.id,
          },
          include: { user: true },
        });
      }
      if (account.status === "PENDING_VERIFICATION")
        await this.action(tx, account, slug, "VERIFY");
    });
    return GENERIC;
  }
  async sendAction(slug: string, email: string, purpose: "VERIFY" | "RESET") {
    const company = await this.store.company(slug, false);
    const account = await this.prisma.customerAccount.findFirst({
      where: {
        companyId: company.id,
        user: { email: email.trim().toLowerCase(), isActive: true },
        status: purpose === "RESET" ? "ACTIVE" : "PENDING_VERIFICATION",
      },
      include: { user: true },
    });
    if (account)
      await serializableTransaction(this.prisma, (tx) =>
        this.action(tx, account, slug, purpose),
      );
    return GENERIC;
  }
  async verify(slug: string, raw: string) {
    return serializableTransaction(this.prisma, async (tx) => {
      const action = await tx.storeAccountAction.findFirst({
        where: {
          hash: storeHash(raw),
          purpose: "VERIFY",
          usedAt: null,
          expiresAt: { gt: new Date() },
          account: { company: { slug }, status: "PENDING_VERIFICATION" },
        },
      });
      if (!action)
        throw new BadRequestException("El enlace no es válido o ha vencido");
      const used = await tx.storeAccountAction.updateMany({
        where: { hash: action.hash, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!used.count) throw new ConflictException("Enlace ya utilizado");
      await tx.customerAccount.update({
        where: { id: action.accountId },
        data: { status: "ACTIVE", verifiedAt: new Date() },
      });
      return { message: "Cuenta verificada. Ya puedes ingresar." };
    });
  }
  private async access(
    session: {
      id: string;
      accountId: string;
      companyId: string;
      authVersion: number;
    },
    userId: string,
  ) {
    return this.jwt.signAsync(
      {
        sub: userId,
        sid: session.id,
        accountId: session.accountId,
        companyId: session.companyId,
        authVersion: session.authVersion,
        roles: ["USUARIO_CLIENTE_FINAL"],
      },
      { secret: this.crypto.signingKey(), audience: "store", expiresIn: "15m" },
    );
  }
  async login(slug: string, input: StoreLoginDto) {
    const company = await this.store.company(slug, false);
    const account = await this.prisma.customerAccount.findFirst({
      where: {
        companyId: company.id,
        user: { email: input.email.trim().toLowerCase() },
      },
      include: { user: true },
    });
    if (
      !account ||
      account.status !== "ACTIVE" ||
      !account.user.isActive ||
      !(await argon2.verify(account.user.passwordHash, input.password))
    )
      throw new UnauthorizedException(
        "Credenciales inválidas o cuenta pendiente de verificación",
      );
    const raw = storeToken();
    const session = await this.prisma.storeSession.create({
      data: {
        companyId: company.id,
        accountId: account.id,
        authVersion: account.user.authVersion,
        expiresAt: new Date(Date.now() + 30 * 86400000),
        tokens: { create: { hash: storeHash(raw) } },
      },
    });
    return {
      accessToken: await this.access(session, account.userId),
      refreshToken: raw,
    };
  }
  async refresh(slug: string, raw?: string) {
    if (!raw) throw new UnauthorizedException();
    const result = await serializableTransaction(this.prisma, async (tx) => {
      const token = await tx.storeRefreshToken.findUnique({
        where: { hash: storeHash(raw) },
        include: {
          session: {
            include: { account: { include: { user: true, company: true } } },
          },
        },
      });
      if (!token || token.session.account.company.slug !== slug) return null;
      const { session } = token;
      if (
        token.usedAt ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.account.status !== "ACTIVE" ||
        !session.account.user.isActive ||
        session.authVersion !== session.account.user.authVersion
      ) {
        await tx.storeSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      const changed = await tx.storeRefreshToken.updateMany({
        where: { hash: token.hash, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!changed.count) {
        await tx.storeSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      const next = storeToken();
      await tx.storeRefreshToken.create({
        data: { hash: storeHash(next), sessionId: session.id },
      });
      return { session, raw: next };
    });
    if (!result) throw new UnauthorizedException("Renueva el acceso comercial");
    return {
      accessToken: await this.access(
        result.session,
        result.session.account.userId,
      ),
      refreshToken: result.raw,
    };
  }
  async resetPassword(slug: string, input: StoreResetDto) {
    const hash = await argon2.hash(input.password);
    await serializableTransaction(this.prisma, async (tx) => {
      const action = await tx.storeAccountAction.findFirst({
        where: {
          hash: storeHash(input.token),
          purpose: "RESET",
          usedAt: null,
          expiresAt: { gt: new Date() },
          account: { company: { slug }, status: "ACTIVE" },
        },
        include: { account: true },
      });
      if (!action)
        throw new BadRequestException("El enlace no es válido o ha vencido");
      const changed = await tx.storeAccountAction.updateMany({
        where: { hash: action.hash, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (!changed.count) throw new ConflictException();
      await tx.user.update({
        where: { id: action.account.userId },
        data: { passwordHash: hash, authVersion: { increment: 1 } },
      });
      await tx.storeSession.updateMany({
        where: { account: { userId: action.account.userId } },
        data: { revokedAt: new Date() },
      });
    });
    return { message: "Contraseña actualizada. Ingresa nuevamente." };
  }
  async me(actor: StoreActor) {
    const account = await this.prisma.customerAccount.findUniqueOrThrow({
      where: { id: actor.accountId },
      select: {
        status: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            documentValue: true,
          },
        },
        user: { select: { email: true } },
        addresses: true,
      },
    });
    return {
      accountId: actor.accountId,
      role: "USUARIO_CLIENTE_FINAL",
      ...account.customer,
      email: account.user.email,
      status: account.status,
      addresses: account.addresses,
    };
  }
  async profile(actor: StoreActor, input: StoreProfileDto) {
    await this.prisma.customer.updateMany({
      where: { id: actor.customerId, companyId: actor.companyId },
      data: { ...input, documentType: "DNI" },
    });
    return this.me(actor);
  }
  async address(actor: StoreActor, input: StoreAddressDto, id?: string) {
    await serializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM customer_accounts WHERE id = ${actor.accountId} FOR UPDATE`;
      if (input.isDefault)
        await tx.customerAddress.updateMany({
          where: { companyId: actor.companyId, accountId: actor.accountId },
          data: { isDefault: false },
        });
      if (id) {
        const updated = await tx.customerAddress.updateMany({
          where: { id, companyId: actor.companyId, accountId: actor.accountId },
          data: input,
        });
        if (!updated.count)
          throw new BadRequestException("Dirección no encontrada");
      } else
        await tx.customerAddress.create({
          data: {
            ...input,
            companyId: actor.companyId,
            accountId: actor.accountId,
          },
        });
    });
    return this.me(actor);
  }
}
