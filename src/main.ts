import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar validaciones globales con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si hay propiedades no permitidas
      transform: true, // Transforma los payloads a instancias de DTO
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Messages API')
    .setDescription(
      'API REST para el envío y gestión de mensajes multi-plataforma (Telegram, Slack, Discord, WhatsApp) con soporte para archivos adjuntos, autenticación JWT y caché con Redis.',
    )
    .setVersion('1.0')
    .addTag('Auth', 'Endpoints de autenticación y gestión de usuarios')
    .addTag('Messages', 'Endpoints de envío y consulta de mensajes')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Ingresa el token JWT obtenido en /auth/login',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Servidor de desarrollo')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Messages API - Documentación',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log('\n Aplicación iniciada correctamente');
  console.log(` Servidor corriendo en: http://localhost:${port}`);
  console.log(` Documentación Swagger: http://localhost:${port}/api/docs\n`);
}
bootstrap();
