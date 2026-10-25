import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { InvoicesService } from "./invoices.service";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import {
  CreateInvoiceTemplateDto,
  UpdateInvoiceTemplateDto,
} from "./dto/invoice.dto";

@Controller("invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Roles("SUPER_ADMIN")
  @Get("templates")
  findTemplates(@CurrentUser() user: AuthUser) {
    return this.invoicesService.findTemplates(user.companyId ?? undefined);
  }

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Get("templates/default")
  @UseGuards(TenantGuard)
  getDefaultTemplate(@Req() request: { tenantId: string }) {
    return this.invoicesService.getDefaultTemplate(request.tenantId);
  }

  @Roles("SUPER_ADMIN")
  @Get("templates/:id")
  findTemplateById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invoicesService.findTemplateById(
      id,
      user.companyId ?? undefined,
    );
  }

  @Roles("SUPER_ADMIN")
  @Post("templates/global")
  createGlobalTemplate(@Body() body: CreateInvoiceTemplateDto) {
    return this.invoicesService.create("", true, body);
  }

  @Roles("SUPER_ADMIN")
  @Post("templates")
  @UseGuards(TenantGuard)
  createTemplate(
    @Req() request: { tenantId: string },
    @Body() body: CreateInvoiceTemplateDto,
  ) {
    return this.invoicesService.create(request.tenantId || "", false, body);
  }

  @Roles("SUPER_ADMIN")
  @Patch("templates/:id")
  updateTemplate(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateInvoiceTemplateDto,
  ) {
    return this.invoicesService.update(id, user.companyId ?? undefined, body);
  }

  @Roles("SUPER_ADMIN")
  @Delete("templates/:id")
  removeTemplate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invoicesService.remove(id, user.companyId ?? undefined);
  }

  @Roles("COMPANY_ADMIN", "MANAGER", "CASHIER")
  @Get("generate/:saleId")
  @UseGuards(TenantGuard)
  generateInvoice(
    @Req() request: { tenantId: string },
    @Param("saleId") saleId: string,
    @CurrentUser() user: AuthUser,
    @Query("templateId") templateId?: string,
  ) {
    return this.invoicesService.generateInvoiceHtml(
      saleId,
      request.tenantId,
      { userId: user.sub, roles: user.roles },
      templateId,
    );
  }
}
