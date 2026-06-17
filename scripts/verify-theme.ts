/**
 * Проверка: перекраска тенанта = только токены в site.config.ts.
 * 1) В src/ нет «левых» hex-цветов (кроме global.css).
 * 2) Собранный HTML содержит accent из site.config.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import siteConfig from '../site.config';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const DIST_INDEX = join(ROOT, 'dist', 'index.html');

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const ALLOWED_HEX_FILES = new Set(['src/styles/global.css']);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (/\.(css|astro|ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function checkNoStrayHex(): string[] {
  const errors: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (ALLOWED_HEX_FILES.has(rel)) continue;

    const content = readFileSync(file, 'utf8');
    const matches = content.match(HEX_RE);
    if (matches?.length) {
      errors.push(`${rel}: найдены hex-цвета ${[...new Set(matches)].join(', ')}`);
    }
  }
  return errors;
}

function checkBuiltAccent(): string | null {
  let html: string;
  try {
    html = readFileSync(DIST_INDEX, 'utf8');
  } catch {
    return 'dist/index.html не найден — сначала выполните npm run build';
  }

  const accent = siteConfig.theme.accent.toLowerCase();
  if (!html.toLowerCase().includes(`--accent: ${accent}`) && !html.toLowerCase().includes(`--accent:${accent}`)) {
    return `В dist/index.html нет --accent: ${accent} из site.config.ts`;
  }
  return null;
}

const hexErrors = checkNoStrayHex();
const accentError = checkBuiltAccent();

if (hexErrors.length) {
  console.error('[verify-theme] Hex вне токенов:');
  hexErrors.forEach((e) => console.error('  •', e));
}

if (accentError) {
  console.error('[verify-theme]', accentError);
}

if (hexErrors.length || accentError) {
  process.exit(1);
}

console.log('[verify-theme] OK: accent из site.config.ts попадает в сборку, лишних hex в src/ нет');
