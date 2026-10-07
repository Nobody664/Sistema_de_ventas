import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  // =========================
  // TRUST PROXY (RENDER / NGINX)
  // =========================
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // =========================
  // SECURITY
  // =========================
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'connect-src': ["'self'"],
          'font-src': ["'self'", 'data:', 'https:'],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
        },
      },
    }),
  );
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // =========================
  // VALIDATION
  // =========================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // =========================
  // CORS - Allow frontend origins
  // =========================
  const corsOrigins = (config.get<string>('CORS_ORIGINS') || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedOrigins = [
    ...corsOrigins,
    'https://sistema-de-ventas-frontend-seven.vercel.app',
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      const isAllowed = !origin || allowedOrigins.includes(origin);
      
      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn(`Blocked CORS: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // =========================
  // PREFIX
  // =========================
  const apiPrefix = config.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // =========================
  // SWAGGER (DEV ONLY)
  // =========================
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ventas SaaS API')
      .setDescription('API para sistema de gestión de ventas')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

    logger.log(`📚 Swagger: /${apiPrefix}/docs`);
  }

  // =========================
  // PORT (RENDER SAFE)
  // =========================
  const port = parseInt(process.env.PORT || '10000', 10);

  // 🔥 IMPORTANTE: escuchar en 0.0.0.0
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Server running on port ${port}`);
  logger.log(`🌐 Health check: /${apiPrefix}/health/live`);
}

bootstrap().catch((err) => {
  console.error('❌ Fatal bootstrap error:', err);
  process.exit(1);
});