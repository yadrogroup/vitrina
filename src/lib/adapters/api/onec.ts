/**
 * 1С (OData standard.odata).
 * ЗАГОТОВКА: имена полей в 1С локализованы и зависят от конфигурации,
 * поэтому маппинг помечен TODO. Часто проще выгружать из 1С YML/CommerceML
 * и использовать YML-адаптер — он не зависит от схемы OData.
 *
 * Подключение:
 *   catalog.url = http://<server>/<base>/odata/standard.odata
 *   ONEC_LOGIN, ONEC_PASSWORD — пользователь с правом на OData-сервис
 *   ONEC_ENTITY_SET (опц.) — имя набора, по умолчанию Catalog_Номенклатура
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

interface OdataRow {
  Ref_Key?: string;
  Code?: string;
  Description?: string; // в 1С обычно наименование
  // прочие поля специфичны для конфигурации
  [key: string]: unknown;
}

interface OdataResponse {
  value?: OdataRow[];
}

export function createOnecAdapter(opts: ApiAdapterOptions): SourceAdapter {
  const base = trimTrailingSlash(opts.baseUrl);
  const entitySet = process.env.ONEC_ENTITY_SET?.trim() || 'Catalog_Номенклатура';
  const { login, password } = opts.credentials;
  const headers: Record<string, string> =
    login && password ? { Authorization: basicAuthHeader(login, password) } : {};

  let rows: OdataRow[] = [];

  return {
    name: 'api',
    capabilities: { stock: false, images: false, variants: false, attributes: true },

    async fetch() {
      const url = `${base}/${encodeURIComponent(entitySet)}?$format=json&$filter=DeletionMark eq false`;
      const res = await fetchJson<OdataResponse>(url, { headers });
      rows = res.value ?? [];
      return rows;
    },

    toCanonical(raw: unknown): Product {
      const r = raw as OdataRow;
      const id = String(r.Ref_Key ?? r.Code ?? '');
      if (!id) throw new Error('1С: запись без Ref_Key');
      const title = String(r.Description ?? `Товар ${id}`).trim();

      // TODO(client): цена и остаток — отдельные регистры
      // (InformationRegister_ЦеныНоменклатуры, AccumulationRegister_ТоварыНаСкладах).
      const price = parsePrice((r as Record<string, unknown>).Цена ?? 0);

      return {
        id,
        slug: slugify(title, id),
        title,
        price,
        currency: 'RUB',
        availability: mapAvailability(undefined, undefined),
        categories: [], // TODO(client): группа номенклатуры (Parent_Key → Description)
        images: [],
        attributes: normalizeAttributes({}),
      };
    },
  };
}
