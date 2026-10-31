import { Module } from "@nestjs/common";
import { OutboxModule } from "./modules/outbox/outbox.module";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";

import { PrismaModule } from "./database/prisma/prisma.module";
import { CacheModule } from "./cache/cache.module";
import { validateEnv } from "./config/env";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { PlanCapabilitiesGuard } from "./modules/plan-capabilities/guards/plan-capabilities.guard";
import { AuditCommonModule } from "./common/services/audit.module";
import { AuditContextInterceptor } from "./common/interceptors/audit-context.interceptor";

// modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { PlansModule } from "./modules/plans/plans.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ProductsModule } from "./modules/products/products.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { StockEntriesModule } from "./modules/stock-entries/stock-entries.module";
import { StockExitsModule } from "./modules/stock-exits/stock-exits.module";
import { SalesModule } from "./modules/sales/sales.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { AuditModule } from "./modules/audit/audit.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ExpiryAlertsModule } from "./modules/expiry-alerts/expiry-alerts.module";
import { EmailModule } from "./modules/email/email.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { DniModule } from "./modules/dni/dni.module";
import { KardexModule } from "./modules/kardex/kardex.module";
import { ProductBatchesModule } from "./modules/product-batches/product-batches.module";
import { ReplenishmentModule } from "./modules/replenishment/replenishment.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { HealthModule } from "./modules/health/health.module";
import { BillingModule } from "./modules/billing/billing.module";
import { CompanyProfileModule } from "./modules/company-profile/company-profile.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { DistributorsModule } from "./modules/distributors/distributors.module";
import { DiscountsModule } from "./modules/discounts/discounts.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { PlanCapabilitiesModule } from "./modules/plan-capabilities/plan-capabilities.module";
import { SupportModule } from "./modules/support/support.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { CreditNotesModule } from "./modules/credit-notes/credit-notes.module";
import { DataExportModule } from "./modules/data-export/data-export.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),

    PassportModule.register({ defaultStrategy: "jwt" }),

    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // =========================
    // CACHE (ioredis - type-safe)
    // =========================
    CacheModule,

    // =========================
    // BULL MQ (optional - requires REDIS_URL)
    // =========================
    ...(process.env.REDIS_URL
      ? [
          BullModule.forRoot({
            connection: { url: process.env.REDIS_URL },
          }),
        ]
      : []),

    // =========================
    // THROTTLER (rate limiting)
    // Un unico limite global named "default". Los limites por ruta se
    // sobrescriben con @Throttle({ default: { limit, ttl } }) en el controller.
    // No agregar mas entradas sin `name`: sin name explicito todas se
    // llaman "default", comparten contador y los limites se pisan entre si.
    // =========================
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "default",
          ttl: 60_000,
          limit: 60,
        },
      ],
    }),

    // =========================
    // DATABASE
    // =========================
    PrismaModule,

    // =========================
    // AUDIT (global)
    // =========================
    AuditCommonModule,

    // =========================
    // FEATURES
    // =========================
    AuthModule,
    UsersModule,
    CompaniesModule,
    PlansModule,
    SubscriptionsModule,
    PaymentsModule,
    ProductsModule,
    InventoryModule,
    StockEntriesModule,
    StockExitsModule,
    SalesModule,
    CustomersModule,
    EmployeesModule,
    ReportsModule,
    DashboardModule,
    AuditModule,
    NotificationsModule,
    ExpiryAlertsModule,
    EmailModule,
    InvoicesModule,
    DniModule,
    KardexModule,
    ProductBatchesModule,
    ReplenishmentModule,
    BranchesModule,
    HealthModule,
    BillingModule,
    CompanyProfileModule,
    PlatformModule,
    DistributorsModule,
    DiscountsModule,
    FinanceModule,
    PlanCapabilitiesModule,
    SupportModule,
    OutboxModule,
    SuppliersModule,
    CreditNotesModule,
    DataExportModule,
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlanCapabilitiesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
  ],
})
export class AppModule {}
