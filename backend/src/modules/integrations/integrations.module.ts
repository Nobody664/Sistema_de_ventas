import { Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys.controller";
import { ReadApiController } from "./read-api.controller";
import { ReadApiService } from "./read-api.service";
import { ApiKeysService } from "./api-keys.service";
import { IntegrationOwnerService } from "./integration-owner.service";
import { ApiKeyGuard } from "./api-key.guard";
import { IntegrationSecretsService } from "./integration-secrets.service";
import { WebhookTransportService } from "./webhook-transport.service";
import { WebhooksService } from "./webhooks.service";
import { WebhooksController } from "./webhooks.controller";

@Module({
  controllers: [ApiKeysController, ReadApiController, WebhooksController],
  providers: [
    ApiKeysService,
    ReadApiService,
    IntegrationOwnerService,
    ApiKeyGuard,
    IntegrationSecretsService,
    WebhookTransportService,
    WebhooksService,
  ],
  exports: [
    WebhooksService,
    IntegrationOwnerService,
    IntegrationSecretsService,
  ],
})
export class IntegrationsModule {}
