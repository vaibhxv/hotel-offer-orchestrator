import type { Connection } from '@temporalio/client';
import type Redis from 'ioredis';
import type { Config } from './config';
import type { HealthReport } from './http/app';
import { fetchSupplierHotels } from './suppliers/client';

export async function checkHealth(
  redis: Redis,
  connection: Connection,
  config: Config,
): Promise<HealthReport> {
  const checks = [
    ['redis', () => redis.ping()],
    [
      'temporal',
      () =>
        connection.withDeadline(Date.now() + 2000, () =>
          connection.workflowService.getSystemInfo({}),
        ),
    ],
    [
      'supplierA',
      () =>
        fetchSupplierHotels(
          config.SUPPLIER_A_URL,
          'delhi',
          config.SUPPLIER_TIMEOUT_MS,
        ),
    ],
    [
      'supplierB',
      () =>
        fetchSupplierHotels(
          config.SUPPLIER_B_URL,
          'delhi',
          config.SUPPLIER_TIMEOUT_MS,
        ),
    ],
  ] as const;
  const entries = await Promise.all(
    checks.map(async ([name, check]) => {
      try {
        await check();
        return [name, { status: 'up' as const }] as const;
      } catch {
        return [name, { status: 'down' as const }] as const;
      }
    }),
  );
  return {
    status: entries.every(([, result]) => result.status === 'up')
      ? 'healthy'
      : 'unhealthy',
    dependencies: Object.fromEntries(entries),
  };
}
