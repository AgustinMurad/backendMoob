import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @MinLength(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
  @MaxLength(30, { message: 'El nombre de usuario no puede tener más de 30 caracteres' })
  username: string;

  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(7, { message: 'La contraseña debe tener al menos 7 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password: string;
}
