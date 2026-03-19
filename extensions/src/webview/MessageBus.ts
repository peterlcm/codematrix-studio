import { logger } from '../utils/logger';

type MessageHandlerCallback = (data: unknown) => void | Promise<void>;

export interface Message {
  type: string;
  payload?: unknown;
  id?: string;
}

export interface MessageHandler {
  handleMessage(message: Message): void | Promise<void>;
}

export class MessageBus {
  private handlers: Map<string, Set<MessageHandlerCallback>> = new Map();
  private messageHandler: MessageHandler | undefined;

  constructor(messageHandler?: MessageHandler) {
    if (messageHandler) {
      this.messageHandler = messageHandler;
    }
  }

  on(type: string, callback: MessageHandlerCallback): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(callback);
  }

  off(type: string, callback: MessageHandlerCallback): void {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.delete(callback);
    }
  }

  async handleMessage(message: Message): Promise<void> {
    logger.info('MessageBus handling message', { messageType: message.type });

    // Call registered callbacks for this message type
    const typeHandlers = this.handlers.get(message.type);
    if (typeHandlers) {
      for (const callback of typeHandlers) {
        try {
          await callback(message.payload);
        } catch (error) {
          logger.error('Message handler error', { error: String(error), messageType: message.type });
        }
      }
    }

    // Call the main message handler if set
    if (this.messageHandler) {
      try {
        await this.messageHandler.handleMessage(message);
      } catch (error) {
        logger.error('Message handler error', { error: String(error), messageType: message.type });
      }
    }
  }

  emit(type: string, payload?: unknown): void {
    // This is called by the extension to send messages to webview
    // The actual sending is done via the WebviewManager
    logger.debug('MessageBus emitting message', { messageType: type });
  }
}