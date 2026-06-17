import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Availability } from '../types/product';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

export function resolveSourceUrl(url: string): string {
  const envUrl = process.env.CATALOG_URL?.trim();
  return envUrl || url;
}

/** Загружает источник: HTTP(S) или локальный путь от корня проекта */
export async function fetchSourceContent(source: string): Promise<string> {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error('URL источника каталога не задан (site.config.ts или CATALOG_URL)');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить источник (${response.status}): ${trimmed}`);
    }
    return response.text();
  }

  const filePath = path.isAbsolute(trimmed)
    ? trimmed
    : path.join(PROJECT_ROOT, trimmed);

  return readFile(filePath, 'utf-8');
}

export function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  const safeId = String(id).replace(/[^\p{L}\p{N}]+/gu, '-');
  return base ? `${base}-${safeId}` : safeId;
}

export function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return 0;

  const num = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(num) ? Math.round(num) : 0;
}

export function parseStock(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(num) ? num : undefined;
}

export function mapAvailability(
  available: unknown,
  stock?: number,
): Availability {
  if (stock !== undefined) {
    if (stock > 0) return 'in_stock';
    return 'out_of_stock';
  }

  if (available === true || available === 'true' || available === '1') {
    return 'in_stock';
  }
  if (available === false || available === 'false' || available === '0') {
    return 'out_of_stock';
  }
  if (typeof available === 'string') {
    const v = available.toLowerCase();
    if (v.includes('налич')) return 'in_stock';
    if (v.includes('заказ')) return 'on_order';
    if (v.includes('нет') || v.includes('out')) return 'out_of_stock';
  }

  return 'unknown';
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pickString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str || undefined;
}

export function getProjectRoot(): string {
  return PROJECT_ROOT;
}
