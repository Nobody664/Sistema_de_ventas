import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
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
import { DigestService } from "./digest.service";
import { WebPushService } from "./web-push.service";
import {
  ChannelPreferencesDto,
  PushSubscriptionDto,
} from "./dto/notification-channels.dto";

@Controller("notification-channels")
@Roles("COMPANY_ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class NotificationChannelsController {
  constructor(
    private readonly digest: DigestService,
    private readonly push: WebPushService,
  ) {}
  @Get("preferences")
  @Header("Cache-Control", "private, no-store")
  preferences(@CurrentUser() user: AuthUser) {
    return this.digest.preferences(user);
  }
  @Patch("preferences")
  update(@CurrentUser() user: AuthUser, @Body() input: ChannelPreferencesDto) {
    return this.digest.update(user, input);
  }
  @Get("push")
  @Header("Cache-Control", "private, no-store")
  pushStatus(@CurrentUser() user: AuthUser) {
    return this.push.status(user);
  }
  @Post("push")
  subscribe(@CurrentUser() user: AuthUser, @Body() input: PushSubscriptionDto) {
    return this.push.subscribe(user, input);
  }
  @Post("push/:id/remove")
  unsubscribe(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.push.unsubscribe(user, id);
  }
}
