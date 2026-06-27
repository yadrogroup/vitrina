import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEMO_HERO_SOURCE,
  DEMO_PRODUCT_GROUPS,
  getProjectRoot,
  isImageFile,
  resolveFilePath,
  resolveFolderPath,
  sortGroupFiles,
} from './lib/demo-image-sources';
import { optimizeImageToWebp } from './lib/optimize-image';

const ROOT = getProjectRoot();
const RAW_DIR = path.join(ROOT, 'scripts', '.cache', 'demo-raw');
const DEMO_DIR = path.join(ROOT, 'public', 'demo');
const CATALOG_PATH = path.join(ROOT, 'data', 'catalog.json');

interface CatalogFile {
  products: Array<{
    id: string;
    images: string[];
    variants?: Array<{ image?: string }>;
  }>;
  meta: Record<string, unknown>;
}

interface OptimizedEntry {
  file: string;
  credit: string;
  kb: number;
  source: string;
}

async function removeOldWebp(): Promise<void> {
  const entries = await readdir(DEMO_DIR).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.endsWith('.webp'))
      .map((name) => rm(path.join(DEMO_DIR, name))),
  );
}

async function removeLegacyJpegs(): Promise<void> {
  const entries = await readdir(DEMO_DIR).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.endsWith('.jpg'))
      .map((name) => rm(path.join(DEMO_DIR, name))),
  );
}

async function optimizeFromLocal(
  localPath: string,
  outputName: string,
  credit: string,
): Promise<OptimizedEntry> {
  const rawPath = path.join(RAW_DIR, `${outputName}.bin`);
  const webpPath = path.join(DEMO_DIR, `${outputName}.webp`);
  await copyFile(localPath, rawPath);
  const result = await optimizeImageToWebp(rawPath, webpPath);
  return {
    file: outputName,
    credit,
    kb: Math.round(result.bytes / 1024),
    source: path.basename(localPath),
  };
}

async function processProductGroup(
  group: (typeof DEMO_PRODUCT_GROUPS)[number],
): Promise<{ productId: string; images: string[]; entries: OptimizedEntry[] }> {
  const folderPath = resolveFolderPath(group.folder);
  const allNames = await readdir(folderPath);
  const imageNames = sortGroupFiles(allNames.filter(isImageFile), group.primary);

  if (imageNames.length === 0) {
    throw new Error(`Нет фото в ${group.folder}`);
  }

  const images: string[] = [];
  const entries: OptimizedEntry[] = [];

  for (let i = 0; i < imageNames.length; i += 1) {
    const outputName = `${group.base}-${i + 1}`;
    const localPath = path.join(folderPath, imageNames[i]);
    process.stdout.write(`  ${outputName} ← ${imageNames[i]}… `);
    const entry = await optimizeFromLocal(localPath, outputName, group.credit);
    entries.push(entry);
    images.push(`/demo/${outputName}.webp`);
    console.log(`${entry.kb} КБ`);
  }

  return { productId: group.productId, images, entries };
}

async function updateCatalog(productImages: Map<string, string[]>): Promise<number> {
  const raw = await readFile(CATALOG_PATH, 'utf-8');
  const catalog = JSON.parse(raw) as CatalogFile;
  let updated = 0;

  for (const product of catalog.products) {
    const images = productImages.get(product.id);
    if (!images) continue;

    product.images = images;
    updated += 1;

    if (product.variants?.length) {
      const primary = images[0];
      const imageSet = new Set(images);
      for (const variant of product.variants) {
        if (!variant.image?.startsWith('/demo/')) continue;
        if (!imageSet.has(variant.image)) {
          variant.image = primary;
        }
      }
    }
  }

  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf-8');
  return updated;
}

async function writeCredits(results: OptimizedEntry[]): Promise<void> {
  const lines = [
    '# Атрибуция demo-изображений',
    '',
    'Источник: pics/ (подбор клиента). Только для демо шаблона.',
    '',
    '| Файл | Источник | Исходник | Размер |',
    '|------|----------|----------|--------|',
    ...results.map(
      (item) => `| ${item.file}.webp | ${item.credit} | ${item.source} | ${item.kb} КБ |`,
    ),
    '',
  ];
  await writeFile(path.join(DEMO_DIR, 'CREDITS.md'), `${lines.join('\n')}\n`, 'utf-8');
}

async function main(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(DEMO_DIR, { recursive: true });
  await removeOldWebp();

  console.log('[prepare-demo] конвертация pics/ → webp…');
  const productImages = new Map<string, string[]>();
  const optimized: OptimizedEntry[] = [];

  for (const group of DEMO_PRODUCT_GROUPS) {
    console.log(`[${group.base}] ${group.folder}`);
    const result = await processProductGroup(group);
    productImages.set(result.productId, result.images);
    optimized.push(...result.entries);
  }

  process.stdout.write(`  ${DEMO_HERO_SOURCE.file}… `);
  const heroEntry = await optimizeFromLocal(
    resolveFilePath(DEMO_HERO_SOURCE.localPath),
    DEMO_HERO_SOURCE.file,
    DEMO_HERO_SOURCE.credit,
  );
  optimized.push(heroEntry);
  console.log(`${heroEntry.kb} КБ`);

  await removeLegacyJpegs();
  const catalogUpdated = await updateCatalog(productImages);
  await writeCredits(optimized);

  const totalWebp = optimized.length;
  console.log(
    `[prepare-demo] готово: ${totalWebp} webp, товаров в catalog: ${catalogUpdated}`,
  );
}

main().catch((error: unknown) => {
  console.error('[prepare-demo] ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});
