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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard) // Proteger todas las rutas del controlador con JWT
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Endpoint para enviar mensajes a través de diferentes plataformas
   * POST /messages/send
   * Requiere autenticación JWT
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
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
      `Usuario ${username} (${userId}) enviando mensaje por ${createMessageDto.platform}`,
    );

    const message = await this.messagesService.sendMessage(
      createMessageDto,
      userId,
    );

    return {
      success: true,
      message: 'Mensaje procesado',
      data: {
        id: message._id,
        platform: message.platform,
        recipients: message.recipients,
        content: message.content,
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
  async getSentMessages(
    @Request() req,
    @Query() paginationDto: PaginationDto,
  ) {
    const userId = req.user.userId;
    const username = req.user.username;
    const { limit = 10, offset = 0 } = paginationDto;

    this.logger.log(
      `Usuario ${username} (${userId}) consultando sus mensajes enviados (limit: ${limit}, offset: ${offset})`,
    );

    // Obtener mensajes paginados y el total
    const [messages, total] = await Promise.all([
      this.messagesService.getUserMessages(userId, limit, offset),
      this.messagesService.getTotalUserMessages(userId),
    ]);

    // Calcular información de paginación
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = offset + limit < total;
    const hasPreviousPage = offset > 0;

    return {
      success: true,
      message: `Se encontraron ${messages.length} mensaje(s) en esta página`,
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
          hasFile: !!msg.file,
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
