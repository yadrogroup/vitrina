import type { SourceAdapter } from '../types/product';
import type { CsvColumnMap } from '../types/catalog';
import { createCsvAdapter } from './csv-adapter';

/** Преобразует URL или ID Google Sheets в CSV-export URL */
export function toGoogleSheetsCsvUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.includes('docs.google.com/spreadsheets')) {
    const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
    if (!idMatch) throw new Error('Не удалось извлечь ID из URL Google Sheets');

    const sheetId = idMatch[1];
    const gid = gidMatch?.[1] ?? '0';
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=csv&gid=0`;
  }

  return trimmed;
}

export function createGoogleSheetsAdapter(
  sourceUrl: string,
  columnMap?: CsvColumnMap,
): SourceAdapter {
  const csvUrl = toGoogleSheetsCsvUrl(sourceUrl);
  const adapter = createCsvAdapter(csvUrl, columnMap);

  return {
    ...adapter,
    name: 'gsheets',
    capabilities: {
      stock: true,
      images: true,
      variants: false,
      attributes: true,
    },
  };
}
