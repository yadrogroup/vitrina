/**
 * Разовый засев админской SQLite текущим каталогом (data/catalog.json).
 * Нужен, чтобы «Опубликовать» (source=db) воспроизводил сайт, а не очищал его.
 *   node /opt/vitrina-embed/admin/seed-from-catalog.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openDb, upsertProduct, countProducts } from './db.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DB_PATH = process.env.ADMIN_DB_PATH
  ? path.resolve(ROOT, process.env.ADMIN_DB_PATH)
  : path.join(ROOT, 'data', 'admin.sqlite');

const catalog = JSON.parse(readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
const products = Array.isArray(catalog.products) ? catalog.products : [];

const db = openDb(DB_PATH);
let n = 0;
for (const p of products) {
  upsertProduct(db, p);
  n += 1;
}
console.log(`seeded ${n} products; total in db: ${countProducts(db)}`);
