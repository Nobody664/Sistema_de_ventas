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
  // TRUST PROXY (CORRECTO EN NEST)
  // =========================
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', 1);

  // =========================
  // SECURITY MIDDLEWARE
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
    }),
  );

  // =========================
  // CORS (CORREGIDO)
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

      logger.warn(`Blocked CORS: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  // =========================
  // PREFIX API
  // =========================
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // =========================
  // ENV LOGS
  // =========================
  const port = parseInt(process.env.PORT || '10000', 10);
  const redisUrl = configService.get<string>('REDIS_URL');

  logger.log('🚀 Starting server...');
  logger.log(`📦 API Prefix: ${apiPrefix}`);
  logger.log(`🌐 Port: ${port}`);
  logger.log(`[Redis] ${redisUrl ? 'Configured' : 'Not configured'}`);

  // =========================
  // SWAGGER (SOLO DEV)
  // =========================
  if (configService.get('NODE_ENV') !== 'production') {
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

    logger.log(`📚 Swagger: /${apiPrefix}/docs`);
  }

  // =========================
  // START SERVER
  // =========================
  await app.listen(port, '0.0.0.0');

  logger.log(`✅ Server running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});