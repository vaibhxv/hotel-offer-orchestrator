import { ApplicationFailure } from '@temporalio/common';
import { log } from '@temporalio/activity';
import type Redis from 'ioredis';
import type { Config } from './config';
import type { HotelOffer, HotelSearch, Supplier } from './domain/hotels';
import { saveAndFilterOffers } from './offers-store';
import { fetchSupplierHotels, SupplierResponseError } from './suppliers/client';

export function createActivities(redis: Redis, config: Config) {
  return {
    async fetchHotels(supplier: Supplier, city: string) {
      const endpoint =
        supplier === 'Supplier A'
          ? config.SUPPLIER_A_URL
          : config.SUPPLIER_B_URL;
      try {
        const hotels = await fetchSupplierHotels(
          endpoint,
          city,
          config.SUPPLIER_TIMEOUT_MS,
        );
        log.info('Supplier hotels fetched', {
          supplier,
          city,
          count: hotels.length,
        });
        return hotels;
      } catch (error) {
        log.error('Supplier request failed', {
          supplier,
          city,
          error: String(error),
        });
        if (error instanceof SupplierResponseError) {
          throw ApplicationFailure.nonRetryable(
            error.message,
            'InvalidSupplierResponse',
          );
        }
        throw error;
      }
    },
    async persistAndFilter(
      search: HotelSearch,
      snapshotId: string,
      offers: HotelOffer[],
    ) {
      try {
        const filtered = await saveAndFilterOffers(
          redis,
          search,
          snapshotId,
          offers,
          config.REDIS_SNAPSHOT_TTL_SECONDS,
        );
        log.info('Offers saved and filtered in Redis', {
          city: search.city,
          snapshotId,
          total: offers.length,
          returned: filtered.length,
        });
        return filtered;
      } catch (error) {
        log.error('Redis offer operation failed', {
          snapshotId,
          error: String(error),
        });
        throw error;
      }
    },
  };
}

export type HotelActivities = ReturnType<typeof createActivities>;
