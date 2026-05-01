import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          console.log('[Redis] REDIS_URL no configurado. Cache en memoria.');
          return null;
        }

        try {
          console.log('[Redis] Conectando a Redis...');
          const redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
              if (times > 3) return null;
              return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
          });

          redis.on('error', (err: Error) => {
            console.error('[Redis] Error:', err.message);
          });

          redis.on('connect', () => {
            console.log('[Redis] ✅ Conectado');
          });

          return redis;
        } catch (error: unknown) {
          const err = error as Error;
          console.error('[Redis] Error al conectar:', err?.message ?? String(error));
          return null;
        }
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}