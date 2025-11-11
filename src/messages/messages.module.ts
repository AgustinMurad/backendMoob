import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

// Estrategias de envío (Strategy Pattern)
import { TelegramSender } from './strategies/telegram.sender';
import { SlackSender } from './strategies/slack.sender';
import { DiscordSender } from './strategies/discord.sender';
import { WhatsappSender } from './strategies/whatsapp.sender';

// Factory Pattern
import { MessageSenderFactory } from './factories/message-sender.factory';

// Cloudinary Module
import { CloudinaryModule } from './config/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Message.name,
        schema: MessageSchema,
      },
    ]),
    CloudinaryModule,
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    // Estrategias de envío
    TelegramSender,
    SlackSender,
    DiscordSender,
    WhatsappSender,
    // Factory
    MessageSenderFactory,
  ],
  exports: [MessagesService, MongooseModule],
})
export class MessagesModule {}
