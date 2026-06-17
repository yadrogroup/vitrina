import { XMLParser } from 'fast-xml-parser';
import type { Product, SourceAdapter, Variant } from '../types/product';
import { normalizeAttributes } from './normalize-attributes';
import {
  fetchSourceContent,
  mapAvailability,
  parsePrice,
  parseStock,
  pickString,
  slugify,
  splitList,
} from './utils';

interface YmlParam {
  '@_name'?: string;
  '#text'?: string | number;
}

interface YmlOffer {
  '@_id'?: string | number;
  '@_available'?: string | boolean;
  '@_group_id'?: string | number;
  name?: string;
  model?: string;
  vendor?: string;
  price?: string | number;
  oldprice?: string | number;
  currencyId?: string;
  categoryId?: string | number | Array<string | number>;
  picture?: string | string[];
  description?: string;
  count?: string | number;
  param?: YmlParam | YmlParam[];
  url?: string;
}

export interface YmlProductGroup {
  type: 'single' | 'group';
  offers: YmlOffer[];
  groupId?: string;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function extractParams(offer: YmlOffer): Record<string, string> {
  const params: Record<string, string> = {};

  for (const param of asArray(offer.param)) {
    const name = param['@_name'];
    const text = param['#text'];
    if (!name || text === undefined) continue;
    params[String(name)] = String(text);
  }

  return params;
}

function extractImages(offer: YmlOffer): string[] {
  return splitList(offer.picture);
}

function extractCategories(offer: YmlOffer, categoryMap: Map<string, string>): string[] {
  return asArray(offer.categoryId)
    .map(String)
    .filter(Boolean)
    .map((id) => categoryMap.get(id) ?? id);
}

function buildVariantLabel(params: Record<string, string>, offer: YmlOffer): string {
  const normalized = normalizeAttributes(params);
  const color = normalized.color;
  const material = normalized.material;

  if (typeof color === 'string' && typeof material === 'string') {
    return `${material}, ${color}`;
  }
  if (typeof color === 'string') return color;
  if (typeof material === 'string') return material;

  return pickString(offer.name) ?? String(offer['@_id'] ?? 'variant');
}

function offerToVariant(offer: YmlOffer, basePrice: number): Variant {
  const params = extractParams(offer);
  const price = parsePrice(offer.price);
  const variant: Variant = {
    id: String(offer['@_id'] ?? ''),
    label: buildVariantLabel(params, offer),
  };

  const attrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(normalizeAttributes(params))) {
    attrs[key] = String(value);
  }
  if (Object.keys(attrs).length > 0) variant.attributes = attrs;

  const image = extractImages(offer)[0];
  if (image) variant.image = image;
  if (price && price !== basePrice) variant.price = price;

  return variant;
}

function groupToProduct(group: YmlProductGroup, categoryMap: Map<string, string>): Product | null {
  if (group.offers.length === 0) return null;

  const primary = group.offers[0];
  const id =
    group.type === 'group' && group.groupId
      ? `group-${group.groupId}`
      : String(primary['@_id'] ?? '');

  const title = pickString(primary.name) ?? pickString(primary.model) ?? `Товар ${id}`;
  const price = parsePrice(primary.price);
  const oldPriceRaw = parsePrice(primary.oldprice);
  const oldPrice = oldPriceRaw > price ? oldPriceRaw : undefined;

  const allParams: Record<string, string> = {};
  for (const offer of group.offers) {
    Object.assign(allParams, extractParams(offer));
  }

  const stockValues = group.offers
    .map((o) => parseStock(o.count))
    .filter((v): v is number => v !== undefined);
  const stock = stockValues.length > 0 ? Math.max(...stockValues) : undefined;

  const availability = mapAvailability(primary['@_available'], stock);

  const product: Product = {
    id,
    slug: slugify(title, id),
    title,
    description: pickString(primary.description),
    price,
    oldPrice,
    currency: 'RUB',
    availability,
    stock,
    categories: extractCategories(primary, categoryMap),
    images: [...new Set(group.offers.flatMap(extractImages))],
    attributes: normalizeAttributes(allParams),
  };

  if (group.type === 'group' && group.offers.length > 1) {
    product.variants = group.offers.map((offer) => offerToVariant(offer, price));
  }

  return product;
}

interface YmlCategory {
  '@_id'?: string | number;
  '#text'?: string;
}

function parseCategoryMap(doc: {
  yml_catalog?: { shop?: { categories?: { category?: YmlCategory | YmlCategory[] } } };
}): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of asArray(doc.yml_catalog?.shop?.categories?.category)) {
    const id = cat['@_id'];
    if (id === undefined || id === null) continue;
    const label = pickString(cat['#text']) ?? String(id);
    map.set(String(id), label);
  }
  return map;
}

function parseOffers(xml: string): { groups: YmlProductGroup[]; categoryMap: Map<string, string> } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    isArray: (name) =>
      name === 'offer' || name === 'param' || name === 'picture' || name === 'category',
  });

  const doc = parser.parse(xml) as {
    yml_catalog?: {
      shop?: {
        categories?: { category?: YmlCategory | YmlCategory[] };
        offers?: { offer?: YmlOffer | YmlOffer[] };
      };
    };
  };

  const categoryMap = parseCategoryMap(doc);
  const offers = asArray(doc.yml_catalog?.shop?.offers?.offer);
  const groups = new Map<string, YmlOffer[]>();
  const singles: YmlOffer[] = [];

  for (const offer of offers) {
    const groupId = offer['@_group_id'];
    if (groupId !== undefined && groupId !== null && String(groupId) !== '') {
      const key = String(groupId);
      const list = groups.get(key) ?? [];
      list.push(offer);
      groups.set(key, list);
    } else {
      singles.push(offer);
    }
  }

  const result: YmlProductGroup[] = singles.map((offer) => ({
    type: 'single',
    offers: [offer],
  }));

  for (const [groupId, groupOffers] of groups) {
    result.push({ type: 'group', groupId, offers: groupOffers });
  }

  return { groups: result, categoryMap };
}

export function createYmlAdapter(sourceUrl: string): SourceAdapter {
  let groups: YmlProductGroup[] = [];
  let categoryMap = new Map<string, string>();

  return {
    name: 'yml',
    capabilities: {
      stock: true,
      images: true,
      variants: true,
      attributes: true,
    },

    async fetch() {
      const xml = await fetchSourceContent(sourceUrl);
      const parsed = parseOffers(xml);
      groups = parsed.groups;
      categoryMap = parsed.categoryMap;
      return groups;
    },

    toCanonical(raw: unknown) {
      const group = raw as YmlProductGroup;
      const product = groupToProduct(group, categoryMap);
      if (!product) {
        throw new Error('Пустая группа офферов YML');
      }
      return product;
    },
  };
}
