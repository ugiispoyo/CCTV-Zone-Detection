import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  const adapter = new FastifyAdapter({ logger: true, trustProxy: true });
  await adapter.register(multipart as Parameters<typeof adapter.register>[0], {
    limits: { fileSize: 150 * 1024 * 1024, files: 4, fields: 10 },
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.DASHBOARD_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CCTV Platform API')
    .setDescription('Dashboard and internal CV integration API. Authentication is not enabled yet.')
    .setVersion('1.0')
    .addTag('health')
    .addTag('cameras')
    .addTag('zones')
    .addTag('events')
    .addTag('telegram')
    .addTag('internal')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
