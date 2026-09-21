export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

export type Supplier = 'Supplier A' | 'Supplier B';

export interface HotelOffer {
  name: string;
  price: number;
  supplier: Supplier;
  commissionPct: number;
}

export interface HotelSearch {
  city: string;
  minPrice?: number;
  maxPrice?: number;
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function selectBestOffers(
  supplierA: SupplierHotel[],
  supplierB: SupplierHotel[],
): HotelOffer[] {
  const candidates: HotelOffer[] = [
    ...supplierA.map(({ name, price, commissionPct }) => ({
      name: name.trim().replace(/\s+/g, ' '),
      price,
      supplier: 'Supplier A' as const,
      commissionPct,
    })),
    ...supplierB.map(({ name, price, commissionPct }) => ({
      name: name.trim().replace(/\s+/g, ' '),
      price,
      supplier: 'Supplier B' as const,
      commissionPct,
    })),
  ];
  const bestByName = new Map<string, HotelOffer>();
  for (const candidate of candidates) {
    const key = normalizeName(candidate.name);
    const existing = bestByName.get(key);
    if (!existing || candidate.price < existing.price) {
      bestByName.set(key, candidate);
    }
  }
  return [...bestByName.values()];
}
