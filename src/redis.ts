import Redis from 'ioredis';
import { logger } from './logger';

export function createRedis(url: string): Redis {
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 2000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  });
  redis.on('error', (error) =>
    logger.error({ err: error }, 'Redis connection error'),
  );
  return redis;
}
