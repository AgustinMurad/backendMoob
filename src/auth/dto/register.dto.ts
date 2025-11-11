import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Nombre de usuario único (3-30 caracteres)',
    example: 'juan123',
    minLength: 3,
    maxLength: 30,
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @MinLength(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
  @MaxLength(30, { message: 'El nombre de usuario no puede tener más de 30 caracteres' })
  username: string;

  @ApiProperty({
    description: 'Correo electrónico del usuario (debe ser único)',
    example: 'juan@example.com',
    format: 'email',
    required: true,
  })
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({
    description:
      'Contraseña segura (mínimo 7 caracteres, debe contener al menos una letra y un número)',
    example: 'MiPassword123',
    minLength: 7,
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(7, { message: 'La contraseña debe tener al menos 7 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password: string;
}
