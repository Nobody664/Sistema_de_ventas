import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { ApiKeysService } from "./api-keys.service";
import { CreateApiKeyDto } from "./dto/api-key.dto";

@Controller("integrations/api-keys")
@Roles("COMPANY_ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@CurrentUser() user: AuthUser) {
    return this.keys.list(user);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header("Cache-Control", "private, no-store")
  create(@CurrentUser() user: AuthUser, @Body() input: CreateApiKeyDto) {
    return this.keys.create(user, input);
  }

  @Post(":id/revoke")
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.keys.revoke(user, id);
  }
}
