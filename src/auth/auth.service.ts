import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;

    // Verificar si el usuario ya existe
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('El email ya está registrado');
      }
      if (existingUser.username === username) {
        throw new ConflictException('El nombre de usuario ya está en uso');
      }
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear el usuario
    const newUser = new this.userModel({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Generar token JWT
    const payload = {
      sub: newUser._id,
      email: newUser.email,
      username: newUser.username,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Buscar el usuario por email
    const user = await this.userModel.findOne({ email }).select('+password');

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Validar la contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Generar token JWT
    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
    };
  }

  async validateUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }
}
