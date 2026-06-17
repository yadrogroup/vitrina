import type { Product } from '../../src/lib/types/product';
import { formatAttributes } from './enrich-hash';
import type { EnrichCacheEntry } from './enrich-cache';

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Шаблонное обогащение без GigaChat — для демо и офлайн-сборки. */
export function buildLocalEnrichEntry(product: Product, inputHash: string): EnrichCacheEntry {
  const attrs = formatAttributes(product);
  const intro = product.description?.trim() || `${product.title} — модель из каталога ${product.categories[0] ?? 'мебели'}.`;
  const details = attrs
    ? `Характеристики: ${attrs}. Подберём доставку и сборку под ваш адрес.`
    : 'Уточним срок поставки и условия доставки после оформления заказа.';

  const descriptionRich = [intro, '', details].join('\n');
  const category = product.categories[0] ?? 'мебель';

  return {
    inputHash,
    descriptionRich,
    seo: {
      title: `${product.title} — купить ${category.toLowerCase()}`,
      description: `${capitalize(intro.slice(0, 140))} Цена ${product.price.toLocaleString('ru-RU')} ₽.`,
    },
    updatedAt: new Date().toISOString(),
  };
}
