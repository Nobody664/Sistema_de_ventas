import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          console.log('[Cache] Redis no configurado. Cache deshabilitado.');
          return null;
        }

        try {
          console.log('[Cache] Conectando a Redis...');
          const redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
              if (times > 3) return null;
              return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
          });

          redis.on('error', (err: Error) => {
            console.error('[Cache] Error Redis:', err.message);
          });

          redis.on('connect', () => {
            console.log('[Cache] ✅ Conectado a Redis');
          });

          return redis;
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error('[Cache] Error al conectar:', errMsg);
          return null;
        }
      },
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {}

  async onModuleDestroy() {}
}