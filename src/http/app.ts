import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import pinoHttp from 'pino-http';
import type { HotelOffer, HotelSearch } from '../domain/hotels';
import { normalizeName } from '../domain/hotels';
import { logger } from '../logger';
import { supplierAHotels, supplierBHotels } from '../suppliers/fixtures';
import { citySchema, searchSchema } from './validation';

export interface HealthReport {
  status: 'healthy' | 'unhealthy';
  dependencies: Record<string, { status: 'up' | 'down' }>;
}

interface AppDependencies {
  search: (search: HotelSearch, requestId: string) => Promise<HotelOffer[]>;
  health: () => Promise<HealthReport>;
  supplierADown: boolean;
  supplierBDown: boolean;
}

export class SearchUnavailableError extends Error {}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));
  app.use((request, response, next) => {
    response.setHeader('X-Request-Id', String(request.id));
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/health/live', (_request, response) =>
    response.json({ status: 'up' }),
  );
  app.get('/health', async (_request, response) => {
    const health = await dependencies.health();
    response.status(health.status === 'healthy' ? 200 : 503).json(health);
  });

  for (const [path, hotels, isDown] of [
    ['/supplierA/hotels', supplierAHotels, dependencies.supplierADown],
    ['/supplierB/hotels', supplierBHotels, dependencies.supplierBDown],
  ] as const) {
    app.get(path, (request, response) => {
      if (isDown) {
        response.status(503).json({
          error: {
            code: 'SUPPLIER_UNAVAILABLE',
            message: 'Mock supplier is unavailable',
          },
        });
        return;
      }
      const city =
        request.query.city === undefined
          ? undefined
          : citySchema.parse(request.query.city);
      response.json(
        city === undefined
          ? hotels
          : hotels.filter((hotel) => normalizeName(hotel.city) === city),
      );
    });
  }

  app.get('/api/hotels', async (request, response) => {
    const parsed = searchSchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid hotel search',
          details: parsed.error.issues,
        },
      });
      return;
    }
    const offers = await dependencies.search(parsed.data, String(request.id));
    response.json(offers);
  });

  app.use((_request, response) => {
    response
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
  });
  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    request,
    response,
    _next,
  ) => {
    request.log.error({ err: error }, 'Request failed');
    if (error instanceof SearchUnavailableError) {
      response.status(503).json({
        error: {
          code: 'SEARCH_UNAVAILABLE',
          message: 'Hotel comparison is temporarily unavailable. Please retry.',
        },
      });
      return;
    }
    if (error instanceof Error && error.name === 'ZodError') {
      response
        .status(400)
        .json({ error: { code: 'INVALID_QUERY', message: 'Invalid city' } });
      return;
    }
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    });
  };
  app.use(errorHandler);
  return app;
}
