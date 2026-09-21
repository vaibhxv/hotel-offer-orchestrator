import { config as loadEnvironment } from 'dotenv';
import { z } from 'zod';

loadEnvironment({ quiet: true });

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  REDIS_URL: z.url().default('redis://127.0.0.1:6379'),
  TEMPORAL_ADDRESS: z.string().min(1).default('127.0.0.1:7233'),
  TEMPORAL_NAMESPACE: z.string().min(1).default('default'),
  TEMPORAL_TASK_QUEUE: z.string().min(1).default('hotel-offers'),
  SUPPLIER_A_URL: z.url().default('http://127.0.0.1:3000/supplierA/hotels'),
  SUPPLIER_B_URL: z.url().default('http://127.0.0.1:3000/supplierB/hotels'),
  SUPPLIER_TIMEOUT_MS: z.coerce.number().int().min(100).max(5000).default(2000),
  REDIS_SNAPSHOT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  SUPPLIER_A_DOWN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SUPPLIER_B_DOWN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export const config = environmentSchema.parse(process.env);
export type Config = typeof config;
