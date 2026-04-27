import 'module-alias/register';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
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
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix(configService.getOrThrow<string>('API_PREFIX'));
  // Temporarily disable validation for testing
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     transform: true,
  //     forbidNonWhitelisted: true,
  //   }),
  // );

  await app.listen(configService.getOrThrow<number>('PORT'));
}

void bootstrap();
