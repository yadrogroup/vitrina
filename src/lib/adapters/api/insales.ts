/**
 * InSales (REST, Basic-auth api_key:password).
 * ЗАГОТОВКА: базовый маппинг товара; варианты/коллекции помечены TODO.
 *
 * Подключение:
 *   catalog.url = https://<account>.myinsales.ru
 *   INSALES_API_KEY, INSALES_PASSWORD (пароль приложения)
 */

import type { Product, SourceAdapter } from '../../types/product';
import { normalizeAttributes } from '../normalize-attributes';
import { mapAvailability, parsePrice, slugify } from '../utils';
import {
  type ApiAdapterOptions,
  basicAuthHeader,
  fetchJson,
  trimTrailingSlash,
} from './base';

const PER_PAGE = 100;

interface InsalesVariant {
  id?: number;
  price?: string | number;
  quantity?: number;
}

interface InsalesProduct {
  id?: number;
  title?: string;
  description?: string;
  available?: boolean;
  variants?: InsalesVariant[];
  images?: { original_url?: string }[];
  collection_ids?: number[];
}

export function createInsalesAdapter(opts: ApiAdapterOptions): SourceAdapter {
  const base = trimTrailingSlash(opts.baseUrl);
  const { login, password } = opts.credentials;
  if (!login || !password) throw new Error('InSales: нужны INSALES_API_KEY и INSALES_PASSWORD');
  const headers = { Authorization: basicAuthHeader(login, password) };

  let products: InsalesProduct[] = [];

  return {
    name: 'api',
    capabilities: { stock: true, images: true, variants: false, attributes: true },

    async fetch() {
      const all: InsalesProduct[] = [];
      let page = 1;
      for (;;) {
        const url = `${base}/admin/products.json?per_page=${PER_PAGE}&page=${page}`;
        const rows = await fetchJson<InsalesProduct[]>(url, { headers });
        if (!Array.isArray(rows) || rows.length === 0) break;
        all.push(...rows);
        if (rows.length < PER_PAGE) break;
        page += 1;
        if (page > 200) break;
      }
      products = all;
      return products;
    },

    toCanonical(raw: unknown): Product {
      const p = raw as InsalesProduct;
      const id = String(p.id ?? '');
      if (!id) throw new Error('InSales: товар без id');
      const title = (p.title ?? `Товар ${id}`).trim();

      const firstVariant = p.variants?.[0];
      const price = parsePrice(firstVariant?.price ?? 0);
      const stock = firstVariant?.quantity;
      const images = (p.images ?? [])
        .map((img) => img.original_url)
        .filter((u): u is string => Boolean(u));

      return {
        id,
        slug: slugify(title, id),
        title,
        description: p.description ? String(p.description) : undefined,
        price,
        currency: 'RUB',
        availability: mapAvailability(p.available, stock),
        stock,
        categories: [], // TODO(client): collection_ids → названия (GET /admin/collections.json)
        images,
        attributes: normalizeAttributes({}),
      };
    },
  };
}
