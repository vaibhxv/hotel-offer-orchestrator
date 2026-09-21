import { createServer } from 'node:http';
import { NativeConnection, Worker } from '@temporalio/worker';
import { createActivities } from './activities';
import { config } from './config';
import { logger } from './logger';
import { createRedis } from './redis';

async function main() {
  const redis = createRedis(config.REDIS_URL);
  await redis.connect();
  const connection = await NativeConnection.connect({
    address: config.TEMPORAL_ADDRESS,
  });
  const worker = await Worker.create({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
    taskQueue: config.TEMPORAL_TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities: createActivities(redis, config),
    shutdownGraceTime: '35 seconds',
  });
  const healthServer = createServer((request, response) => {
    const healthy = worker.getState() === 'RUNNING';
    response.writeHead(
      request.url === '/health' ? (healthy ? 200 : 503) : 404,
      { 'Content-Type': 'application/json' },
    );
    response.end(JSON.stringify({ status: healthy ? 'up' : 'down' }));
  }).listen(config.WORKER_HEALTH_PORT, '0.0.0.0');
  healthServer.on('error', (error) => {
    logger.fatal({ err: error }, 'Worker health server failed');
    process.exit(1);
  });
  try {
    logger.info({ taskQueue: config.TEMPORAL_TASK_QUEUE }, 'Worker starting');
    await worker.run();
  } finally {
    healthServer.close();
    redis.disconnect();
    await connection.close();
  }
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Worker failed');
  process.exit(1);
});
