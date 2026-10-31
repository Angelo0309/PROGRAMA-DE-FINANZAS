import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CrediCuenta API')
      .setDescription('API para creditos comerciales multi-tienda')
      .setVersion('0.1.0')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
}

await bootstrap();

