import { Injectable, BadRequestException } from '@nestjs/common';
import { SenderStrategy } from '../interfaces/sender-strategy.interface';
import { MessagePlatform } from '../dto/create-message.dto';
import { TelegramSender } from '../strategies/telegram.sender';
import { SlackSender } from '../strategies/slack.sender';
import { DiscordSender } from '../strategies/discord.sender';
import { WhatsappSender } from '../strategies/whatsapp.sender';

@Injectable()
export class MessageSenderFactory {
  constructor(
    private readonly telegramSender: TelegramSender,
    private readonly slackSender: SlackSender,
    private readonly discordSender: DiscordSender,
    private readonly whatsappSender: WhatsappSender,
  ) {}

  /**
   * Retorna la estrategia de envío correcta según la plataforma
   * @param platform Plataforma de envío (telegram, slack, discord, whatsapp)
   * @returns SenderStrategy correspondiente
   * @throws BadRequestException si la plataforma no es válida
   */
  getSender(platform: MessagePlatform): SenderStrategy {
    switch (platform) {
      case MessagePlatform.TELEGRAM:
        return this.telegramSender;

      case MessagePlatform.SLACK:
        return this.slackSender;

      case MessagePlatform.DISCORD:
        return this.discordSender;

      case MessagePlatform.WHATSAPP:
        return this.whatsappSender;

      default:
        throw new BadRequestException(
          `Plataforma no soportada: ${platform as string}. Opciones válidas: telegram, slack, discord, whatsapp`,
        );
    }
  }
}
