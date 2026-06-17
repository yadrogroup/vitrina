import { createHash } from 'node:crypto';
import type { Product } from '../../src/lib/types/product';

export function buildEnrichInput(product: Product): string {
  const payload = {
    title: product.title,
    description: product.description ?? '',
    attributes: product.attributes,
  };

  return JSON.stringify(payload);
}

export function hashEnrichInput(product: Product): string {
  return createHash('sha256').update(buildEnrichInput(product)).digest('hex');
}

export function formatAttributes(product: Product): string {
  return Object.entries(product.attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}
