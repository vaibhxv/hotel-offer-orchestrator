import type Redis from 'ioredis';
import type { HotelOffer, HotelSearch } from './domain/hotels';

export function snapshotKey(city: string, snapshotId: string): string {
  return `hotels:${encodeURIComponent(city)}:${snapshotId}`;
}

export async function saveAndFilterOffers(
  redis: Redis,
  search: HotelSearch,
  snapshotId: string,
  offers: HotelOffer[],
  ttlSeconds: number,
): Promise<HotelOffer[]> {
  const key = snapshotKey(search.city, snapshotId);
  const transaction = redis.multi().del(key);
  if (offers.length > 0) {
    transaction.zadd(
      key,
      ...offers.flatMap((offer) => [offer.price, JSON.stringify(offer)]),
    );
    transaction.expire(key, ttlSeconds);
  }
  transaction.set(
    `${key}:meta`,
    JSON.stringify({ city: search.city, count: offers.length }),
    'EX',
    ttlSeconds,
  );
  transaction.call(
    'ZRANGE',
    key,
    String(search.minPrice ?? '-inf'),
    String(search.maxPrice ?? '+inf'),
    'BYSCORE',
  );
  const results = await transaction.exec();
  if (!results) throw new Error('Redis transaction was aborted');
  for (const [error] of results) {
    if (error) throw error;
  }
  const rows = results.at(-1)?.[1];
  if (!Array.isArray(rows) || !rows.every((row) => typeof row === 'string')) {
    throw new Error('Redis returned an invalid hotel range');
  }
  return rows.map((row) => JSON.parse(row) as HotelOffer);
}
