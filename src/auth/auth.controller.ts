import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nuevo usuario',
    description:
      'Crea una nueva cuenta de usuario con username, email y password. Retorna un token JWT para autenticación inmediata.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente. Retorna access_token JWT.',
    schema: {
      example: {
        access_token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTEyMjk2ZGM0ZmQ3MWYxMTk5NTc1NWQiLCJlbWFpbCI6Imp1YW5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6Ikp1YW4yIiwiaWF0IjoxNjk5MTIzNDU2LCJleHAiOjE2OTkyMDk4NTZ9.xyz123',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - El email o username ya está registrado',
    schema: {
      example: {
        statusCode: 409,
        message: 'El email ya está registrado',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos - Validaciones fallidas',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'El nombre de usuario debe tener al menos 3 caracteres',
          'La contraseña debe contener al menos una letra y un número',
        ],
        error: 'Bad Request',
      },
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica un usuario existente con email y password. Retorna un token JWT válido por 24 horas.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso. Retorna access_token JWT válido por 24h.',
    schema: {
      example: {
        access_token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTEyMjk2ZGM0ZmQ3MWYxMTk5NTc1NWQiLCJlbWFpbCI6Imp1YW5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6Ikp1YW4yIiwiaWF0IjoxNjk5MTIzNDU2LCJleHAiOjE2OTkyMDk4NTZ9.xyz123',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Credenciales incorrectas',
    schema: {
      example: {
        statusCode: 401,
        message: 'Credenciales incorrectas',
      },
    },
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description:
      'Retorna la información del perfil del usuario autenticado basándose en el token JWT proporcionado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil obtenido exitosamente',
    schema: {
      example: {
        message: 'Perfil del usuario autenticado',
        user: {
          userId: '6912296dc4fd71f11995755d',
          email: 'juan@example.com',
          username: 'Juan2',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido, expirado o ausente',
    schema: {
      example: {
        statusCode: 401,
        message: 'auth parameters missing',
      },
    },
  })
  getProfile(@Request() req) {
    // req.user viene del JwtStrategy.validate()
    return {
      message: 'Perfil del usuario autenticado',
      user: req.user,
    };
  }
}
