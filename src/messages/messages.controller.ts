import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
export class MessagesController {
  // Endpoint público (no requiere autenticación)
  @Get('public')
  @HttpCode(HttpStatus.OK)
  getPublicMessages() {
    return {
      message: 'Este endpoint es público, no requiere autenticación',
      data: ['Mensaje público 1', 'Mensaje público 2'],
    };
  }

  // Endpoint protegido (requiere autenticación con JWT)
  @Post('send')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  sendMessage(@Request() req, @Body() body: { content: string; to: string }) {
    // req.user contiene los datos del usuario autenticado (viene del JwtStrategy)
    return {
      message: 'Mensaje enviado correctamente',
      from: req.user.username,
      to: body.to,
      content: body.content,
      sentBy: req.user.userId,
      timestamp: new Date(),
    };
  }

  // Sacar esto porque nosotros no queremos recibir msg
  @Get('inbox')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getInbox(@Request() req) {
    return {
      message: 'Buzón de entrada',
      user: req.user.username,
      messages: [
        { from: 'usuario1', content: 'Hola!', date: new Date() },
        { from: 'usuario2', content: '¿Cómo estás?', date: new Date() },
      ],
    };
  }
}
