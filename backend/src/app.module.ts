import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Keyv from 'keyv';
import { createKeyv } from '@keyv/redis';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { validateEnv } from '@/config/env';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
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
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          try {
            const store = createKeyv(redisUrl);
            return { stores: [store] };
          } catch {
            console.log('[Cache] Redis no disponible. Usando cache en memoria.');
            return { stores: [new Keyv()] };
          }
        }

        console.log('[Cache] REDIS_URL no configurado. Usando cache en memoria.');
        return { stores: [new Keyv()] };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          console.log('[Bull] REDIS_URL no configurado. BullModule deshabilitado (sin colas).');
          return {
            connection: { url: 'redis://invalid:0' },
            defaultJobOptions: { removeOnFail: true },
          };
        }

        return {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: false,
            retryStrategy: (times: number) => {
              if (times > 3) return null;
              return Math.min(times * 200, 2000);
            },
          },
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
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