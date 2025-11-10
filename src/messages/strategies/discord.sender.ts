import { Injectable, Logger } from '@nestjs/common';
import {
  SenderStrategy,
  MessageData,
  MassMessageData,
  SendResult,
} from '../interfaces/sender-strategy.interface';

@Injectable()
export class DiscordSender implements SenderStrategy {
  private readonly logger = new Logger(DiscordSender.name);

  async sendMessage(data: MessageData): Promise<SendResult> {
    try {
      this.logger.log(
        `[DISCORD] Enviando mensaje al usuario/canal ${data.recipient}`,
      );
      this.logger.debug(`Contenido: ${data.content}`);

      if (data.file) {
        this.logger.debug(`Archivo adjunto: ${data.file.substring(0, 50)}...`);
      }

      // Simulación de envío exitoso
      await this.simulateDelay(600);

      this.logger.log(
        `[DISCORD] ✅ Mensaje enviado exitosamente a ${data.recipient}`,
      );
      return {
        success: true,
        statusCode: 200,
      };
    } catch (error) {
      this.logger.error(
        `[DISCORD] ❌ Error al enviar mensaje: ${error.message}`,
      );
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async sendMassMessage(data: MassMessageData): Promise<SendResult> {
    try {
      this.logger.log(
        `[DISCORD] Enviando mensaje masivo a ${data.recipients.length} usuarios/canales`,
      );

      const results = await Promise.all(
        data.recipients.map((recipient) =>
          this.sendMessage({
            recipient,
            content: data.content,
            file: data.file,
          }),
        ),
      );

      const allSuccess = results.every((result) => result.success);

      if (allSuccess) {
        this.logger.log(
          `[DISCORD] ✅ Todos los mensajes masivos fueron enviados`,
        );
      } else {
        this.logger.warn(
          `[DISCORD] ⚠️ Algunos mensajes no pudieron ser enviados`,
        );
      }

      return {
        success: allSuccess,
        message: `${results.filter((r) => r.success).length}/${results.length} enviados`,
      };
    } catch (error) {
      this.logger.error(`[DISCORD] ❌ Error en envío masivo: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
