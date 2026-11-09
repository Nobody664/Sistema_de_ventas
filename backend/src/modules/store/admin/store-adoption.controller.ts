import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Permission } from "@/common/constants/permissions.constant";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { StorePrivateInterceptor } from "../store-private.interceptor";
import { StoreAdminUser } from "./store-admin-context.service";
import { StoreManagementGuard } from "./store-management.guard";
import { StoreAdoptionService } from "./store-adoption.service";
import {
  StoreExperienceDto,
  StoreFormEventDto,
} from "./dto/store-adoption.dto";

@Roles("COMPANY_ADMIN")
@Permissions(Permission.STORE_MANAGE)
@UseGuards(StoreManagementGuard, PermissionsGuard)
@UseInterceptors(StorePrivateInterceptor)
@Controller("store-admin/experience")
export class StoreAdoptionController {
  constructor(private readonly adoption: StoreAdoptionService) {}
  @Get() get(@Req() req: { user: StoreAdminUser }) {
    return this.adoption.get(req.user);
  }
  @Patch() update(
    @Req() req: { user: StoreAdminUser },
    @Body() input: StoreExperienceDto,
  ) {
    return this.adoption.update(req.user, input);
  }
  @Post("events") event(
    @Req() req: { user: StoreAdminUser },
    @Body() input: StoreFormEventDto,
  ) {
    return this.adoption.event(req.user, input);
  }
}
