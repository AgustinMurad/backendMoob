//Tipos de exportación centralizados

// User schema
export { User, UserSchema } from '../users/schemas/user.schema';
export type { UserDocument } from '../users/schemas/user.schema';

// Message schema
export {
  Message,
  MessageSchema,
  Platform,
} from '../messages/schemas/message.schema';
export type { MessageDocument } from '../messages/schemas/message.schema';
