import type { SiteConfig } from '../../../site.config';
import type { SourceAdapter } from '../types/product';
import { DEFAULT_CSV_COLUMN_MAP, type CsvColumnMap } from '../types/catalog';
import { createApiAdapter } from './api';
import { createCsvAdapter } from './csv-adapter';
import { createDbAdapter } from './db-adapter';
import { createGoogleSheetsAdapter } from './gsheets-adapter';
import { resolveSourceUrl } from './utils';
import { createYmlAdapter } from './yml-adapter';

export function createAdapter(config: SiteConfig): SourceAdapter {
  const envSource = process.env.CATALOG_SOURCE?.trim() as SiteConfig['catalog']['source'] | undefined;
  const source = envSource ?? config.catalog.source;
  const sourceUrl = resolveSourceUrl(config.catalog.url);
  const columnMap: CsvColumnMap = config.catalog.columnMap ?? DEFAULT_CSV_COLUMN_MAP;

  switch (source) {
    case 'yml':
      return createYmlAdapter(sourceUrl);
    case 'csv':
      return createCsvAdapter(sourceUrl, columnMap);
    case 'gsheets':
      return createGoogleSheetsAdapter(sourceUrl, columnMap);
    case 'api':
      return createApiAdapter(config);
    case 'db':
      return createDbAdapter();
    default: {
      const _exhaustive: never = source;
      throw new Error(`Неизвестный источник каталога: ${_exhaustive}`);
    }
  }
}

export { DEFAULT_CSV_COLUMN_MAP as DEFAULT_COLUMN_MAP } from '../types/catalog';
export type { CsvColumnMap } from '../types/catalog';
export { createCsvAdapter } from './csv-adapter';
export { createGoogleSheetsAdapter } from './gsheets-adapter';
export { createYmlAdapter } from './yml-adapter';
export { normalizeAttributes, normalizeAttributeKey } from './normalize-attributes';
