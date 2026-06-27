/**
 * Источник "db" — каталог из локальной SQLite, которую ведёт админка (admin/).
 * Поток: админка пишет в SQLite → `sync` (source=db) читает → catalog.json → embed → build.
 *
 * better-sqlite3 не нужен: используется встроенный node:sqlite (Node ≥ 22),
 * импортируется ЛЕНИВО, чтобы YML/CSV-сборки вообще не трогали SQLite.
 */

import path from 'node:path';
import type { Availability, Product, SourceAdapter, Variant } from '../types/product';
import { getProjectRoot, mapAvailability, slugify } from './utils';
import { normalizeAttributes } from './normalize-attributes';

interface DbRow {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number;
  old_price: number | null;
  availability: string | null;
  stock: number | null;
  categories: string | null;
  images: string | null;
  attributes: string | null;
  variants: string | null;
  seo_title: string | null;
  seo_description: string | null;
  bestseller: number | null;
  featured: number | null;
}

export function resolveDbPath(): string {
  const fromEnv = process.env.ADMIN_DB_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(getProjectRoot(), fromEnv);
  }
  return path.join(getProjectRoot(), 'data', 'admin.sqlite');
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToProduct(row: DbRow): Product {
  const title = row.title.trim();
  const stock = row.stock ?? undefined;
  const availability: Availability =
    (row.availability as Availability) || mapAvailability(undefined, stock);
  const oldPrice = row.old_price && row.old_price > row.price ? row.old_price : undefined;

  const product: Product = {
    id: row.id,
    slug: row.slug?.trim() || slugify(title, row.id),
    title,
    description: row.description?.trim() || undefined,
    price: row.price,
    oldPrice,
    currency: 'RUB',
    availability,
    stock,
    categories: parseJson<string[]>(row.categories, []),
    images: parseJson<string[]>(row.images, []),
    attributes: normalizeAttributes(parseJson<Record<string, string | number>>(row.attributes, {})),
  };

  const variants = parseJson<Variant[]>(row.variants, []);
  if (variants.length > 0) product.variants = variants;

  if (row.seo_title || row.seo_description) {
    product.seo = {
      title: row.seo_title?.trim() || undefined,
      description: row.seo_description?.trim() || undefined,
    };
  }

  if (row.bestseller === 1) product.bestseller = true;
  if (row.featured === 1) product.featured = true;

  return product;
}

export function createDbAdapter(): SourceAdapter {
  let rows: DbRow[] = [];

  return {
    name: 'db',
    capabilities: { stock: true, images: true, variants: true, attributes: true },

    async fetch() {
      const { DatabaseSync } = await import('node:sqlite');
      const dbPath = resolveDbPath();
      const db = new DatabaseSync(dbPath, { readOnly: true });
      try {
        rows = db
          .prepare('SELECT * FROM products ORDER BY position ASC, created_at ASC')
          .all() as unknown as DbRow[];
      } finally {
        db.close();
      }
      return rows;
    },

    toCanonical(raw: unknown): Product {
      return rowToProduct(raw as DbRow);
    },
  };
}
