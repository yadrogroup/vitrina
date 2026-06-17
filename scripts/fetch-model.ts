import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  configureNodeClipEnv,
  getProjectRoot,
  loadClipModels,
} from './lib/clip-node';
import { CLIP_MODEL_ID } from '../src/lib/search/config';

async function main(): Promise<void> {
  const root = getProjectRoot();
  const modelsDir = path.join(root, 'public', 'models');

  console.log(`[fetch-model] модель: ${CLIP_MODEL_ID}`);
  console.log(`[fetch-model] каталог: ${modelsDir}`);

  await mkdir(modelsDir, { recursive: true });
  configureNodeClipEnv(true);

  await loadClipModels((progress) => {
    if (progress.status === 'progress' && progress.file) {
      const pct = progress.progress !== undefined ? ` ${Math.round(progress.progress)}%` : '';
      console.log(`[fetch-model] ${progress.file}${pct}`);
    }
  });

  console.log('[fetch-model] веса SigLIP сохранены в public/models/.cache/');
}

main().catch((error: unknown) => {
  console.error('[fetch-model] ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});
