/**
 * RetailCRM (store API v5).
 * ЗАГОТОВКА: тянет товары магазина; цена/остаток берутся из первого оффера.
 *
 * Подключение:
 *   catalog.url = https://<account>.retailcrm.ru
 *   RETAILCRM_API_KEY
 */

import type { Product, SourceAdapter } from '../../types/product';
import { normalizeAttributes } from '../normalize-attributes';
import { mapAvailability, parsePrice, slugify } from '../utils';
import { type ApiAdapterOptions, fetchJson, trimTrailingSlash } from './base';

interface RcOffer {
  price?: number;
  quantity?: number;
}

interface RcProduct {
  id?: number;
  name?: string;
  description?: string;
  imageUrl?: string;
  offers?: RcOffer[];
  groups?: { name?: string }[];
}

interface RcResponse {
  success?: boolean;
  products?: RcProduct[];
  pagination?: { totalPageCount?: number };
}

export function createRetailcrmAdapter(opts: ApiAdapterOptions): SourceAdapter {
  const base = trimTrailingSlash(opts.baseUrl);
  const apiKey = opts.credentials.token;
  if (!apiKey) throw new Error('RetailCRM: нужен RETAILCRM_API_KEY');

  let products: RcProduct[] = [];

  return {
    name: 'api',
    capabilities: { stock: true, images: true, variants: false, attributes: true },

    async fetch() {
      const all: RcProduct[] = [];
      let page = 1;
      for (;;) {
        const url = `${base}/api/v5/store/products?apiKey=${encodeURIComponent(apiKey)}&page=${page}&limit=100`;
        const res = await fetchJson<RcResponse>(url);
        const rows = res.products ?? [];
        all.push(...rows);
        const totalPages = res.pagination?.totalPageCount ?? 1;
        if (page >= totalPages || rows.length === 0) break;
        page += 1;
        if (page > 200) break;
      }
      products = all;
      return products;
    },

    toCanonical(raw: unknown): Product {
      const p = raw as RcProduct;
      const id = String(p.id ?? '');
      if (!id) throw new Error('RetailCRM: товар без id');
      const title = (p.name ?? `Товар ${id}`).trim();

      const offer = p.offers?.[0];
      const price = parsePrice(offer?.price ?? 0);
      const stock = offer?.quantity;
      const category = p.groups?.[0]?.name?.trim();

      return {
        id,
        slug: slugify(title, id),
        title,
        description: p.description ? String(p.description) : undefined,
        price,
        currency: 'RUB',
        availability: mapAvailability(undefined, stock),
        stock,
        categories: category ? [category] : [],
        images: p.imageUrl ? [p.imageUrl] : [],
        attributes: normalizeAttributes({}),
      };
    },
  };
}
