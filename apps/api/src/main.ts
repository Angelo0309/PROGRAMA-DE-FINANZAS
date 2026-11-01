import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CrediCuenta API')
      .setDescription('API para creditos comerciales multi-tienda')
      .setVersion('0.5.0')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
}

await bootstrap();

