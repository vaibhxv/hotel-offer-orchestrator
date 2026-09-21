import { log, proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { HotelActivities } from './activities';
import {
  selectBestOffers,
  type HotelOffer,
  type HotelSearch,
} from './domain/hotels';

const { fetchHotels, persistAndFilter } = proxyActivities<HotelActivities>({
  startToCloseTimeout: '8 seconds',
  scheduleToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '500 milliseconds',
    backoffCoefficient: 2,
    maximumInterval: '2 seconds',
    maximumAttempts: 3,
  },
});

export async function hotelOffersWorkflow(
  search: HotelSearch,
): Promise<HotelOffer[]> {
  log.info('Hotel comparison started', { city: search.city });
  try {
    const [supplierA, supplierB] = await Promise.all([
      fetchHotels('Supplier A', search.city),
      fetchHotels('Supplier B', search.city),
    ]);
    const offers = selectBestOffers(supplierA, supplierB);
    const results = await persistAndFilter(
      search,
      workflowInfo().workflowId,
      offers,
    );
    log.info('Hotel comparison completed', {
      city: search.city,
      count: results.length,
    });
    return results;
  } catch (error) {
    log.error('Hotel comparison failed', {
      city: search.city,
      error: String(error),
    });
    throw error;
  }
}
