import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog } from '../src/lib/types/product';
import { DEMO_PRODUCT_COPY } from './lib/demo-product-copy';
import type { EnrichCacheFile } from './lib/enrich-cache';
import { hashEnrichInput } from './lib/enrich-hash';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'catalog.json');
const CACHE_PATH = path.join(ROOT, 'data', 'enrich-cache.json');

async function main(): Promise<void> {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf-8')) as Catalog;
  let cache: EnrichCacheFile = { items: {} };

  try {
    cache = JSON.parse(await readFile(CACHE_PATH, 'utf-8')) as EnrichCacheFile;
    cache.items ??= {};
  } catch {
    /* пустой кеш */
  }

  let applied = 0;

  for (const product of catalog.products) {
    const copy = DEMO_PRODUCT_COPY[product.id];
    if (!copy) {
      console.warn(`[apply-demo-copy] нет текста для ${product.id}`);
      continue;
    }

    product.description = copy.description;
    product.descriptionRich = copy.descriptionRich;
    product.seo = copy.seo;

    const inputHash = hashEnrichInput(product);
    cache.items[product.id] = {
      inputHash,
      descriptionRich: copy.descriptionRich,
      seo: copy.seo,
      updatedAt: new Date().toISOString(),
    };

    applied += 1;
  }

  catalog.meta.updatedAt = new Date().toISOString();

  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf-8');
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf-8');

  console.log(`[apply-demo-copy] обновлено товаров: ${applied}`);
}

main().catch((error: unknown) => {
  console.error('[apply-demo-copy] ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});
