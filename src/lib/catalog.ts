import catalogData from '../../data/catalog.json';
import type { AdapterCapabilities, Catalog, Product } from './types/product';

export function loadCatalog(): Catalog {
  return catalogData as Catalog;
}

export function getProducts(): Product[] {
  return loadCatalog().products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return getProducts().find((p) => p.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return getProducts().find((p) => p.id === id);
}

export function getCapabilities(): AdapterCapabilities {
  return loadCatalog().meta.capabilities;
}

/** Категория-комплект — выносится в отдельную секцию, не в общий список категорий */
const BUNDLE_CATEGORY = 'Комплекты';

export interface CategoryInfo {
  id: string;
  label: string;
  count: number;
  image?: string;
}

export function getCategories(options: { includeBundles?: boolean } = {}): CategoryInfo[] {
  const map = new Map<string, { count: number; image?: string }>();

  for (const product of getProducts()) {
    for (const cat of product.categories) {
      const entry = map.get(cat) ?? { count: 0, image: undefined };
      entry.count += 1;
      if (!entry.image && product.images[0]) entry.image = product.images[0];
      map.set(cat, entry);
    }
  }

  return [...map.entries()]
    .filter(([id]) => options.includeBundles || id !== BUNDLE_CATEGORY)
    .map(([id, { count, image }]) => ({ id, label: id, count, image }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

export function getProductsByCategory(category: string): Product[] {
  return getProducts().filter((p) => p.categories.includes(category));
}

export function getBundles(): Product[] {
  return getProductsByCategory(BUNDLE_CATEGORY);
}

/** Хиты: товары без комплектов, со скидкой — в начало */
export function getFeaturedProducts(limit = 8): Product[] {
  return getProducts()
    .filter((p) => !p.categories.includes(BUNDLE_CATEGORY))
    .sort((a, b) => {
      const da = a.oldPrice && a.oldPrice > a.price ? 1 : 0;
      const db = b.oldPrice && b.oldPrice > b.price ? 1 : 0;
      return db - da;
    })
    .slice(0, limit);
}
