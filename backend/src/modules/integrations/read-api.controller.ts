import { Controller, Get, Header, Query, Req, UseGuards } from "@nestjs/common";
import { Public } from "@/common/decorators/public.decorator";
import { ApiKeyGuard, ApiReadScope } from "./api-key.guard";
import { IntegrationPageDto } from "./dto/api-key.dto";
import { ReadApiService } from "./read-api.service";

type ApiRequest = { integration: { companyId: string; keyId: string } };

@Controller("integrations/v1")
@Public()
@UseGuards(ApiKeyGuard)
export class ReadApiController {
  constructor(private readonly reads: ReadApiService) {}

  @Get("catalog")
  @ApiReadScope("catalog.read")
  @Header("Cache-Control", "private, no-store")
  catalog(@Req() req: ApiRequest, @Query() query: IntegrationPageDto) {
    return this.reads.catalog(req.integration.companyId, query);
  }

  @Get("inventory")
  @ApiReadScope("inventory.read")
  @Header("Cache-Control", "private, no-store")
  inventory(@Req() req: ApiRequest, @Query() query: IntegrationPageDto) {
    return this.reads.inventory(req.integration.companyId, query);
  }

  @Get("sales")
  @ApiReadScope("sales.read")
  @Header("Cache-Control", "private, no-store")
  sales(@Req() req: ApiRequest, @Query() query: IntegrationPageDto) {
    return this.reads.sales(req.integration.companyId, query);
  }
}
