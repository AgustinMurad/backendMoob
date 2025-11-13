import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { UsersModule } from './users/users.module';
import { MessagesModule } from './messages/messages.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { MulterExceptionFilter } from './filters/multer-exception.filter';

@Module({
  imports: [
    // Configuración global de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuración de MongoDB con Mongoose
    MongooseModule.forRootAsync({
      useFactory: getDatabaseConfig,
    }),

    // Configuración de Redis (cache global)
    RedisModule,

    // Módulos de la aplicación
    AuthModule,
    UsersModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Filtro global para manejo de errores de Multer (validación de archivos)
    {
      provide: APP_FILTER,
      useClass: MulterExceptionFilter,
    },
  ],
})
export class AppModule {}
