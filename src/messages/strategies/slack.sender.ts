import { Injectable, Logger } from '@nestjs/common';
import {
  SenderStrategy,
  MessageData,
  MassMessageData,
  SendResult,
} from '../interfaces/sender-strategy.interface';

@Injectable()
export class SlackSender implements SenderStrategy {
  private readonly logger = new Logger(SlackSender.name);

  async sendMessage(data: MessageData): Promise<SendResult> {
    try {
      this.logger.log(
        `[SLACK] Enviando mensaje al canal/usuario ${data.recipient}`,
      );
      this.logger.debug(`Contenido: ${data.content}`);

      if (data.file) {
        this.logger.debug(`Archivo adjunto: ${data.file.substring(0, 50)}...`);
      }

      // Simulación de envío exitoso
      await this.simulateDelay(400);

      this.logger.log(
        `[SLACK] ✅ Mensaje enviado exitosamente a ${data.recipient}`,
      );
      return {
        success: true,
        delivered: true,
        statusCode: 200,
      };
    } catch (error) {
      this.logger.error(`[SLACK] ❌ Error al enviar mensaje: ${error.message}`);
      return {
        success: false,
        delivered: false,
        message: error.message,
      };
    }
  }

  async sendMassMessage(data: MassMessageData): Promise<SendResult> {
    try {
      this.logger.log(
        `[SLACK] Enviando mensaje masivo a ${data.recipients.length} canales/usuarios`,
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
      const allDelivered = results.every((result) => result.delivered);

      if (allSuccess) {
        this.logger.log(
          `[SLACK] ✅ Todos los mensajes masivos fueron enviados`,
        );
      } else {
        this.logger.warn(
          `[SLACK] ⚠️ Algunos mensajes no pudieron ser enviados`,
        );
      }

      return {
        success: allSuccess,
        delivered: allDelivered,
        message: `${results.filter((r) => r.success).length}/${results.length} enviados`,
      };
    } catch (error) {
      this.logger.error(`[SLACK] ❌ Error en envío masivo: ${error.message}`);
      return {
        success: false,
        delivered: false,
        message: error.message,
      };
    }
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
