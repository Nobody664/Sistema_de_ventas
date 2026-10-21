import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Permission } from "@/common/constants/permissions.constant";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permissions } from "@/common/decorators/permissions.decorator";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { CreditNotesService } from "./credit-notes.service";
import {
  CreateCreditNoteDto,
  QueryCreditNotesDto,
} from "./dto/credit-note.dto";

@Controller("credit-notes")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Get()
  @Permissions(Permission.CREDIT_NOTE_LIST)
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryCreditNotesDto) {
    return this.creditNotesService.findAll(user.companyId as string, query);
  }

  @Get(":id")
  @Permissions(Permission.CREDIT_NOTE_LIST)
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.creditNotesService.findOne(user.companyId as string, id);
  }

  @Post()
  @Permissions(Permission.CREDIT_NOTE_CREATE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCreditNoteDto) {
    return this.creditNotesService.create(
      user.companyId as string,
      user.sub,
      dto,
    );
  }

  @Patch(":id/status")
  @Permissions(Permission.CREDIT_NOTE_MANAGE)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body("status") status: "ISSUED" | "APPLIED" | "CANCELLED",
  ) {
    return this.creditNotesService.updateStatus(
      user.companyId as string,
      user.sub,
      id,
      status,
    );
  }
}
