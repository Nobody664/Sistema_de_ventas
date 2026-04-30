import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  // =========================
  // TRUST PROXY (Render / Vercel / Nginx)
  // =========================
  app.set('trust proxy', 1);

  // =========================
  // SECURITY
  // =========================
  app.use(helmet());

  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // =========================
  // VALIDATION GLOBAL
  // =========================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // =========================
  // CORS (PRO)
  // =========================
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://sistema-de-ventas-frontend-seven.vercel.app',
    'https://sistema-de-ventas-git-main-cm1803419-1650s-projects.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn(`Blocked CORS origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // =========================
  // PREFIX
  // =========================
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // =========================
  // SWAGGER (solo dev/pro controlado)
  // =========================
  const enableSwagger = configService.get<string>('NODE_ENV') !== 'production';

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ventas SaaS API')
      .setDescription('API para sistema de gestión de ventas')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`📚 Swagger enabled at /${apiPrefix}/docs`);
  }

  // =========================
  // ENV DEBUG
  // =========================
  const port = parseInt(process.env.PORT || '10000', 10);
  const redisUrl = configService.get<string>('REDIS_URL');

  logger.log(`🚀 Starting server...`);
  logger.log(`📦 API Prefix: ${apiPrefix}`);
  logger.log(`🌐 Port: ${port}`);
  logger.log(`[Redis] ${redisUrl ? 'Configured' : 'Not configured'}`);

  // =========================
  // GRACEFUL SHUTDOWN (CLAVE)
  // =========================
  app.enableShutdownHooks();

  process.on('SIGINT', async () => {
    logger.warn('SIGINT received. Closing app...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.warn('SIGTERM received. Closing app...');
    await app.close();
    process.exit(0);
  });

  // =========================
  // START
  // =========================
  await app.listen(port, '0.0.0.0');

  logger.log(`✅ Server running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Fatal error during bootstrap:', err);
  process.exit(1);
});