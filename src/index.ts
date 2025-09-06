import express, { Request, Response } from 'express';
import { config, validateConfig } from './config';
import { GitHubWebhookHandler } from './webhooks/github';
import { GitHubAPIService } from './services/github-api';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { corsHeaders, securityHeaders } from './middleware/security';
import { logger } from './utils/logger';
import type { HealthCheckResponse } from './types';

validateConfig();

const app = express();
const webhookHandler = new GitHubWebhookHandler();
const githubService = new GitHubAPIService();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(corsHeaders);
app.use(securityHeaders);

app.get('/health', async (_req: Request, res: Response) => {
  try {
    const isConnected = await githubService.testConnection();
    const rateLimit = await githubService.getRateLimit();
    const metrics = webhookHandler.getMetrics();
    
    const response: HealthCheckResponse = {
      status: isConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '1.0.0',
      uptime: process.uptime(),
      github: {
        connected: isConnected,
        rateLimit,
      },
      metrics,
    };
    
    res.status(isConnected ? 200 : 503).json(response);
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '1.0.0',
      uptime: process.uptime(),
      github: { connected: false },
    });
  }
});

app.get('/metrics', (_req: Request, res: Response) => {
  const metrics = webhookHandler.getMetrics();
  
  const prometheusFormat = `# HELP webhook_processed_total Total number of webhooks processed
# TYPE webhook_processed_total counter
webhook_processed_total ${metrics.processed}

# HELP webhook_success_total Total number of successful webhook processings
# TYPE webhook_success_total counter
webhook_success_total ${metrics.success}

# HELP webhook_failed_total Total number of failed webhook processings
# TYPE webhook_failed_total counter
webhook_failed_total ${metrics.failed}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}
`;
  
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(prometheusFormat);
});

app.post('/webhook/github', (req: Request, res: Response) => {
  webhookHandler.handleWebhook(req, res).catch((error) => {
    logger.error({ error }, 'Webhook handler error');
    res.status(500).json({ error: 'Internal server error' });
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'GitHub Classroom Access Fixer',
    version: process.env['npm_package_version'] ?? '1.0.0',
    status: 'running',
    endpoints: {
      webhook: '/webhook/github',
      health: '/health',
      metrics: '/metrics',
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.server.port;

const server = app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      env: config.server.env,
      dryRun: config.features.dryRun,
      org: config.github.org,
    },
    'Server started',
  );
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

export default app;