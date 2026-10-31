import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { WebhooksService } from "./webhooks.service";
import { CreateWebhookDto } from "./dto/webhook.dto";

@Controller("integrations/webhooks")
@Roles("COMPANY_ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@CurrentUser() user: AuthUser) {
    return this.webhooks.list(user);
  }
  @Post()
  @Header("Cache-Control", "private, no-store")
  create(@CurrentUser() user: AuthUser, @Body() input: CreateWebhookDto) {
    return this.webhooks.create(user, input);
  }
  @Post(":id/disable")
  disable(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.webhooks.disable(user, id);
  }
  @Get(":id/deliveries")
  @Header("Cache-Control", "private, no-store")
  history(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.webhooks.history(user, id);
  }
}
