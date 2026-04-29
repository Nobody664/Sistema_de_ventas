import 'module-alias/register';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import express, { json, urlencoded } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://sistema-de-ventas-frontend-seven.vercel.app',
  'https://sistema-de-ventas-git-main-cm1803419-1650s-projects.vercel.app',
];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
});

  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // Swagger/OpenAPI Configuration
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

  const port = parseInt(process.env.PORT || '10000', 10);

  console.log('🚀 Starting server...');
  console.log('📦 API Prefix:', apiPrefix);
  console.log('🌐 Port:', port);
  console.log('📚 Swagger:', `http://localhost:${port}/${apiPrefix}/docs`);

  await app.listen(port);
  console.log('✅ Server running on port:', port);
}

bootstrap().catch((err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});