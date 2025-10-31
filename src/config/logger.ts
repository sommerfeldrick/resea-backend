import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for console (human-readable)
const consoleFormat = printf(({ level, message, timestamp, stack, service, userId, requestId, duration, ...metadata }) => {
  let msg = `${timestamp} [${level}]`;

  // Add context identifiers
  if (service) msg += ` [${service}]`;
  if (requestId) msg += ` [req:${requestId.substring(0, 8)}]`;
  if (userId) msg += ` [user:${userId}]`;

  msg += `: ${message}`;

  // Add duration for performance tracking
  if (duration !== undefined) {
    msg += ` (${duration}ms)`;
  }

  // Add metadata if present (pretty-printed)
  const metaKeys = Object.keys(metadata);
  if (metaKeys.length > 0) {
    msg += `\n  ${JSON.stringify(metadata, null, 2).split('\n').join('\n  ')}`;
  }

  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }

  return msg;
});

// JSON format for file logs (machine-readable)
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'resea-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport with colors (human-readable)
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    }),
    // File transport for errors (JSON)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    }),
    // File transport for all logs (JSON)
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: fileFormat
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  console.error('Failed to create logs directory:', error);
}

export default logger;
