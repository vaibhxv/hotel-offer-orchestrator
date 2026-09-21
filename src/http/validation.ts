import { z } from 'zod';
import { normalizeName } from '../domain/hotels';

const price = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    'Use a nonnegative decimal with at most two decimal places',
  )
  .transform(Number)
  .pipe(z.number().finite().max(Number.MAX_SAFE_INTEGER));

export const citySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform(normalizeName);

export const searchSchema = z
  .object({
    city: citySchema,
    minPrice: price.optional(),
    maxPrice: price.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    {
      message: 'minPrice must be less than or equal to maxPrice',
      path: ['minPrice'],
    },
  );
