import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog, Product } from '../src/lib/types/product';
import {
  getCachePath,
  loadEnrichCache,
  saveEnrichCache,
  type EnrichCacheEntry,
} from './lib/enrich-cache';
import { buildLocalEnrichEntry } from './lib/enrich-fallback';
import { formatAttributes, hashEnrichInput } from './lib/enrich-hash';
import {
  DESCRIPTION_PROMPT,
  SEO_PROMPT,
  fillPrompt,
  parseSeoResponse,
} from './lib/enrich-prompts';
import { gigachatComplete, hasGigaChatCredentials } from './lib/gigachat';
import { loadProjectEnv } from './lib/load-env';

loadProjectEnv();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'catalog.json');

async function loadCatalog(): Promise<Catalog> {
  const raw = await readFile(CATALOG_PATH, 'utf-8');
  return JSON.parse(raw) as Catalog;
}

async function saveCatalog(catalog: Catalog): Promise<void> {
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf-8');
}

async function enrichProduct(
  product: Product,
  cacheEntry: EnrichCacheEntry | undefined,
  inputHash: string,
): Promise<EnrichCacheEntry> {
  if (cacheEntry?.inputHash === inputHash && cacheEntry.descriptionRich && cacheEntry.seo) {
    return cacheEntry;
  }

  if (!hasGigaChatCredentials()) {
    if (cacheEntry?.inputHash === inputHash) return cacheEntry;
    console.log(`[enrich] локальный шаблон → ${product.id}`);
    return buildLocalEnrichEntry(product, inputHash);
  }

  const promptValues = {
    title: product.title,
    description: product.description ?? '—',
    attributes: formatAttributes(product) || '—',
  };

  console.log(`[enrich] GigaChat → ${product.id}`);

  const descriptionRich = await gigachatComplete(
    fillPrompt(DESCRIPTION_PROMPT, promptValues),
  );

  const seoRaw = await gigachatComplete(fillPrompt(SEO_PROMPT, promptValues));
  const seo = parseSeoResponse(seoRaw);

  if (!seo) {
    throw new Error(`не удалось распарсить SEO JSON для ${product.id}`);
  }

  return {
    inputHash,
    descriptionRich: descriptionRich.trim(),
    seo,
    updatedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const catalog = await loadCatalog();
  const cache = await loadEnrichCache();

  let fromCache = 0;
  let fromApi = 0;
  let fromLocal = 0;
  let skipped = 0;
  const warnings: string[] = [];

  console.log(`[enrich] товаров: ${catalog.products.length}`);
  console.log(`[enrich] кеш: ${getCachePath()}`);

  if (!hasGigaChatCredentials()) {
    console.warn('[enrich] GIGACHAT_API_KEY не задан — только чтение из кеша');
  }

  for (const product of catalog.products) {
    const inputHash = hashEnrichInput(product);
    const cached = cache.items[product.id];
    const hashMatch = cached?.inputHash === inputHash;

    try {
      if (hashMatch && cached.descriptionRich && cached.seo) {
        product.descriptionRich = cached.descriptionRich;
        product.seo = cached.seo;
        fromCache += 1;
        continue;
      }

      const entry = await enrichProduct(product, cached, inputHash);
      product.descriptionRich = entry.descriptionRich;
      product.seo = entry.seo;
      cache.items[product.id] = entry;

      if (hashMatch) {
        fromCache += 1;
      } else if (hasGigaChatCredentials()) {
        fromApi += 1;
      } else {
        fromLocal += 1;
      }
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${product.id}: ${message}`);

      if (cached?.descriptionRich) {
        product.descriptionRich = cached.descriptionRich;
        product.seo = cached.seo;
      }

      console.warn(`[enrich] пропуск ${product.id}: ${message}`);
    }
  }

  catalog.meta.updatedAt = new Date().toISOString();
  await saveCatalog(catalog);
  await saveEnrichCache(cache);

  console.log(
    `[enrich] готово: ${fromCache} из кеша, ${fromApi} через API, ${fromLocal} локально, ${skipped} пропущено`,
  );

  if (warnings.length > 0) {
    console.warn(`[enrich] предупреждений: ${warnings.length}`);
  }
}

main().catch((error: unknown) => {
  console.error('[enrich] ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});
