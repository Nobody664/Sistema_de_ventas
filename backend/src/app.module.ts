import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
// import { BullModule } from '@nestjs/bullmq'; // production: enable with Redis
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './database/prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { validateEnv } from './config/env';

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
import { DebugModule } from './modules/debug/debug.module';

@Module({
  imports: [
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
    // BULL MQ ( solo si REDIS_URL configurado - production only)
    // =========================
    // BullModule.forRootAsync({...}), // requires Redis for queues
    // In production: descomenta y usa REDIS_URL

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
    DebugModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}