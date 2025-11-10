import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageSenderFactory } from './factories/message-sender.factory';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly messageSenderFactory: MessageSenderFactory,
  ) {}

  /**
   * Envía un mensaje usando la estrategia correspondiente y lo guarda en la base de datos
   * @param createMessageDto Datos del mensaje a enviar
   * @param userId ID del usuario autenticado que envía el mensaje
   * @returns El mensaje guardado en la base de datos
   */
  async sendMessage(
    createMessageDto: CreateMessageDto,
    userId: string,
  ): Promise<MessageDocument> {
    const { platform, recipients, content, file } = createMessageDto;

    this.logger.log(
      `Usuario ${userId} intentando enviar mensaje por ${platform} a ${recipients.length} destinatario(s)`,
    );

    try {
      // Obtener la estrategia de envío correspondiente usando Factory Pattern
      const senderStrategy = this.messageSenderFactory.getSender(platform);

      // Intentar enviar el mensaje usando la estrategia
      let sendResult: any;
      let delivered: boolean = false;

      if (recipients.length === 1) {
        // Envío individual
        sendResult = await senderStrategy.sendMessage({
          recipient: recipients[0],
          content,
          file,
        });
        delivered = sendResult.delivered || false;
      } else {
        // Envío masivo
        if (senderStrategy.sendMassMessage) {
          sendResult = await senderStrategy.sendMassMessage({
            recipients,
            content,
            file,
          });
          delivered = sendResult.delivered || false;
        } else {
          // Fallback: enviar uno por uno si no hay método masivo
          const results = await Promise.all(
            recipients.map((recipient) =>
              senderStrategy.sendMessage({ recipient, content, file }),
            ),
          );
          delivered = results.every((result) => result.delivered === true);
          sendResult = {
            success: results.every((result) => result.success),
            delivered,
          };
        }
      }

      // Guardar el mensaje en la base de datos
      const newMessage = new this.messageModel({
        senderId: userId,
        recipients,
        platform,
        content,
        file,
        sent: sendResult.success || false,
        delivered, // Se marca como delivered si la respuesta fue exitosa (200)
      });

      const savedMessage = await newMessage.save();

      this.logger.log(
        `Mensaje ${String(savedMessage._id)} guardado. Estado de envío: ${sendResult.success ? 'Exitoso' : 'Fallido'}, Entregado: ${delivered}`,
      );

      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Error al procesar mensaje: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error al procesar el envío del mensaje',
      );
    }
  }

  /**
   * Obtiene todos los mensajes enviados por un usuario específico
   * @param userId ID del usuario autenticado
   * @returns Array de mensajes del usuario
   */
  async getUserMessages(userId: string): Promise<MessageDocument[]> {
    try {
      this.logger.log(`Consultando mensajes del usuario ${userId}`);

      const messages = await this.messageModel
        .find({ senderId: userId })
        .sort({ createdAt: -1 }) // Más recientes primero
        .exec();

      this.logger.log(
        `Se encontraron ${messages.length} mensaje(s) para el usuario ${userId}`,
      );

      return messages;
    } catch (error) {
      this.logger.error(
        `Error al obtener mensajes del usuario ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Error al obtener los mensajes');
    }
  }

  /**
   * Obtiene estadísticas de mensajes del usuario
   * @param userId ID del usuario autenticado
   * @returns Estadísticas de mensajes
   */
  async getUserMessageStats(userId: string) {
    try {
      const total = await this.messageModel.countDocuments({
        senderId: userId,
      });
      const sent = await this.messageModel.countDocuments({
        senderId: userId,
        sent: true,
      });
      const failed = await this.messageModel.countDocuments({
        senderId: userId,
        sent: false,
      });
      const delivered = await this.messageModel.countDocuments({
        senderId: userId,
        delivered: true,
      });

      const byPlatform = await this.messageModel.aggregate([
        { $match: { senderId: userId } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]);

      return {
        total,
        sent,
        failed,
        delivered,
        byPlatform: byPlatform.reduce((acc: Record<string, number>, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener estadísticas: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Error al obtener estadísticas');
    }
  }
}
