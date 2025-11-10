import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  SenderStrategy,
  MessageData,
  MassMessageData,
  SendResult,
} from '../interfaces/sender-strategy.interface';

@Injectable()
export class TelegramSender implements SenderStrategy {
  private readonly logger = new Logger(TelegramSender.name);
  private readonly token: string | undefined;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.baseUrl = `https://api.telegram.org/bot${this.token || ''}`;

    if (!this.token) {
      this.logger.warn(
        '[TELEGRAM] TELEGRAM_BOT_TOKEN no está configurado en las variables de entorno',
      );
    } else {
      this.logger.log('[TELEGRAM] Bot de Telegram inicializado correctamente');
    }
  }

  /**
   * Envía un mensaje individual a través de Telegram
   * @param data Datos del mensaje (recipient = chat_id, content = texto)
   * @returns SendResult con información del envío
   */
  async sendMessage(data: MessageData): Promise<SendResult> {
    try {
      this.logger.log(
        `[TELEGRAM] Enviando mensaje a chat_id: ${data.recipient}`,
      );
      this.logger.debug(`Contenido: ${data.content}`);

      if (!this.token) {
        this.logger.error(
          '[TELEGRAM] No se puede enviar mensaje: token no configurado',
        );
        return {
          success: false,
          message: 'Token no configurado',
        };
      }

      // Enviar mensaje de texto
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: data.recipient,
        text: data.content,
        parse_mode: 'HTML', // Permite usar formato HTML en los mensajes
      });

      if (response.data.ok && response.status === 200) {
        this.logger.log(
          `[TELEGRAM] ✅ Mensaje enviado exitosamente a ${data.recipient}`,
        );

        // Si hay archivo adjunto, enviarlo también
        if (data.file) {
          await this.sendFile(data.recipient, data.file);
        }

        return {
          success: true,
          statusCode: response.status,
        };
      } else {
        this.logger.error(
          `[TELEGRAM] ❌ Error en respuesta de API: ${JSON.stringify(response.data)}`,
        );
        return {
          success: false,
          statusCode: response.status,
          message: 'Error en respuesta de API',
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `[TELEGRAM] ❌ Error al enviar mensaje: ${error.response?.data?.description || error.message}`,
        );
        this.logger.debug(
          `Detalles del error: ${JSON.stringify(error.response?.data)}`,
        );
        return {
          success: false,
          statusCode: error.response?.status,
          message: error.response?.data?.description || error.message,
        };
      } else {
        this.logger.error(`[TELEGRAM] ❌ Error inesperado: ${error.message}`);
        return {
          success: false,
          message: error.message,
        };
      }
    }
  }

  /**
   * Envía un mensaje masivo a múltiples destinatarios
   * @param data Datos del mensaje masivo (recipients = array de chat_ids)
   * @returns SendResult con información del envío masivo
   */
  async sendMassMessage(data: MassMessageData): Promise<SendResult> {
    try {
      this.logger.log(
        `[TELEGRAM] Enviando mensaje masivo a ${data.recipients.length} chat(s)`,
      );

      // Enviar mensajes en paralelo
      const results = await Promise.all(
        data.recipients.map((recipient) =>
          this.sendMessage({
            recipient,
            content: data.content,
            file: data.file,
          }),
        ),
      );

      const successCount = results.filter((result) => result.success).length;
      const failedCount = results.length - successCount;

      if (failedCount === 0) {
        this.logger.log(
          `[TELEGRAM] ✅ Todos los mensajes masivos fueron enviados (${successCount}/${results.length})`,
        );
        return {
          success: true,
          message: `${successCount}/${results.length} mensajes enviados`,
        };
      } else {
        this.logger.warn(
          `[TELEGRAM] ⚠️ Envío masivo completado con errores: ${successCount} exitosos, ${failedCount} fallidos`,
        );
        return {
          success: false,
          message: `${successCount} exitosos, ${failedCount} fallidos`,
        };
      }
    } catch (error) {
      this.logger.error(
        `[TELEGRAM] ❌ Error en envío masivo: ${error.message}`,
      );
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Envía un archivo a través de Telegram
   * @param chatId ID del chat
   * @param file Archivo en formato base64 o URL
   * @returns true si se envió correctamente
   */
  private async sendFile(chatId: string, file: string): Promise<boolean> {
    try {
      this.logger.log(`[TELEGRAM] Enviando archivo a chat_id: ${chatId}`);

      // Determinar si es una URL o un archivo base64
      if (file.startsWith('http://') || file.startsWith('https://')) {
        // Si es una URL, enviarlo como documento
        const response = await axios.post(`${this.baseUrl}/sendDocument`, {
          chat_id: chatId,
          document: file,
        });

        if (response.data.ok) {
          this.logger.log(`[TELEGRAM] ✅ Archivo enviado exitosamente`);
          return true;
        }
      } else {
        // Si es base64 u otro formato, por ahora solo logeamos
        this.logger.warn(
          `[TELEGRAM] ⚠️ Archivo en formato no soportado aún (base64). Solo se soportan URLs`,
        );
      }

      return false;
    } catch (error) {
      this.logger.error(
        `[TELEGRAM] ❌ Error al enviar archivo: ${error.message}`,
      );
      return false;
    }
  }
}
