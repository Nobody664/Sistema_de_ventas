import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './database/prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { validateEnv } from './config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

// modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { CustomersModule } from './modules/customers/customers.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule } from './modules/email/email.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { DniModule } from './modules/dni/dni.module';
import { HealthModule } from './modules/health/health.module';
import { BillingModule } from './modules/billing/billing.module';
import { CompanyProfileModule } from './modules/company-profile/company-profile.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),

    PassportModule.register({ defaultStrategy: 'jwt' }),

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
    // =========================
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),

    // =========================
    // DATABASE
    // =========================
    PrismaModule,

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
    SalesModule,
    CustomersModule,
    EmployeesModule,
    ReportsModule,
    DashboardModule,
    AuditModule,
    NotificationsModule,
    EmailModule,
    InvoicesModule,
    DniModule,
    HealthModule,
    BillingModule,
    CompanyProfileModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
