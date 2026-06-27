/**
 * Битрикс24 (REST через входящий вебхук).
 * ЗАГОТОВКА: тянет список товаров; маппинг цены и раздела помечен TODO,
 * т.к. зависит от каталога клиента (iblockId, типы цен).
 *
 * Подключение: BITRIX_WEBHOOK_URL=https://<portal>.bitrix24.ru/rest/<user>/<token>/
 */

import type { Product, SourceAdapter } from '../../types/product';
import { normalizeAttributes } from '../normalize-attributes';
import { mapAvailability, parsePrice, slugify } from '../utils';
import { type ApiAdapterOptions, fetchJson, trimTrailingSlash } from './base';

const PAGE = 50;

interface BxProduct {
  id?: number | string;
  iblockId?: number;
  name?: string;
  description?: string;
  price?: number | string;
  quantity?: number | string;
  // ... поля каталога специфичны для портала клиента
  [key: string]: unknown;
}

interface BxListResponse {
  result?: { products?: BxProduct[] } | BxProduct[];
  next?: number;
  total?: number;
}

function extractProducts(res: BxListResponse): BxProduct[] {
  if (Array.isArray(res.result)) return res.result;
  return res.result?.products ?? [];
}

export function createBitrixAdapter(opts: ApiAdapterOptions): SourceAdapter {
  const webhook = trimTrailingSlash(opts.credentials.webhookUrl ?? opts.baseUrl);
  let products: BxProduct[] = [];

  return {
    name: 'api',
    capabilities: { stock: true, images: false, variants: false, attributes: true },

    async fetch() {
      const all: BxProduct[] = [];
      let start = 0;
      for (;;) {
        const url = `${webhook}/catalog.product.list?start=${start}`;
        const page = await fetchJson<BxListResponse>(url);
        const rows = extractProducts(page);
        all.push(...rows);
        if (typeof page.next === 'number') {
          start = page.next;
        } else {
          break;
        }
        if (start > 10_000) break;
      }
      products = all;
      return products;
    },

    toCanonical(raw: unknown): Product {
      const p = raw as BxProduct;
      const id = String(p.id ?? '');
      if (!id) throw new Error('Битрикс: товар без id');
      const title = String(p.name ?? `Товар ${id}`).trim();

      // TODO(client): цена обычно приходит отдельным catalog.price.list по типу цены.
      const price = parsePrice(p.price);
      const stock = p.quantity !== undefined ? Number(p.quantity) : undefined;

      return {
        id,
        slug: slugify(title, id),
        title,
        description: p.description ? String(p.description) : undefined,
        price,
        currency: 'RUB',
        availability: mapAvailability(undefined, stock),
        stock: Number.isFinite(stock) ? stock : undefined,
        categories: [], // TODO(client): раздел инфоблока → catalog.section.list
        images: [], // TODO(client): catalog.productImage.list
        attributes: normalizeAttributes({}),
      };
    },
  };
}
