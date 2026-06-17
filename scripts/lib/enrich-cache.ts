import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface EnrichCacheEntry {
  inputHash: string;
  descriptionRich?: string;
  seo?: { title: string; description: string };
  updatedAt: string;
}

export interface EnrichCacheFile {
  items: Record<string, EnrichCacheEntry>;
}

const CACHE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/enrich-cache.json',
);

export async function loadEnrichCache(): Promise<EnrichCacheFile> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as EnrichCacheFile;
    return { items: parsed.items ?? {} };
  } catch {
    return { items: {} };
  }
}

export async function saveEnrichCache(cache: EnrichCacheFile): Promise<void> {
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf-8');
}

export function getCachePath(): string {
  return CACHE_PATH;
}
