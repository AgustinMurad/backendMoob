import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type MessageDocument = HydratedDocument<Message>;

export enum Platform {
  TELEGRAM = 'telegram',
  SLACK = 'slack',
  DISCORD = 'discord',
  WHATSAPP = 'whatsapp',
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Message extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  senderId: Types.ObjectId | User;

  @Prop({
    type: [String],
    required: true,
    validate: {
      validator: function (v: string[]) {
        return v && v.length > 0;
      },
      message: 'Recipients array must contain at least one recipient',
    },
  })
  recipients: string[];

  @Prop({
    required: true,
    enum: Object.values(Platform),
    type: String,
  })
  platform: Platform;

  @Prop({
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 5000,
  })
  content: string;

  @Prop({
    type: String,
    required: false,
    default: null,
  })
  fileUrl?: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  sent: boolean;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indices para performance
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ platform: 1 });
MessageSchema.index({ sent: 1 });
MessageSchema.index({ createdAt: -1 });

// Índice compuesto para consultas comunes
MessageSchema.index({ senderId: 1, platform: 1, sent: 1 });
