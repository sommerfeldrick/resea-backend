/**
 * Request Tracing Middleware
 * Adiciona correlation IDs para rastreamento end-to-end
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger.js';

/**
 * Middleware para adicionar request ID único
 */
export function requestTracing(req: Request, res: Response, next: NextFunction): void {
  // Gera ou usa request ID existente
  const requestId = req.headers['x-request-id'] as string || randomUUID();

  // Adiciona ao request para uso posterior
  (req as any).requestId = requestId;

  // Adiciona aos headers de resposta
  res.setHeader('X-Request-ID', requestId);

  // Log de início da request
  const startTime = Date.now();

  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Intercepta resposta para log
  const originalSend = res.send;
  res.send = function(data: any): Response {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Extrai request ID do request (helper)
 */
export function getRequestId(req: Request): string {
  return (req as any).requestId || 'unknown';
}

/**
 * Middleware para log de erros com context
 */
export function errorLogging(err: Error, req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req);

  logger.error('Request error', {
    requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });

  next(err);
}
