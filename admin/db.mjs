/**
 * Хранилище админки — встроенный node:sqlite (Node ≥ 22, без нативных зависимостей).
 * Эту же базу читает src/lib/adapters/db-adapter.ts на этапе sync.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  slug            TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  price           INTEGER NOT NULL DEFAULT 0,
  old_price       INTEGER,
  availability    TEXT NOT NULL DEFAULT 'unknown',
  stock           INTEGER,
  categories      TEXT NOT NULL DEFAULT '[]',
  images          TEXT NOT NULL DEFAULT '[]',
  attributes      TEXT NOT NULL DEFAULT '{}',
  variants        TEXT NOT NULL DEFAULT '[]',
  seo_title       TEXT,
  seo_description TEXT,
  bestseller      INTEGER NOT NULL DEFAULT 0,
  featured        INTEGER NOT NULL DEFAULT 0,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_position ON products(position);
`;

function migrateSchema(db) {
  for (const sql of [
    'ALTER TABLE products ADD COLUMN bestseller INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0',
  ]) {
    try {
      db.exec(sql);
    } catch {
      // колонка уже есть
    }
  }
}

export function openDb(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  migrateSchema(db);
  return db;
}

const COLUMNS = [
  'id', 'slug', 'title', 'description', 'price', 'old_price', 'availability',
  'stock', 'categories', 'images', 'attributes', 'variants',
  'seo_title', 'seo_description', 'bestseller', 'featured',
  'position', 'created_at', 'updated_at',
];

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? '',
    price: row.price,
    oldPrice: row.old_price ?? null,
    availability: row.availability,
    stock: row.stock ?? null,
    categories: JSON.parse(row.categories || '[]'),
    images: JSON.parse(row.images || '[]'),
    attributes: JSON.parse(row.attributes || '{}'),
    variants: JSON.parse(row.variants || '[]'),
    seo: { title: row.seo_title ?? '', description: row.seo_description ?? '' },
    bestseller: row.bestseller === 1,
    featured: row.featured === 1,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProducts(db) {
  const rows = db.prepare('SELECT * FROM products ORDER BY position ASC, created_at ASC').all();
  return rows.map(rowToApi);
}

export function getProduct(db, id) {
  return rowToApi(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
}

export function countProducts(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
}

function slugify(title, id) {
  const base = String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const safeId = String(id).replace(/[^\p{L}\p{N}]+/gu, '-');
  return base ? `${base}-${safeId}` : safeId;
}

/** Создаёт или обновляет товар. Возвращает сохранённую запись (API-форму). */
export function upsertProduct(db, input) {
  const now = new Date().toISOString();
  const id = String(input.id || `p${Date.now()}`).trim();
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Укажите название товара');

  const existing = db.prepare('SELECT id, created_at, position FROM products WHERE id = ?').get(id);
  const price = Math.max(0, Math.round(Number(input.price) || 0));
  const oldPriceRaw = Math.round(Number(input.oldPrice) || 0);
  const oldPrice = oldPriceRaw > price ? oldPriceRaw : null;
  const stock = input.stock === '' || input.stock === null || input.stock === undefined
    ? null
    : Math.round(Number(input.stock));

  let availability = input.availability;
  if (!availability || availability === 'auto') {
    availability = stock === null ? 'unknown' : stock > 0 ? 'in_stock' : 'out_of_stock';
  }

  const record = {
    id,
    slug: (input.slug && String(input.slug).trim()) || slugify(title, id),
    title,
    description: input.description ? String(input.description) : null,
    price,
    old_price: oldPrice,
    availability,
    stock,
    categories: JSON.stringify(normalizeStringArray(input.categories)),
    images: JSON.stringify(normalizeStringArray(input.images)),
    attributes: JSON.stringify(input.attributes && typeof input.attributes === 'object' ? input.attributes : {}),
    variants: JSON.stringify(Array.isArray(input.variants) ? input.variants : []),
    seo_title: input.seo?.title ? String(input.seo.title) : null,
    seo_description: input.seo?.description ? String(input.seo.description) : null,
    bestseller: input.bestseller ? 1 : 0,
    featured: input.featured ? 1 : 0,
    position: existing ? existing.position : countProducts(db),
    created_at: existing ? existing.created_at : now,
    updated_at: now,
  };

  const placeholders = COLUMNS.map((c) => `@${c}`).join(', ');
  const updates = COLUMNS.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
  db.prepare(
    `INSERT INTO products (${COLUMNS.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
  ).run(record);

  return getProduct(db, id);
}

export function deleteProduct(db, id) {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return info.changes > 0;
}

export function listCategories(db) {
  const set = new Set();
  for (const row of db.prepare('SELECT categories FROM products').all()) {
    for (const cat of JSON.parse(row.categories || '[]')) set.add(cat);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[,;\n]/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}
