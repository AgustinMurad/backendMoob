import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum MessagePlatform {
  TELEGRAM = 'telegram',
  SLACK = 'slack',
  DISCORD = 'discord',
  WHATSAPP = 'whatsapp',
}

export class CreateMessageDto {
  @Transform(({ value }) => {
    // Array lo devuelvo talcual
    if (Array.isArray(value)) {
      return value as string[];
    }
    // Parsear de string a JSON
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return (Array.isArray(parsed) ? parsed : [value]) as string[];
      } catch {
        // Si no es JSON valido es un elemento
        return [value];
      }
    }
    // Si no es ni array ni string, devolverlo tal cual (fallará la validación)
    return value as string[];
  })
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
}
