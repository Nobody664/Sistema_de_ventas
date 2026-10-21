import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { SupportFaqService, FaqActor } from "./support-faq.service";
import {
  CreateFaqDto,
  FaqFeedbackDto,
  QueryFaqDto,
  UpdateFaqDto,
} from "./dto/faq.dto";

function toActor(user: AuthUser): FaqActor {
  return {
    userId: user.sub,
    companyId: user.companyId,
    isPlatform:
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("SUPPORT_ADMIN"),
  };
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("support/faqs")
export class SupportFaqController {
  constructor(private readonly faqService: SupportFaqService) {}

  @Permissions(Permission.SUPPORT_FAQ_VIEW)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryFaqDto) {
    return this.faqService.findAll(toActor(user), query);
  }

  @Permissions(Permission.SUPPORT_FAQ_VIEW)
  @Get("search")
  search(@CurrentUser() user: AuthUser, @Query("q") q?: string) {
    return this.faqService.search(toActor(user), q ?? "");
  }

  @Permissions(Permission.SUPPORT_FAQ_VIEW)
  @Get(":id")
  findById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.faqService.findById(toActor(user), id);
  }

  @Permissions(Permission.SUPPORT_FAQ_MANAGE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateFaqDto) {
    return this.faqService.create(toActor(user), body);
  }

  @Permissions(Permission.SUPPORT_FAQ_MANAGE)
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateFaqDto,
  ) {
    return this.faqService.update(toActor(user), id, body);
  }

  @Permissions(Permission.SUPPORT_FAQ_MANAGE)
  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.faqService.remove(toActor(user), id);
  }

  @Permissions(Permission.SUPPORT_FAQ_VIEW)
  @Post(":id/feedback")
  feedback(@Param("id") id: string, @Body() body: FaqFeedbackDto) {
    return this.faqService.submitFeedback(id, body.helpful);
  }
}
