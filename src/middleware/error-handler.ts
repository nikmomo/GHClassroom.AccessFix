import { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('error-handler');

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = err.statusCode ?? 500;
  const message = err.message || 'Internal Server Error';
  
  logger.error({
    error: err,
    statusCode,
    method: req.method,
    url: req.url,
    body: req.body,
  }, 'Request error');

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack }),
    },
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn({ method: req.method, url: req.url }, 'Route not found');
  
  res.status(404).json({
    error: {
      message: 'Route not found',
      statusCode: 404,
    },
  });
};