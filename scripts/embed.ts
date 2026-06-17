import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getProducts } from '../src/lib/catalog';
import { CLIP_MODEL_ID } from '../src/lib/search/config';
import type { EmbeddingsFile } from '../src/lib/search/types';
import { ensureCatalogDemoImages } from './lib/ensure-demo-images';
import {
  configureNodeClipEnv,
  embedImageWithClip,
  embedTextWithClip,
  getProjectRoot,
  loadClipModels,
  resolveImageSource,
} from './lib/clip-node';

async function main(): Promise<void> {
  const root = getProjectRoot();
  const products = getProducts();

  console.log(`[embed] товаров: ${products.length}`);

  const created = await ensureCatalogDemoImages(root);
  if (created.length > 0) {
    console.log(`[embed] создано placeholder-фото: ${created.length}`);
  }

  configureNodeClipEnv(true);

  console.log('[embed] загрузка SigLIP…');
  const models = await loadClipModels((progress) => {
    if (progress.status === 'progress' && progress.file) {
      const pct = progress.progress !== undefined ? ` ${Math.round(progress.progress)}%` : '';
      process.stdout.write(`\r[embed] ${progress.file}${pct}   `);
    }
  });
  console.log('\n[embed] SigLIP готов');

  const items: Record<string, number[]> = {};
  const warnings: string[] = [];

  for (const product of products) {
    const imageUrl = product.images[0];
    let vector: number[] | null = null;

    if (imageUrl) {
      const source = await resolveImageSource(imageUrl);
      if (source) {
        try {
          vector = await embedImageWithClip(models, source);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`${product.id}: image embed failed (${message})`);
        }
      } else {
        warnings.push(`${product.id}: не удалось загрузить фото ${imageUrl}`);
      }
    }

    if (!vector) {
      const text = [product.title, product.description].filter(Boolean).join('. ');
      try {
        vector = await embedTextWithClip(models, text);
        warnings.push(`${product.id}: использован text-fallback`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`${product.id}: пропущен (${message})`);
      }
    }

    if (vector) {
      items[product.id] = vector;
    }
  }

  const payload: EmbeddingsFile = {
    model: CLIP_MODEL_ID,
    dim: Object.values(items)[0]?.length ?? 512,
    items,
  };

  const dataPath = path.join(root, 'data', 'embeddings.json');
  const publicPath = path.join(root, 'public', 'embeddings.json');

  await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  await writeFile(publicPath, `${JSON.stringify(payload)}\n`, 'utf-8');

  console.log(`[embed] ${Object.keys(items).length} векторов → data/embeddings.json, public/embeddings.json`);
  if (warnings.length > 0) {
    console.warn(`[embed] предупреждений: ${warnings.length}`);
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }
}

main().catch((error: unknown) => {
  console.error('[embed] ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});
