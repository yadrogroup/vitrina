import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import siteConfig from '../site.config';
import { createAdapter } from '../src/lib/adapters/factory';
import { getProjectRoot } from '../src/lib/adapters/utils';
import type { Catalog, Product } from '../src/lib/types/product';

function stripEmbedding(product: Product): Product {
  const { embedding: _embedding, ...rest } = product;
  return rest;
}

async function main(): Promise<void> {
  const adapter = createAdapter(siteConfig);
  const warnings: string[] = [];

  console.log(`[sync] tenant: ${siteConfig.tenant}, source: ${adapter.name}`);

  const rawItems = await adapter.fetch();
  const products: Product[] = [];

  for (const raw of rawItems) {
    try {
      products.push(stripEmbedding(adapter.toCanonical(raw)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(message);
      console.warn(`[sync] пропуск записи: ${message}`);
    }
  }

  const catalog: Catalog = {
    products,
    meta: {
      tenant: siteConfig.tenant,
      updatedAt: new Date().toISOString(),
      source: adapter.name,
      capabilities: adapter.capabilities,
      productCount: products.length,
      warnings,
    },
  };

  const outPath = path.join(getProjectRoot(), 'data', 'catalog.json');
  await writeFile(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf-8');

  console.log(`[sync] ${products.length} товаров → ${outPath}`);
  if (warnings.length > 0) {
    console.warn(`[sync] предупреждений: ${warnings.length}`);
  }
}

main().catch((error: unknown) => {
  console.error('[sync] ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});
