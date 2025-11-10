export interface MessageData {
  recipient: string;
  content: string;
  file?: string;
}

export interface MassMessageData {
  recipients: string[];
  content: string;
  file?: string;
}

export interface SendResult {
  success: boolean;
  statusCode?: number;
  message?: string;
}

export interface SenderStrategy {
  /**
   * Envía un mensaje individual a un destinatario
   * @param data Datos del mensaje
   * @returns Promise<SendResult> - Información del resultado del envío
   */
  sendMessage(data: MessageData): Promise<SendResult>;

  /**
   * Envía un mensaje masivo a múltiples destinatarios
   * @param data Datos del mensaje masivo
   * @returns Promise<SendResult> - Información del resultado del envío masivo
   */
  sendMassMessage?(data: MassMessageData): Promise<SendResult>;
}
