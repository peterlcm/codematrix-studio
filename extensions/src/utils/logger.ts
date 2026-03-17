import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('CodeMatrix');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LoggerData = Record<string, any>;

export const logger = {
  info(message: string, data?: LoggerData): void {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    outputChannel.appendLine(`[INFO] ${new Date().toISOString()} - ${logMessage}`);
    console.log(`[CodeMatrix] ${logMessage}`);
  },

  warn(message: string, data?: LoggerData): void {
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    outputChannel.appendLine(`[WARN] ${new Date().toISOString()} - ${logMessage}`);
    console.warn(`[CodeMatrix] ${logMessage}`);
  },

  error(message: string, data?: LoggerData): void {
    const safeData = data || {};
    const logMessage = `${message} ${JSON.stringify(safeData)}`;
    outputChannel.appendLine(`[ERROR] ${new Date().toISOString()} - ${logMessage}`);
    console.error(`[CodeMatrix] ${logMessage}`);
  },

  debug(message: string, data?: LoggerData): void {
    if (process.env.NODE_ENV === 'development') {
      const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
      outputChannel.appendLine(`[DEBUG] ${new Date().toISOString()} - ${logMessage}`);
      console.log(`[CodeMatrix] ${logMessage}`);
    }
  },
};

export function createChildLogger(context: Record<string, unknown>) {
  return {
    info: (message: string, data?: Record<string, unknown>) =>
      logger.info(message, { ...context, ...data }),
    warn: (message: string, data?: Record<string, unknown>) =>
      logger.warn(message, { ...context, ...data }),
    error: (message: string, data?: Record<string, unknown>) =>
      logger.error(message, { ...context, ...data }),
    debug: (message: string, data?: Record<string, unknown>) =>
      logger.debug(message, { ...context, ...data }),
  };
}