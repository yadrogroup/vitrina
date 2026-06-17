import { parse } from 'csv-parse/sync';
import type { Product, SourceAdapter } from '../types/product';
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

import type { CsvColumnMap } from '../types/catalog';
import { DEFAULT_CSV_COLUMN_MAP } from '../types/catalog';

export interface CsvRow {
  [key: string]: string | undefined;
}

const DEFAULT_COLUMN_MAP = DEFAULT_CSV_COLUMN_MAP;

function rowToProduct(row: CsvRow, columnMap: CsvColumnMap): Product | null {
  const id = pickString(row[columnMap.id]);
  const title = pickString(row[columnMap.title]);
  const price = parsePrice(row[columnMap.price]);

  if (!id || !title || price <= 0) return null;

  const oldPriceRaw = columnMap.oldPrice ? parsePrice(row[columnMap.oldPrice]) : 0;
  const oldPrice = oldPriceRaw > price ? oldPriceRaw : undefined;
  const stock = columnMap.stock ? parseStock(row[columnMap.stock]) : undefined;

  const availability = columnMap.availability
    ? mapAvailability(row[columnMap.availability], stock)
    : mapAvailability(undefined, stock);

  const categoryCol = columnMap.categories ?? columnMap.category;
  const categories = categoryCol ? splitList(row[categoryCol]) : [];

  const images = columnMap.images ? splitList(row[columnMap.images]) : [];

  const mappedKeys = new Set(
    [
      columnMap.id,
      columnMap.title,
      columnMap.price,
      columnMap.oldPrice,
      columnMap.description,
      columnMap.category,
      columnMap.categories,
      columnMap.images,
      columnMap.stock,
      columnMap.availability,
    ].filter(Boolean) as string[],
  );

  const rawAttributes: Record<string, string> = {};
  const attributeColumns = columnMap.attributeColumns;

  for (const [key, value] of Object.entries(row)) {
    if (!value?.trim() || mappedKeys.has(key)) continue;
    if (attributeColumns && !attributeColumns.includes(key)) continue;
    rawAttributes[key] = value.trim();
  }

  return {
    id,
    slug: slugify(title, id),
    title,
    description: columnMap.description ? pickString(row[columnMap.description]) : undefined,
    price,
    oldPrice,
    currency: 'RUB',
    availability,
    stock,
    categories,
    images,
    attributes: normalizeAttributes(rawAttributes),
  };
}

function parseCsvContent(content: string): CsvRow[] {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as CsvRow[];

  return records;
}

export function createCsvAdapter(
  sourceUrl: string,
  columnMap: CsvColumnMap = DEFAULT_COLUMN_MAP,
): SourceAdapter {
  let rows: CsvRow[] = [];

  return {
    name: 'csv',
    capabilities: {
      stock: true,
      images: true,
      variants: false,
      attributes: true,
    },

    async fetch() {
      const content = await fetchSourceContent(sourceUrl);
      rows = parseCsvContent(content);
      return rows;
    },

    toCanonical(raw: unknown) {
      const row = raw as CsvRow;
      const product = rowToProduct(row, columnMap);
      if (!product) {
        throw new Error(`Невалидная строка CSV: ${JSON.stringify(row).slice(0, 120)}`);
      }
      return product;
    },
  };
}

export { DEFAULT_COLUMN_MAP };
