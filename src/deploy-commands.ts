import process from 'node:process';

import { deployCommands } from './util/deploy.js';
import { logger } from './util/logger.js';

deployCommands()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    logger.error('❌ Error deploying commands:', { error: err });
    process.exit(1);
  });
