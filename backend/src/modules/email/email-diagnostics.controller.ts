import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsOptional, IsUUID } from "class-validator";
import { randomUUID } from "node:crypto";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { EmailTransportService } from "./email-transport.service";

export class EmailTestDto {
  @IsEmail() to!: string;
  @IsOptional() @IsUUID() testId?: string;
}

@Controller("platform/email")
@Roles("SUPER_ADMIN")
@Permissions(Permission.PLATFORM_MANAGE_SETTINGS)
@UseGuards(PlatformGuard, PermissionsGuard)
export class EmailDiagnosticsController {
  constructor(private readonly transport: EmailTransportService) {}
  @Get() status() {
    return this.transport.status();
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } }) @Post("verify") verify() {
    return this.transport.verify();
  }
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) @Post("test") test(
    @Body() input: EmailTestDto,
  ) {
    return this.transport.send({
      to: input.to,
      subject: "Prueba de correo - Sistema de ventas",
      text: "Mensaje de prueba para comprobar el envío de correos de la aplicación. No contiene enlaces de acceso ni datos de clientes.",
      messageId: `<email-test-${input.testId ?? randomUUID()}@notifications.ventas>`,
    });
  }
}
