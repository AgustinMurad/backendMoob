import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Mock de bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserModel: any;
  let mockJwtService: any;

  beforeEach(async () => {
    // Arrange: Mock del modelo de usuario
    mockUserModel = jest.fn();
    mockUserModel.findOne = jest.fn();
    mockUserModel.findById = jest.fn();

    // Mock del JwtService
    mockJwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register user correctly', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        username: 'testuser',
        email: 'test@mail.com',
        password: 'password123',
      };

      const hashedPassword = 'hashedPassword123';
      const mockSavedUser = {
        _id: 'user123',
        username: registerDto.username,
        email: registerDto.email,
        password: hashedPassword,
        save: jest.fn().mockResolvedValue({
          _id: 'user123',
          username: registerDto.username,
          email: registerDto.email,
        }),
      };

      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.mockReturnValue(mockSavedUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockJwtService.sign.mockReturnValue('jwt.token.123');

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: registerDto.email }, { username: registerDto.username }],
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockSavedUser.save).toHaveBeenCalled();
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockSavedUser._id,
        email: mockSavedUser.email,
        username: mockSavedUser.username,
      });
      expect(result).toEqual({
        access_token: 'jwt.token.123',
      });
    });

    it('should throw exception for email used', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        username: 'newuser',
        email: 'existing@mail.com',
        password: 'password123',
      };

      const existingUser = {
        _id: 'existingUserId',
        email: 'existing@mail.com',
        username: 'existinguser',
      };

      mockUserModel.findOne.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'El email ya está registrado',
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: registerDto.email }, { username: registerDto.username }],
      });
    });

    it('should throw exception for name used', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        username: 'existinguser',
        email: 'newemail@mail.com',
        password: 'password123',
      };

      const existingUser = {
        _id: 'existingUserId',
        email: 'other@mail.com',
        username: 'existinguser',
      };

      mockUserModel.findOne.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'El nombre de usuario ya está en uso',
      );
    });
  });

  describe('login', () => {
    it('should auth user & return JWT', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@mail.com',
        password: 'password123',
      };

      const mockUser = {
        _id: 'user123',
        email: loginDto.email,
        username: 'testuser',
        password: 'hashedPassword123',
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt.token.456');

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: loginDto.email,
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser._id,
        email: mockUser.email,
        username: mockUser.username,
      });
      expect(result).toEqual({
        access_token: 'jwt.token.456',
      });
    });

    it('should throw UnauthorizedException if user not exist', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'notfound@mail.com',
        password: 'password123',
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Credenciales incorrectas',
      );
    });

    it('shoutl throw UnauthorizedException if invalid password', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@mail.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        _id: 'user123',
        email: loginDto.email,
        username: 'testuser',
        password: 'hashedPassword123',
      };

      mockUserModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Credenciales incorrectas',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
    });
  });

  describe('validateUser', () => {
    it('should return if user exist', async () => {
      // Arrange
      const userId = 'user123';
      const mockUser = {
        _id: userId,
        email: 'test@mail.com',
        username: 'testuser',
      };

      mockUserModel.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.validateUser(userId);

      // Assert
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not exist', async () => {
      // Arrange
      const userId = 'nonexistent123';
      mockUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateUser(userId)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser(userId)).rejects.toThrow(
        'Usuario no encontrado',
      );
    });
  });
});
