import { execFile } from 'child_process';
import bodyParser from 'body-parser';
import express, { NextFunction, Request, Response } from 'express';

import { env } from './config.js';
import { logger } from './util/logger.js';

/**
 * Rate limiting store for webhook requests
 * Maps IP addresses to timestamps of recent requests
 */
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Clean up old rate limit entries periodically
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore.entries()) {
    const recentRequests = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recentRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, recentRequests);
    }
  }
}

// Clean up rate limit store every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

export function startWebhookServer(): void {
  const app = express();
  const port = Number(env.WEBHOOK_PORT ?? 3001);

  app.use(bodyParser.json());

  // Authentication middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['x-webhook-token'];
    if (typeof token !== 'string' || token !== env.WEBHOOK_SECRET) {
      logger.warn('Unauthorized webhook attempt', {
        ip: req.ip,
        headers: req.headers,
      });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  // Rate limiting middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip ?? 'unknown';
    const now = Date.now();
    const timestamps = rateLimitStore.get(clientIp) ?? [];
    const recentRequests = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      logger.warn('Rate limit exceeded for webhook', { ip: clientIp });
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    recentRequests.push(now);
    rateLimitStore.set(clientIp, recentRequests);
    next();
  });

  app.post('/webhook', (req: Request, res: Response) => {
    // Safely handle request body (which is typed as any by Express)
    const payload: unknown = req.body;

    logger.info('Webhook payload received', {
      ip: req.ip,
      payload,
    });

    // Validate payload structure (basic validation)
    if (typeof payload !== 'object' || payload === null) {
      logger.warn('Invalid webhook payload format', { payload });
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    // Use execFile instead of exec for security (prevents command injection)
    execFile('/opt/reudiger-ruediger/deploy.sh', [], (error, stdout, stderr) => {
      if (error) {
        logger.error('Deployment error', {
          error: error.message,
          stderr,
          exitCode: error.code,
        });
        return;
      }
      logger.info('Deployment completed successfully', { stdout });
    });

    res.status(200).json({ status: 'Deployment started' });
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  app.listen(port, () => {
    logger.info(`Webhook server listening on port ${port}`, { port });
  });
}
