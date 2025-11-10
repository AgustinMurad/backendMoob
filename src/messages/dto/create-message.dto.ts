import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';

export enum MessagePlatform {
  TELEGRAM = 'telegram',
  SLACK = 'slack',
  DISCORD = 'discord',
  WHATSAPP = 'whatsapp',
}

export class CreateMessageDto {
  @IsArray({ message: 'Los destinatarios deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe haber al menos un destinatario' })
  @IsString({ each: true, message: 'Cada destinatario debe ser un string' })
  recipients: string[];

  @IsEnum(MessagePlatform, {
    message:
      'Plataforma no válida. Opciones: telegram, slack, discord, whatsapp',
  })
  @IsNotEmpty({ message: 'La plataforma es requerida' })
  platform: MessagePlatform;

  @IsString({ message: 'El contenido debe ser un string' })
  @IsNotEmpty({ message: 'El contenido del mensaje es requerido' })
  content: string;

  @IsOptional()
  @IsString({ message: 'El archivo debe ser un string (base64 o path)' })
  file?: string;
}
