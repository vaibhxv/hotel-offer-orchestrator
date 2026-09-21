import type { Client } from '@temporalio/client';
import type { HotelSearch } from './domain/hotels';
import { SearchUnavailableError } from './http/app';
import { logger } from './logger';
import type { hotelOffersWorkflow } from './workflows';

export function createSearchService(client: Client, taskQueue: string) {
  return async (search: HotelSearch, requestId: string) => {
    try {
      return await client.connection.withDeadline(Date.now() + 65000, () =>
        client.workflow.execute<typeof hotelOffersWorkflow>(
          'hotelOffersWorkflow',
          {
            taskQueue,
            workflowId: `hotel-search-${requestId}`,
            args: [search],
            workflowExecutionTimeout: '60 seconds',
          },
        ),
      );
    } catch (error) {
      logger.error(
        { err: error, requestId, city: search.city },
        'Temporal hotel search failed',
      );
      throw new SearchUnavailableError('Hotel search failed', { cause: error });
    }
  };
}
