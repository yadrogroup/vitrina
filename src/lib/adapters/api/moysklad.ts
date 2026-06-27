/**
 * МойСклад (api.moysklad.ru, JSON API remap/1.2).
 * Полнофункциональный адаптер: товары, цены, остатки, категории, характеристики.
 *
 * Каверза: картинки в МойСклад отдаются по download-href ЗА авторизацией.
 * Плейн-fetch на этапе embed их не возьмёт → для таких товаров поиск по фото
 * деградирует (text-fallback). Если нужны фото в поиске — выгружайте их в
 * публичный CDN и кладите ссылку в доп.поле, либо включите загрузку картинок
 * в админку (см. ADMIN.md). Каталог при этом работает полностью.
 */

import type { Product, SourceAdapter, Variant } from '../../types/product';
import { normalizeAttributes } from '../normalize-attributes';
import { mapAvailability, slugify } from '../utils';
import {
  type ApiAdapterOptions,
  basicAuthHeader,
  fetchJson,
  trimTrailingSlash,
} from './base';

const DEFAULT_BASE = 'https://api.moysklad.ru/api/remap/1.2';
const PAGE_LIMIT = 100;

interface MsMeta {
  href?: string;
  type?: string;
}

interface MsRef {
  meta?: MsMeta;
  name?: string;
}

interface MsImageRow {
  miniature?: { downloadHref?: string };
  tiny?: { href?: string };
}

interface MsAttribute {
  name?: string;
  value?: unknown;
}

interface MsSalePrice {
  value?: number;
  priceType?: { name?: string };
}

interface MsProduct {
  id?: string;
  name?: string;
  code?: string;
  article?: string;
  description?: string;
  archived?: boolean;
  salePrices?: MsSalePrice[];
  productFolder?: MsRef;
  attributes?: MsAttribute[];
  images?: { rows?: MsImageRow[] };
}

interface MsListResponse<T> {
  rows?: T[];
  meta?: { size?: number };
}

interface MsStockRow {
  meta?: MsMeta; // assortment meta → href содержит product id
  stock?: number;
  quantity?: number;
}

function authHeader(opts: ApiAdapterOptions): string {
  const { token, login, password } = opts.credentials;
  if (token) return `Bearer ${token}`;
  if (login && password) return basicAuthHeader(login, password);
  throw new Error('МойСклад: не переданы token или login/password');
}

function kopecksToRub(value: number | undefined): number {
  if (typeof value !== 'number') return 0;
  return Math.round(value / 100);
}

function idFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const match = href.match(/\/([0-9a-fA-F-]{36})(?:\?|$)/);
  return match?.[1];
}

function attributesToRecord(attrs: MsAttribute[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of attrs ?? []) {
    if (!attr.name || attr.value === undefined || attr.value === null) continue;
    const value =
      typeof attr.value === 'object'
        ? ((attr.value as MsRef).name ?? '')
        : String(attr.value);
    if (value) out[attr.name] = value;
  }
  return out;
}

export function createMoyskladAdapter(opts: ApiAdapterOptions): SourceAdapter {
  const base = trimTrailingSlash(opts.baseUrl || DEFAULT_BASE);
  const headers = { Authorization: authHeader(opts) };

  let products: MsProduct[] = [];
  const stockById = new Map<string, number>();

  async function fetchAllProducts(): Promise<MsProduct[]> {
    const all: MsProduct[] = [];
    let offset = 0;

    for (;;) {
      const url = `${base}/entity/product?limit=${PAGE_LIMIT}&offset=${offset}&expand=productFolder,images`;
      const page = await fetchJson<MsListResponse<MsProduct>>(url, { headers });
      const rows = page.rows ?? [];
      all.push(...rows);
      if (rows.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
      if (offset > 10_000) break; // защита от бесконечного цикла
    }

    return all.filter((p) => !p.archived);
  }

  async function fetchStock(): Promise<void> {
    try {
      let offset = 0;
      for (;;) {
        const url = `${base}/report/stock/all?limit=1000&offset=${offset}`;
        const page = await fetchJson<MsListResponse<MsStockRow>>(url, { headers });
        const rows = page.rows ?? [];
        for (const row of rows) {
          const id = idFromHref(row.meta?.href);
          const qty = row.stock ?? row.quantity;
          if (id && typeof qty === 'number') stockById.set(id, qty);
        }
        if (rows.length < 1000) break;
        offset += 1000;
        if (offset > 50_000) break;
      }
    } catch {
      // отчёт по остаткам опционален — без него availability = unknown
    }
  }

  return {
    name: 'api',
    capabilities: { stock: true, images: true, variants: false, attributes: true },

    async fetch() {
      [products] = await Promise.all([fetchAllProducts(), fetchStock()]);
      return products;
    },

    toCanonical(raw: unknown): Product {
      const p = raw as MsProduct;
      const id = p.id ?? p.code ?? p.article ?? '';
      if (!id) throw new Error('МойСклад: товар без id');

      const title = p.name?.trim() || `Товар ${id}`;
      const price = kopecksToRub(p.salePrices?.[0]?.value);
      const stock = stockById.get(p.id ?? '');
      const category = p.productFolder?.name?.trim();

      const images = (p.images?.rows ?? [])
        .map((row) => row.miniature?.downloadHref ?? row.tiny?.href)
        .filter((u): u is string => Boolean(u));

      return {
        id,
        slug: slugify(title, id),
        title,
        description: p.description?.trim() || undefined,
        price,
        currency: 'RUB',
        availability: mapAvailability(undefined, stock),
        stock,
        categories: category ? [category] : [],
        images,
        attributes: normalizeAttributes(attributesToRecord(p.attributes)),
      } satisfies Product;
    },
  };
}

/** Заготовка под характеристики (modification) как варианты — включается при необходимости. */
export type { Variant };
