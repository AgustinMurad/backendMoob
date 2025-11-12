import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { InternalServerErrorException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { Message } from './schemas/message.schema';
import { MessageSenderFactory } from './factories/message-sender.factory';
import { CloudinaryService } from './services/cloudinary.service';
import { RedisService } from '../redis/redis.service';
import { CreateMessageDto, MessagePlatform } from './dto/create-message.dto';

describe('MessagesService', () => {
  let service: MessagesService;
  let mockMessageModel: any;
  let mockMessageSenderFactory: any;
  let mockCloudinaryService: any;
  let mockRedisService: any;

  beforeEach(async () => {
    // Arrange: Mock del modelo de mensaje
    mockMessageModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: 'message123',
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: 'message123',
        createdAt: new Date(),
      }),
    }));
    mockMessageModel.find = jest.fn();
    mockMessageModel.countDocuments = jest.fn();
    mockMessageModel.deleteOne = jest.fn();
    mockMessageModel.aggregate = jest.fn();

    // Mock del MessageSenderFactory
    mockMessageSenderFactory = {
      getSender: jest.fn(),
    };

    // Mock del CloudinaryService
    mockCloudinaryService = {
      uploadFile: jest.fn(),
    };

    // Mock del RedisService
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      deleteByPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getModelToken(Message.name),
          useValue: mockMessageModel,
        },
        {
          provide: MessageSenderFactory,
          useValue: mockMessageSenderFactory,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message without file', async () => {
      // Arrange
      const createMessageDto: CreateMessageDto = {
        platform: MessagePlatform.TELEGRAM,
        recipients: ['123456789'],
        content: 'Hola, este es un mensaje de prueba',
      };
      const userId = 'user123';

      const mockSender = {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
      };

      mockMessageSenderFactory.getSender.mockReturnValue(mockSender);
      mockRedisService.deleteByPattern.mockResolvedValue(5);

      // Act
      const result = await service.sendMessage(createMessageDto, userId);

      // Assert
      expect(mockMessageSenderFactory.getSender).toHaveBeenCalledWith(
        MessagePlatform.TELEGRAM,
      );
      expect(mockSender.sendMessage).toHaveBeenCalledWith({
        recipient: createMessageDto.recipients[0],
        content: createMessageDto.content,
        file: undefined,
      });
      expect(result).toHaveProperty('_id', 'message123');
      expect(result).toHaveProperty('sent', true);
      expect(mockRedisService.deleteByPattern).toHaveBeenCalledWith(
        `messages:${userId}:*`,
      );
    });

    it('should send message with file upload to cloudinary', async () => {
      // Arrange
      const createMessageDto: CreateMessageDto = {
        platform: MessagePlatform.SLACK,
        recipients: ['C12345678'],
        content: 'Mensaje con archivo',
      };
      const userId = 'user456';
      const mockFile = {
        originalname: 'test.pdf',
        size: 1024,
        buffer: Buffer.from('fake-file-content'),
      } as Express.Multer.File;

      const cloudinaryUrl = 'https://cloudinary.com/files/test.pdf';

      const mockSender = {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
      };

      mockCloudinaryService.uploadFile.mockResolvedValue(cloudinaryUrl);
      mockMessageSenderFactory.getSender.mockReturnValue(mockSender);
      mockRedisService.deleteByPattern.mockResolvedValue(3);

      // Act
      const result = await service.sendMessage(
        createMessageDto,
        userId,
        mockFile,
      );

      // Assert
      expect(mockCloudinaryService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(mockSender.sendMessage).toHaveBeenCalledWith({
        recipient: createMessageDto.recipients[0],
        content: createMessageDto.content,
        file: cloudinaryUrl,
      });
      expect(result).toHaveProperty('fileUrl', cloudinaryUrl);
      expect(result).toHaveProperty('sent', true);
    });

    it('should save message with sent=false', async () => {
      // Arrange
      const createMessageDto: CreateMessageDto = {
        platform: MessagePlatform.DISCORD,
        recipients: ['987654321'],
        content: 'Este mensaje fallará',
      };
      const userId = 'user789';

      const mockSender = {
        sendMessage: jest.fn().mockResolvedValue({ success: false }),
      };

      mockMessageSenderFactory.getSender.mockReturnValue(mockSender);
      mockRedisService.deleteByPattern.mockResolvedValue(2);

      // Act
      const result = await service.sendMessage(createMessageDto, userId);

      // Assert
      expect(mockSender.sendMessage).toHaveBeenCalled();
      expect(result).toHaveProperty('sent', false);
      expect(mockRedisService.deleteByPattern).toHaveBeenCalledWith(
        `messages:${userId}:*`,
      );
    });

    it('should throw InternalServerErrorException if error exist', async () => {
      // Arrange
      const createMessageDto: CreateMessageDto = {
        platform: MessagePlatform.WHATSAPP,
        recipients: ['+5491112345678'],
        content: 'Mensaje con error',
      };
      const userId = 'user999';

      mockMessageSenderFactory.getSender.mockImplementation(() => {
        throw new Error('Error inesperado en el factory');
      });

      // Act & Assert
      await expect(
        service.sendMessage(createMessageDto, userId),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.sendMessage(createMessageDto, userId),
      ).rejects.toThrow('Error al procesar el envío del mensaje');
    });

    it('should send mass messages with sendMassMessage if available', async () => {
      // Arrange
      const createMessageDto: CreateMessageDto = {
        platform: MessagePlatform.TELEGRAM,
        recipients: ['111', '222', '333'],
        content: 'Mensaje masivo',
      };
      const userId = 'user111';

      const mockSender = {
        sendMessage: jest.fn(),
        sendMassMessage: jest.fn().mockResolvedValue({ success: true }),
      };

      mockMessageSenderFactory.getSender.mockReturnValue(mockSender);
      mockRedisService.deleteByPattern.mockResolvedValue(1);

      // Act
      const result = await service.sendMessage(createMessageDto, userId);

      // Assert
      expect(mockSender.sendMassMessage).toHaveBeenCalledWith({
        recipients: createMessageDto.recipients,
        content: createMessageDto.content,
        file: undefined,
      });
      expect(mockSender.sendMessage).not.toHaveBeenCalled();
      expect(result).toHaveProperty('sent', true);
    });

    it('should use fallback if sendMassMessage not available', async () => {
      // Arrange
      const createMessageDto: CreateMessageDto = {
        platform: MessagePlatform.SLACK,
        recipients: ['AAA', 'BBB'],
        content: 'Mensaje con fallback',
      };
      const userId = 'user222';

      const mockSender = {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        // sendMassMessage no está definido
      };

      mockMessageSenderFactory.getSender.mockReturnValue(mockSender);
      mockRedisService.deleteByPattern.mockResolvedValue(4);

      // Act
      const result = await service.sendMessage(createMessageDto, userId);

      // Assert
      expect(mockSender.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockSender.sendMessage).toHaveBeenCalledWith({
        recipient: 'AAA',
        content: createMessageDto.content,
        file: undefined,
      });
      expect(mockSender.sendMessage).toHaveBeenCalledWith({
        recipient: 'BBB',
        content: createMessageDto.content,
        file: undefined,
      });
      expect(result).toHaveProperty('sent', true);
    });

    it('should select correctly sender by platform', async () => {
      // Arrange
      const platforms = [
        MessagePlatform.TELEGRAM,
        MessagePlatform.SLACK,
        MessagePlatform.DISCORD,
        MessagePlatform.WHATSAPP,
      ];

      const mockSender = {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
      };

      mockMessageSenderFactory.getSender.mockReturnValue(mockSender);
      mockRedisService.deleteByPattern.mockResolvedValue(1);

      // Act & Assert
      for (const platform of platforms) {
        const createMessageDto: CreateMessageDto = {
          platform,
          recipients: ['test'],
          content: `Mensaje de ${platform}`,
        };

        await service.sendMessage(createMessageDto, 'user123');

        expect(mockMessageSenderFactory.getSender).toHaveBeenCalledWith(
          platform,
        );
      }

      expect(mockMessageSenderFactory.getSender).toHaveBeenCalledTimes(4);
    });

    it('should invalidate cache after sending a new message', async () => {
      // Arrange
      const createMessageDto: CreateMessageDto = {
        platform: MessagePlatform.TELEGRAM,
        recipients: ['123456789'],
        content: 'Mensaje para invalidar caché',
      };
      const userId = 'user333';

      const mockSender = {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
      };

      mockMessageSenderFactory.getSender.mockReturnValue(mockSender);
      mockRedisService.deleteByPattern.mockResolvedValue(10);

      // Act
      await service.sendMessage(createMessageDto, userId);

      // Assert
      expect(mockRedisService.deleteByPattern).toHaveBeenCalledWith(
        `messages:${userId}:*`,
      );
      expect(mockRedisService.deleteByPattern).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserMessages', () => {
    it('should return messages from cache if available', async () => {
      // Arrange
      const userId = 'user123';
      const limit = 10;
      const offset = 0;
      const cachedMessages = [
        { _id: 'msg1', content: 'Mensaje 1' },
        { _id: 'msg2', content: 'Mensaje 2' },
      ];

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedMessages));

      // Act
      const result = await service.getUserMessages(userId, limit, offset);

      // Assert
      expect(mockRedisService.get).toHaveBeenCalledWith(
        `messages:${userId}:${limit}:${offset}`,
      );
      expect(result).toEqual({
        messages: cachedMessages,
        fromCache: true,
      });
      expect(mockMessageModel.find).not.toHaveBeenCalled();
    });

    it('shold consult mongoDB & caching if no data in cache', async () => {
      // Arrange
      const userId = 'user456';
      const limit = 5;
      const offset = 0;
      const dbMessages = [
        { _id: 'msg3', content: 'Mensaje 3', createdAt: new Date() },
        { _id: 'msg4', content: 'Mensaje 4', createdAt: new Date() },
      ];

      mockRedisService.get.mockResolvedValue(null);

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(dbMessages),
      };

      mockMessageModel.find.mockReturnValue(mockQuery);

      // Act
      const result = await service.getUserMessages(userId, limit, offset);

      // Assert
      expect(mockRedisService.get).toHaveBeenCalledWith(
        `messages:${userId}:${limit}:${offset}`,
      );
      expect(mockMessageModel.find).toHaveBeenCalledWith({ senderId: userId });
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockQuery.skip).toHaveBeenCalledWith(offset);
      expect(mockQuery.limit).toHaveBeenCalledWith(limit);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `messages:${userId}:${limit}:${offset}`,
        JSON.stringify(dbMessages),
        24 * 60 * 60,
      );
      expect(result).toEqual({
        messages: dbMessages,
        fromCache: false,
      });
    });

    it('should throw InternalServerErrorException if error exist', async () => {
      // Arrange
      const userId = 'user789';

      mockRedisService.get.mockRejectedValue(new Error('Redis error'));

      // Act & Assert
      await expect(service.getUserMessages(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getUserMessages(userId)).rejects.toThrow(
        'Error al obtener los mensajes',
      );
    });
  });

  describe('getTotalUserMessages', () => {
    it('should return all messages by user', async () => {
      // Arrange
      const userId = 'user123';
      const totalMessages = 42;

      mockMessageModel.countDocuments.mockResolvedValue(totalMessages);

      // Act
      const result = await service.getTotalUserMessages(userId);

      // Assert
      expect(mockMessageModel.countDocuments).toHaveBeenCalledWith({
        senderId: userId,
      });
      expect(result).toBe(totalMessages);
    });

    it('should throw InternalServerErrorException if error exist', async () => {
      // Arrange
      const userId = 'user123';

      mockMessageModel.countDocuments.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(service.getTotalUserMessages(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getTotalUserMessages(userId)).rejects.toThrow(
        'Error al contar los mensajes',
      );
    });
  });

  describe('getUserMessageStats', () => {
    it('should return stats by user', async () => {
      // Arrange
      const userId = 'user123';

      mockMessageModel.countDocuments
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // sent
        .mockResolvedValueOnce(15); // failed

      mockMessageModel.aggregate.mockResolvedValue([
        { _id: 'telegram', count: 50 },
        { _id: 'slack', count: 30 },
        { _id: 'discord', count: 20 },
      ]);

      // Act
      const result = await service.getUserMessageStats(userId);

      // Assert
      expect(mockMessageModel.countDocuments).toHaveBeenCalledTimes(3);
      expect(mockMessageModel.aggregate).toHaveBeenCalled();
      expect(result).toEqual({
        total: 100,
        sent: 85,
        failed: 15,
        byPlatform: {
          telegram: 50,
          slack: 30,
          discord: 20,
        },
      });
    });

    it('should throw InternalServerErrorException if error exist', async () => {
      // Arrange
      const userId = 'user123';

      mockMessageModel.countDocuments.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(service.getUserMessageStats(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.getUserMessageStats(userId)).rejects.toThrow(
        'Error al obtener estadísticas',
      );
    });
  });
});
