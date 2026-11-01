import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "@/database/prisma/prisma.module";
import { EmailModule } from "@/modules/email/email.module";
import { StoreAuthGuard } from "@/common/guards/store-auth.guard";
import { StoreController, StoreAdminController } from "./store.controller";
import { StoreStrategy } from "./store.strategy";
import { StoreService } from "./store.service";
import { StoreCryptoService } from "./store-crypto.service";
import { StoreAuthService } from "./store-auth.service";
import { StoreMailService } from "./store-mail.service";
import { StoreStockService } from "./store-stock.service";
import { StoreCartService } from "./store-cart.service";
import { StoreMethodsService } from "./store-methods.service";
import { StoreOrdersService } from "./store-orders.service";
import { StorePaymentsService } from "./store-payments.service";
import {
  StoreOrdersController,
  StoreOrdersAdminController,
  StoreWebhookController,
} from "./store-orders.controller";
import { KardexModule } from "@/modules/kardex/kardex.module";
import { StorePrivateInterceptor } from "./store-private.interceptor";

@Global()
@Module({
  imports: [
    PrismaModule,
    EmailModule,
    PassportModule,
    JwtModule.register({}),
    KardexModule,
  ],
  controllers: [
    StoreController,
    StoreAdminController,
    StoreOrdersController,
    StoreOrdersAdminController,
    StoreWebhookController,
  ],
  providers: [
    StorePrivateInterceptor,
    StoreOrdersService,
    StorePaymentsService,
    StoreStockService,
    StoreCartService,
    StoreMethodsService,
    StoreAuthGuard,
    StoreStrategy,
    StoreService,
    StoreCryptoService,
    StoreAuthService,
    StoreMailService,
  ],
  exports: [StoreAuthGuard],
})
export class StoreModule {}
