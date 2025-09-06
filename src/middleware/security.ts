import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('security');

export const ipWhitelist = (req: Request, res: Response, next: NextFunction): void => {
  if (!config.security.allowedIPs || config.security.allowedIPs.length === 0) {
    next();
    return;
  }

  const clientIp = req.ip || req.socket.remoteAddress || '';
  const normalizedIp = clientIp.replace('::ffff:', '');
  
  if (!config.security.allowedIPs.includes(normalizedIp)) {
    logger.warn({ ip: normalizedIp }, 'Blocked request from unauthorized IP');
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
};

export const corsHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', config.security.corsOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256, X-GitHub-Event, X-GitHub-Delivery');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
};

export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.header('Content-Security-Policy', "default-src 'self'");
  next();
};