import { attributeLabel } from './format';
import type { Product } from './types/product';

export type SortOption = 'default' | 'price_asc' | 'price_desc' | 'title_asc' | 'title_desc';

export interface FilterOption {
  value: string;
  count: number;
}

export interface FilterFacet {
  key: string;
  label: string;
  type: 'select' | 'range';
  options?: FilterOption[];
  min?: number;
  max?: number;
}

export interface ActiveFilters {
  attributes: Record<string, string[]>;
  attrRanges: Record<string, { min?: number; max?: number }>;
  priceMin?: number;
  priceMax?: number;
  category?: string[];
}

export function buildFilterFacets(products: Product[]): FilterFacet[] {
  const facets: FilterFacet[] = [];
  const attrValues = new Map<string, Map<string, number>>();

  let priceMin = Infinity;
  let priceMax = 0;

  for (const product of products) {
    priceMin = Math.min(priceMin, product.price);
    priceMax = Math.max(priceMax, product.price);

    for (const [key, rawValue] of Object.entries(product.attributes)) {
      const value = String(rawValue);
      if (!attrValues.has(key)) attrValues.set(key, new Map());
      const bucket = attrValues.get(key)!;
      bucket.set(value, (bucket.get(value) ?? 0) + 1);
    }
  }

  if (Number.isFinite(priceMin) && priceMax > 0) {
    facets.push({
      key: 'price',
      label: 'Цена, ₽',
      type: 'range',
      min: priceMin,
      max: priceMax,
    });
  }

  for (const [key, values] of attrValues) {
    const options = [...values.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, 'ru'));

    if (options.length < 2) continue;

    const isNumeric = options.every((o) => !Number.isNaN(Number(o.value)));
    facets.push({
      key,
      label: attributeLabel(key),
      type: isNumeric ? 'range' : 'select',
      options: isNumeric ? undefined : options,
      min: isNumeric ? Math.min(...options.map((o) => Number(o.value))) : undefined,
      max: isNumeric ? Math.max(...options.map((o) => Number(o.value))) : undefined,
    });
  }

  return facets;
}

export function sortProducts(products: Product[], sort: SortOption): Product[] {
  const list = [...products];

  switch (sort) {
    case 'price_asc':
      return list.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return list.sort((a, b) => b.price - a.price);
    case 'title_asc':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    case 'title_desc':
      return list.sort((a, b) => b.title.localeCompare(a.title, 'ru'));
    default:
      return list;
  }
}

export function filterProducts(products: Product[], active: ActiveFilters): Product[] {
  return products.filter((product) => {
    if (active.category?.length) {
      if (!product.categories.some((c) => active.category!.includes(c))) return false;
    }

    if (active.priceMin !== undefined && product.price < active.priceMin) return false;
    if (active.priceMax !== undefined && product.price > active.priceMax) return false;

    for (const [key, values] of Object.entries(active.attributes)) {
      if (values.length === 0) continue;
      const productValue = product.attributes[key];
      if (productValue === undefined) return false;
      if (!values.includes(String(productValue))) return false;
    }

    return true;
  });
}

export function productFilterData(product: Product): Record<string, string> {
  const data: Record<string, string> = {
    price: String(product.price),
    category: product.categories.join('|'),
  };

  for (const [key, value] of Object.entries(product.attributes)) {
    data[key] = String(value);
  }

  return data;
}
