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

@Global()
@Module({
  imports: [PrismaModule, EmailModule, PassportModule, JwtModule.register({})],
  controllers: [StoreController, StoreAdminController],
  providers: [
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
