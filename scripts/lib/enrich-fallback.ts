import type { Product } from '../../src/lib/types/product';
import { formatAttributes } from './enrich-hash';
import type { EnrichCacheEntry } from './enrich-cache';

/** Шаблонное обогащение без GigaChat — для демо и офлайн-сборки. */
export function buildLocalEnrichEntry(product: Product, inputHash: string): EnrichCacheEntry {
  const attrs = formatAttributes(product);
  const category = product.categories[0]?.toLowerCase() ?? 'мебель';
  const intro =
    product.description?.trim() ||
    `${product.title} — ${category} из каталога.`;

  const detailParts: string[] = [];
  if (attrs) detailParts.push(`Характеристики: ${attrs}.`);
  detailParts.push('Доставку и сборку согласуем после оформления заказа.');

  const descriptionRich = [intro, '', detailParts.join(' ')].join('\n');
  const seoDescription = `${intro} ${product.price.toLocaleString('ru-RU')} ₽.`.slice(0, 155);

  return {
    inputHash,
    descriptionRich,
    seo: {
      title: `${product.title}`.slice(0, 60),
      description: seoDescription,
    },
    updatedAt: new Date().toISOString(),
  };
}
