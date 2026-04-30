import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

import { PrismaModule } from '@/database/prisma/prisma.module';
import { validateEnv } from '@/config/env';

import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { CompaniesModule } from '@/modules/companies/companies.module';
import { PlansModule } from '@/modules/plans/plans.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { ProductsModule } from '@/modules/products/products.module';
import { InventoryModule } from '@/modules/inventory/inventory.module';
import { SalesModule } from '@/modules/sales/sales.module';
import { CustomersModule } from '@/modules/customers/customers.module';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { EmailModule } from '@/modules/email/email.module';
import { InvoicesModule } from '@/modules/invoices/invoices.module';
import { DniModule } from '@/modules/dni/dni.module';
import { HealthModule } from '@/modules/health/health.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // =========================
    // CACHE (REDIS + KEYV)
    // =========================
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          console.log('[Cache] Sin REDIS. Usando cache en memoria.');
          return {
            stores: [],
          };
        }

        try {
          const store = new Keyv({
            store: new KeyvRedis(redisUrl),
          });

          return {
            stores: [store],
          };
        } catch (e: unknown) {
          if (e instanceof Error) {
            console.log('[Cache] Error Redis:', e.message);
          } else {
            console.log('[Cache] Error Redis:', e);
          }

          return {
            stores: [],
          };
        }
      },
    }),

    // =========================
    // BULLMQ (COLAS)
    // =========================
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        console.log('[Bull] REDIS_URL:', redisUrl || 'NO_CONFIG');

        if (!redisUrl) {
          console.log('[Bull] Usando fallback local (sin Redis)');
          return {
            connection: {
              host: 'localhost',
              port: 6379,
            },
            defaultJobOptions: {
              removeOnFail: true,
            },
          };
        }

        return {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),

    // =========================
    // RATE LIMIT
    // =========================
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),

    // =========================
    // MODULES
    // =========================
    PrismaModule,
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
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}