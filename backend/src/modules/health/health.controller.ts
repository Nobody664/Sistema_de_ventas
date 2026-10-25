import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "@/common/decorators/public.decorator";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get("live")
  @ApiOperation({ summary: "Liveness probe - is the service alive?" })
  @ApiResponse({ status: 200, description: "Service is alive" })
  async checkLive() {
    return this.healthService.checkLive();
  }

  @Public()
  @Get("ready")
  @ApiOperation({
    summary: "Readiness probe - is the service ready to accept traffic?",
  })
  @ApiResponse({ status: 200, description: "Service is ready" })
  @ApiResponse({ status: 503, description: "Critical dependency unavailable" })
  async checkReady(@Res({ passthrough: true }) response: Response) {
    const result = await this.healthService.checkReady();
    response.status(result.status === "unavailable" ? 503 : 200);
    return result;
  }

  @Public()
  @Get()
  @ApiOperation({ summary: "Full health status with all checks" })
  @ApiResponse({ status: 200, description: "Full health status" })
  async checkFull() {
    return this.healthService.checkFull();
  }
}
