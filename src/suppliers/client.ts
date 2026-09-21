import { z } from 'zod';
import { normalizeName, type SupplierHotel } from '../domain/hotels';

const hotelSchema = z.object({
  hotelId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  price: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  city: z.string().trim().min(1),
  commissionPct: z.number().finite().min(0).max(100),
});

export class SupplierResponseError extends Error {}

export async function fetchSupplierHotels(
  endpoint: string,
  city: string,
  timeoutMs: number,
): Promise<SupplierHotel[]> {
  const url = new URL(endpoint);
  url.searchParams.set('city', city);
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`Supplier returned HTTP ${response.status}`);
  }
  const payload: unknown = await response.json().catch(() => {
    throw new SupplierResponseError('Supplier returned invalid JSON');
  });
  const parsed = z.array(hotelSchema).max(1000).safeParse(payload);
  if (!parsed.success) {
    throw new SupplierResponseError('Supplier returned an invalid hotel list');
  }
  return parsed.data.filter((hotel) => normalizeName(hotel.city) === city);
}
