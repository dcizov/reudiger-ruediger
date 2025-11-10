import { exec } from 'child_process';
import bodyParser from 'body-parser';
import express, { NextFunction, Request, Response } from 'express';

import { env } from './config';

export function startWebhookServer(): void {
  const app = express();
  const port = Number(env.WEBHOOK_PORT ?? 3001);

  app.use(bodyParser.json());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['x-webhook-token'];
    if (typeof token !== 'string' || token !== env.WEBHOOK_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  app.post('/webhook', (req: Request, res: Response) => {
    console.log('[Webhook] Payload received:', req.body);

    exec('/opt/reudiger-ruediger/deploy.sh', (error, stdout, _stderr) => {
      if (error) {
        console.error('[Webhook] Deployment error:', error);
        return;
      }
      console.log('[Webhook] Deployment output:', stdout);
    });

    res.status(200).send('Deployment started');
  });

  app.listen(port, () => {
    console.log(`[Webhook] Listening on port ${port}`);
  });
}
