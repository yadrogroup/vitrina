/**
 * Lighthouse: performance, accessibility, SEO, best-practices.
 * Требует запущенный preview: npm run preview (порт 4321 по умолчанию).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const URL = process.env.LIGHTHOUSE_URL ?? 'http://localhost:4321/';
const OUT = join(ROOT, 'data', 'lighthouse-home.json');

const args = [
  'lighthouse',
  URL,
  '--only-categories=performance,accessibility,seo,best-practices',
  '--output=json',
  `--output-path=${OUT}`,
  '--chrome-flags=--headless',
  '--quiet',
];

console.log(`[quality] Lighthouse → ${URL}`);

const result = spawnSync('npx', ['--yes', ...args], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});

try {
  const report = JSON.parse(readFileSync(OUT, 'utf8'));
  const scores = Object.fromEntries(
    Object.entries(report.categories).map(([k, v]) => [k, Math.round(v.score * 100)]),
  );
  console.log('[quality] Scores:', scores);

  const summary = {
    date: new Date().toISOString().slice(0, 10),
    url: URL,
    scores,
  };
  writeFileSync(join(ROOT, 'data', 'lighthouse-summary.json'), JSON.stringify(summary, null, 2));

  if (scores.seo < 95 || scores.accessibility < 90) {
    console.warn('[quality] Ниже порога: SEO ≥95, a11y ≥90 — см. ONBOARDING.md');
    process.exitCode = 1;
  }
} catch {
  console.warn('[quality] Отчёт не прочитан; проверьте, что preview запущен');
  process.exitCode = result.status ?? 1;
}

if (result.status && result.status !== 0) {
  console.warn('[quality] Lighthouse завершился с ошибкой (часто EPERM на Windows при cleanup — JSON может быть валиден)');
}
