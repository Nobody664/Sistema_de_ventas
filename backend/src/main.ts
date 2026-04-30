import 'module-alias/register';
import { ValidationPipe } from '@nestjs/common';
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

  const configService = app.get(ConfigService);

  // =========================
  // SECURITY MIDDLEWARE
  // =========================
  app.use(helmet());
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // =========================
  // CORS
  // =========================
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://sistema-de-ventas-frontend-seven.vercel.app',
    'https://sistema-de-ventas-git-main-cm1803419-1650s-projects.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // En dev o server-to-server requests
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // =========================
  // PREFIX API
  // =========================
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // =========================
  // REDIS DEBUG LOG (CORREGIDO)
  // =========================
  const redisUrl = configService.get<string>('REDIS_URL');

  console.log('🚀 Starting server...');
  console.log('📦 API Prefix:', apiPrefix);
  console.log('🌐 Port:', process.env.PORT || 10000);
  console.log('[Redis] URL:', redisUrl || 'NO_CONFIG');

  // =========================
  // SWAGGER
  // =========================
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

  // =========================
  // START SERVER
  // =========================
  const port = parseInt(process.env.PORT || '10000', 10);

  await app.listen(port);

  console.log('✅ Server running on port:', port);
  console.log(`📚 Swagger: http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap().catch((err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});