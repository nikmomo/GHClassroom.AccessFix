import pino from 'pino';
import { config } from '../config';

const transportOptions = config.logging.format === 'pretty' && config.server.env !== 'production'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

const pinoConfig: pino.LoggerOptions = {
  level: config.logging.level,
  ...(transportOptions && { transport: transportOptions }),
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-hub-signature-256"]', '*.token'],
    remove: true,
  },
};

export const logger = pino(pinoConfig);

export const createChildLogger = (name: string): pino.Logger => {
  return logger.child({ component: name });
};