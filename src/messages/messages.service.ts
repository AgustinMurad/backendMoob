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
import { CloudinaryService } from './services/cloudinary.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 horas en segundos

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly messageSenderFactory: MessageSenderFactory,
    private readonly cloudinaryService: CloudinaryService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Envía un mensaje usando la estrategia correspondiente y lo guarda en la base de datos
   * @param createMessageDto Datos del mensaje a enviar
   * @param userId ID del usuario autenticado que envía el mensaje
   * @param file Archivo opcional adjunto al mensaje (recibido por Multer)
   * @returns El mensaje guardado en la base de datos
   */
  async sendMessage(
    createMessageDto: CreateMessageDto,
    userId: string,
    file?: Express.Multer.File,
  ): Promise<MessageDocument> {
    const { platform, recipients, content } = createMessageDto;

    this.logger.log(
      `Usuario ${userId} intentando enviar mensaje por ${platform} a ${recipients.length} destinatario(s)`,
    );

    try {
      // Subir archivo a Cloudinary si existe
      let fileUrl: string | undefined;
      if (file) {
        this.logger.log(
          `Subiendo archivo a Cloudinary: ${file.originalname} (${file.size} bytes)`,
        );
        fileUrl = await this.cloudinaryService.uploadFile(file);
        this.logger.log(`Archivo subido exitosamente: ${fileUrl}`);
      }

      // Obtener la estrategia de envío correspondiente usando Factory Pattern
      const senderStrategy = this.messageSenderFactory.getSender(platform);

      // Intentar enviar el mensaje usando la estrategia
      let sendResult: any;

      if (recipients.length === 1) {
        // Envío individual
        sendResult = await senderStrategy.sendMessage({
          recipient: recipients[0],
          content,
          file: fileUrl,
        });
      } else {
        // Envío masivo
        if (senderStrategy.sendMassMessage) {
          sendResult = await senderStrategy.sendMassMessage({
            recipients,
            content,
            file: fileUrl,
          });
        } else {
          // Fallback: enviar uno por uno en caso de que el servicio no permita envio masivo
          const results = await Promise.all(
            recipients.map((recipient) =>
              senderStrategy.sendMessage({ recipient, content, file: fileUrl }),
            ),
          );
          sendResult = {
            success: results.every((result) => result.success),
          };
        }
      }

      // Guardar en la db
      const newMessage = new this.messageModel({
        senderId: userId,
        recipients,
        platform,
        content,
        fileUrl,
        sent: sendResult.success || false,
      });

      const savedMessage = await newMessage.save();

      this.logger.log(
        `Mensaje ${String(savedMessage._id)} guardado. Estado de envío: ${sendResult.success ? 'Exitoso' : 'Fallido'}`,
      );

      // Invalidar caché del usuario después de enviar un mensaje
      await this.invalidateUserCache(userId);

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
   * Obtiene los mensajes enviados por un usuario específico con paginación
   * Usa caché de Redis para mejorar el rendimiento
   * @param userId ID del usuario autenticado
   * @param limit Número máximo de mensajes a retornar (por defecto: 10)
   * @param offset Número de mensajes a saltar (por defecto: 0)
   * @returns Objeto con mensajes y metadata de caché
   */
  async getUserMessages(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ messages: MessageDocument[]; fromCache: boolean }> {
    try {
      this.logger.log(
        `Consultando mensajes del usuario ${userId} (limit: ${limit}, offset: ${offset})`,
      );

      // Generar clave de caché basada en userId, limit y offset
      const cacheKey = `messages:${userId}:${limit}:${offset}`;

      // 1. Intentar obtener desde Redis
      const cachedData = await this.redisService.get(cacheKey);

      if (cachedData) {
        // Cache HIT: Parsear y devolver los datos cacheados
        const messages = JSON.parse(cachedData);
        this.logger.log(
          `✅ [CACHE HIT] Mensajes obtenidos desde Redis para usuario ${userId}`,
        );
        return {
          messages,
          fromCache: true,
        };
      }

      // Cache MISS: Consultar MongoDB
      this.logger.log(
        `❌ [CACHE MISS] Consultando MongoDB para usuario ${userId}`,
      );

      const messages = await this.messageModel
        .find({ senderId: userId })
        .sort({ createdAt: -1 }) // Más recientes primero
        .skip(offset) // Saltar hasta el 'offset' mensajes
        .limit(limit) // Limitar resultados
        .exec();

      this.logger.log(
        `Se encontraron ${messages.length} mensaje(s) para el usuario ${userId}`,
      );

      // 2. Guardar en Redis con TTL de 24 horas
      if (messages.length > 0) {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(messages),
          this.CACHE_TTL,
        );
        this.logger.log(
          `💾 Mensajes guardados en caché para usuario ${userId} (TTL: 24h)`,
        );
      }

      return {
        messages,
        fromCache: false,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener mensajes del usuario ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Error al obtener los mensajes');
    }
  }

  /**
   * Obtiene el total de mensajes de un usuario
   * @param userId ID del usuario autenticado
   * @returns Número total de mensajes
   */
  async getTotalUserMessages(userId: string): Promise<number> {
    try {
      const total = await this.messageModel.countDocuments({
        senderId: userId,
      });
      return total;
    } catch (error) {
      this.logger.error(
        `Error al contar mensajes del usuario ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Error al contar los mensajes');
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

      const byPlatform = await this.messageModel.aggregate([
        { $match: { senderId: userId } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]);

      return {
        total,
        sent,
        failed,
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

  /**
   * Invalida el caché de mensajes de un usuario
   * Elimina todas las claves que coincidan con el patrón messages:userId:*
   * @param userId ID del usuario
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `messages:${userId}:*`;
      const deletedKeys = await this.redisService.deleteByPattern(pattern);
      this.logger.log(
        `🗑️ Caché invalidado para usuario ${userId} (${deletedKeys} claves eliminadas)`,
      );
    } catch (error) {
      this.logger.error(
        `Error al invalidar caché del usuario ${userId}: ${error.message}`,
      );
    }
  }

}
