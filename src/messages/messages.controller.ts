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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

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
        delivered: message.delivered,
        createdAt: message.createdAt,
        sentBy: {
          id: userId,
          username: username,
        },
      },
    };
  }

  /**
   * Endpoint para obtener todos los mensajes enviados por el usuario autenticado
   * GET /messages/sent
   * Requiere autenticación JWT
   */
  @Get('sent')
  @HttpCode(HttpStatus.OK)
  async getSentMessages(@Request() req) {
    const userId = req.user.userId;
    const username = req.user.username;

    this.logger.log(
      `Usuario ${username} (${userId}) consultando sus mensajes enviados`,
    );

    const messages = await this.messagesService.getUserMessages(userId);

    return {
      success: true,
      message: `Se encontraron ${messages.length} mensaje(s)`,
      data: {
        user: {
          id: userId,
          username: username,
        },
        count: messages.length,
        messages: messages.map((msg) => ({
          id: msg._id,
          platform: msg.platform,
          recipients: msg.recipients,
          content: msg.content,
          sent: msg.sent,
          delivered: msg.delivered,
          createdAt: msg.createdAt,
          hasFile: !!msg.file,
        })),
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
