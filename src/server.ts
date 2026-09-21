import { createServer } from 'node:http';
import { Client, Connection } from '@temporalio/client';
import { config } from './config';
import { checkHealth } from './health';
import { createApp } from './http/app';
import { logger } from './logger';
import { createRedis } from './redis';
import { createSearchService } from './search-service';

async function main() {
  const redis = createRedis(config.REDIS_URL);
  await redis.connect();
  const connection = await Connection.connect({
    address: config.TEMPORAL_ADDRESS,
  });
  const client = new Client({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
  });
  const app = createApp({
    search: createSearchService(client, config.TEMPORAL_TASK_QUEUE),
    health: () => checkHealth(redis, connection, config),
    supplierADown: config.SUPPLIER_A_DOWN,
    supplierBDown: config.SUPPLIER_B_DOWN,
  });
  const server = createServer(app);
  server.on('error', (error) => {
    logger.fatal({ err: error }, 'HTTP server error');
    process.exit(1);
  });
  server.listen(config.PORT, '0.0.0.0', () =>
    logger.info({ port: config.PORT }, 'API listening'),
  );
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('API shutdown requested');
    const timeout = setTimeout(() => process.exit(1), 70000).unref();
    server.close(() => {
      void (async () => {
        redis.disconnect();
        await connection.close();
        clearTimeout(timeout);
      })().catch((error) => {
        logger.error({ err: error }, 'API shutdown failed');
        process.exit(1);
      });
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.fatal({ err: error }, 'API startup failed');
  process.exit(1);
});
