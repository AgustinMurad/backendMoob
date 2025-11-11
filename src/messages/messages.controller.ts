import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  HttpException,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('Messages')
@ApiBearerAuth('JWT-auth')
@Controller('messages')
@UseGuards(JwtAuthGuard) // Proteger rutas del controlador con JWT
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Endpoint para enviar mensajes a través de diferentes plataformas
   * POST /messages/send
   * Requiere autenticación JWT
   * Acepta un archivo opcional mediante multipart/form-data con límite de 10MB
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  @ApiOperation({
    summary: 'Enviar mensaje por plataforma',
    description:
      'Envía un mensaje a través de la plataforma especificada (Telegram, Slack, Discord, WhatsApp). Soporta archivos adjuntos opcionales de hasta 10MB. Los archivos se suben a Cloudinary automáticamente.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Datos del mensaje y archivo opcional. El campo recipients debe ser un JSON string con array de destinatarios.',
    schema: {
      type: 'object',
      required: ['platform', 'content', 'recipients'],
      properties: {
        platform: {
          type: 'string',
          enum: ['telegram', 'slack', 'discord', 'whatsapp'],
          description: 'Plataforma de envío del mensaje',
          example: 'telegram',
        },
        content: {
          type: 'string',
          description: 'Contenido del mensaje a enviar',
          example: 'Hola! Este es un mensaje de prueba desde la API',
          minLength: 1,
          maxLength: 5000,
        },
        recipients: {
          type: 'string',
          description:
            'Array de destinatarios en formato JSON string. Para Telegram usar chat_id, para Slack usar user_id o channel_id',
          example: '["123456789","987654321"]',
        },
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Archivo opcional (imagen, PDF, video, documento, etc.) - Máximo 10MB. Se sube a Cloudinary automáticamente.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Mensaje enviado exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Mensaje enviado correctamente',
        data: {
          id: '673206c1d4ae5d6e9c123456',
          platform: 'telegram',
          recipients: ['123456789'],
          content: 'Hola! Este es un mensaje de prueba desde la API',
          fileUrl:
            'https://res.cloudinary.com/dg87eacu9/raw/upload/v1699123456/moob/documento.pdf',
          sent: true,
          createdAt: '2025-11-11T15:25:16.123Z',
          sentBy: {
            id: '6912296dc4fd71f11995755d',
            username: 'Juan2',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o archivo muy grande',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'Los destinatarios deben ser un array',
          'La plataforma es requerida',
        ],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o ausente',
  })
  @ApiResponse({
    status: 500,
    description: 'Error al procesar el envío del mensaje',
    schema: {
      example: {
        statusCode: 500,
        message: 'Error al procesar el envío del mensaje',
      },
    },
  })
  async sendMessage(
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!req.user) {
      throw new HttpException(
        { success: false, message: 'Auth parameter missing' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const userId = req.user.userId; // Viene del JwtStrategy
    const username = req.user.username;

    this.logger.log(
      `Usuario ${username} (${userId}) enviando mensaje por ${createMessageDto.platform}${file ? ' con archivo adjunto' : ''}`,
    );

    const message = await this.messagesService.sendMessage(
      createMessageDto,
      userId,
      file,
    );

    return {
      success: true,
      message: 'Mensaje enviado correctamente',
      data: {
        id: message._id,
        platform: message.platform,
        recipients: message.recipients,
        content: message.content,
        fileUrl: message.fileUrl,
        sent: message.sent,
        createdAt: message.createdAt,
        sentBy: {
          id: userId,
          username: username,
        },
      },
    };
  }

  /**
   * Endpoint para obtener los mensajes enviados por el usuario autenticado con paginación
   * GET /messages/sent?limit=10&offset=0
   * Requiere autenticación JWT
   */
  @Get('sent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener mensajes enviados (con caché Redis)',
    description:
      'Retorna los mensajes enviados por el usuario autenticado con paginación. Utiliza caché de Redis para mejorar el rendimiento (TTL: 24 horas). La respuesta incluye información sobre si los datos vienen del caché o de MongoDB.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número de mensajes por página (default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Número de mensajes a saltar para paginación (default: 0)',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description:
      'Mensajes obtenidos exitosamente. Incluye metadata de caché (hit/miss)',
    schema: {
      example: {
        success: true,
        message: 'Se encontraron 10 mensaje(s) en esta página (desde caché)',
        data: {
          user: {
            id: '6912296dc4fd71f11995755d',
            username: 'Juan2',
          },
          messages: [
            {
              id: '673206c1d4ae5d6e9c123456',
              platform: 'telegram',
              recipients: ['123456789'],
              content: 'Hola mundo',
              sent: true,
              createdAt: '2025-11-11T15:25:16.123Z',
              fileUrl: null,
            },
            {
              id: '673206c1d4ae5d6e9c456789',
              platform: 'telegram',
              recipients: ['987654321'],
              content: 'Mensaje con archivo',
              sent: true,
              createdAt: '2025-11-11T14:20:10.000Z',
              fileUrl:
                'https://res.cloudinary.com/dg87eacu9/raw/upload/v1699123456/moob/documento.pdf',
            },
          ],
          pagination: {
            total: 45,
            count: 10,
            limit: 10,
            offset: 0,
            currentPage: 1,
            totalPages: 5,
            hasNextPage: true,
            hasPreviousPage: false,
          },
          cache: {
            hit: true,
            ttl: '24 horas',
            source: 'Redis',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o ausente',
  })
  async getSentMessages(@Request() req, @Query() paginationDto: PaginationDto) {
    const userId = req.user.userId;
    const username = req.user.username;
    const { limit = 10, offset = 0 } = paginationDto;

    this.logger.log(
      `Usuario ${username} (${userId}) consultando sus mensajes enviados (limit: ${limit}, offset: ${offset})`,
    );

    // Paginacion y total (con soporte de caché de Redis)
    const [messagesResult, total] = await Promise.all([
      this.messagesService.getUserMessages(userId, limit, offset),
      this.messagesService.getTotalUserMessages(userId),
    ]);

    const { messages, fromCache } = messagesResult;

    // calcular paginacion con limite y offset
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = offset + limit < total;
    const hasPreviousPage = offset > 0;

    return {
      success: true,
      message: `Se encontraron ${messages.length} mensaje(s) en esta página ${fromCache ? '(desde caché)' : '(desde BD)'}`,
      data: {
        user: {
          id: userId,
          username: username,
        },
        messages: messages.map((msg) => ({
          id: msg._id,
          platform: msg.platform,
          recipients: msg.recipients,
          content: msg.content,
          sent: msg.sent,
          createdAt: msg.createdAt,
          fileUrl: msg.fileUrl,
        })),
        pagination: {
          total, // Total de mensajes
          count: messages.length, // Mensajes en esta página
          limit, // Límite por página
          offset, // Offset actual
          currentPage, // Página actual
          totalPages, // Total de páginas
          hasNextPage, // Hay siguiente página
          hasPreviousPage, // Hay página anterior
        },
        cache: {
          hit: fromCache, // true si viene de Redis, false si viene de MongoDB
          ttl: '24 horas', // Tiempo de vida del caché
          source: fromCache ? 'Redis' : 'MongoDB',
        },
      },
    };
  }

  /**
   * Endpoint para obtener estadísticas de mensajes del usuario
   * GET /messages/stats
   * Requiere autenticación JWT
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas de mensajes',
    description:
      'Retorna estadísticas completas de mensajes del usuario autenticado: total de mensajes, mensajes enviados exitosamente, mensajes fallidos, y distribución por plataforma.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Estadísticas de mensajes',
        data: {
          user: {
            id: '6912296dc4fd71f11995755d',
            username: 'Juan2',
          },
          statistics: {
            total: 45,
            sent: 42,
            failed: 3,
            byPlatform: {
              telegram: 30,
              slack: 10,
              discord: 5,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o ausente',
  })
  async getMessageStats(@Request() req) {
    const userId = req.user.userId;
    const username = req.user.username;

    this.logger.log(`Usuario ${username} (${userId}) consultando estadísticas`);

    const stats = await this.messagesService.getUserMessageStats(userId);

    return {
      success: true,
      message: 'Estadísticas de mensajes',
      data: {
        user: {
          id: userId,
          username: username,
        },
        statistics: stats,
      },
    };
  }
}
