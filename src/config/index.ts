import { config as dotenvConfig } from 'dotenv';
import Joi from 'joi';
import type { Config } from '../types';

dotenvConfig();

const envSchema = Joi.object({
  GITHUB_TOKEN: Joi.string().required(),
  GITHUB_ORG: Joi.string().required(),
  WEBHOOK_SECRET: Joi.string().required(),
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('pretty'),
  DRY_RUN: Joi.boolean().default(false),
  AUTO_ADD_COLLABORATOR: Joi.boolean().default(true),
  DEFAULT_PERMISSION: Joi.string()
    .valid('pull', 'push', 'admin', 'maintain', 'triage')
    .default('push'),
  RATE_LIMIT_MAX_RETRIES: Joi.number().default(3),
  RATE_LIMIT_RETRY_DELAY: Joi.number().default(1000),
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().default(9090),
  ALLOWED_IPS: Joi.string().allow('').optional(),
  CORS_ORIGIN: Joi.string().default('*'),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config: Config = {
  github: {
    token: envVars.GITHUB_TOKEN as string,
    org: envVars.GITHUB_ORG as string,
    webhookSecret: envVars.WEBHOOK_SECRET as string,
  },
  server: {
    port: envVars.PORT as number,
    env: envVars.NODE_ENV as 'development' | 'production' | 'test',
  },
  logging: {
    level: envVars.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
    format: envVars.LOG_FORMAT as 'json' | 'pretty',
  },
  features: {
    dryRun: envVars.DRY_RUN as boolean,
    autoAddCollaborator: envVars.AUTO_ADD_COLLABORATOR as boolean,
    defaultPermission: envVars.DEFAULT_PERMISSION as 'pull' | 'push' | 'admin' | 'maintain' | 'triage',
  },
  rateLimiting: {
    maxRetries: envVars.RATE_LIMIT_MAX_RETRIES as number,
    retryDelay: envVars.RATE_LIMIT_RETRY_DELAY as number,
  },
  monitoring: {
    enableMetrics: envVars.ENABLE_METRICS as boolean,
    metricsPort: envVars.METRICS_PORT as number,
  },
  security: {
    ...(envVars.ALLOWED_IPS && {
      allowedIPs: (envVars.ALLOWED_IPS as string).split(',').map((ip) => ip.trim()),
    }),
    corsOrigin: envVars.CORS_ORIGIN as string,
  },
};

export const validateConfig = (): void => {
  if (config.server.env === 'production') {
    if (config.features.dryRun) {
      console.warn('WARNING: DRY_RUN is enabled in production');
    }
    if (config.security.corsOrigin === '*') {
      console.warn('WARNING: CORS is set to allow all origins in production');
    }
  }
};