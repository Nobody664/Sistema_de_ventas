import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis | null => {
        const logger = new Logger('RedisModule');
        const redisUrl = configService.get<string>('REDIS_URL');

        if (!redisUrl) {
          logger.warn('⚠️ REDIS_URL no configurado. Usando cache en memoria.');
          return null;
        }

        try {
          logger.log('🔌 Conectando a Redis...');
          
          const redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
              if (times > 3) {
                logger.warn('⚠️ Redis: max retries reached, fallback to memory');
                return null;
              }
              return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
            connectTimeout: 5000,
          });

          redis.on('error', (err: Error) => {
            logger.warn(`⚠️ Redis error: ${err.message}, usando fallback en memoria`);
          });

          redis.on('connect', () => {
            logger.log('✅ Redis conectado exitosamente');
          });

          redis.on('ready', () => {
            logger.log('✅ Redis ready');
          });

          redis.on('close', () => {
            logger.warn('⚠️ Redis desconectado, usando fallback en memoria');
          });

          return redis;
        } catch (error) {
          const err = error as Error;
          logger.warn(`⚠️ Error conectando a Redis: ${err?.message}, usando cache en memoria`);
          return null;
        }
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}