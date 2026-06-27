import { attributeLabel } from './format';
import type { Product, Variant } from './types/product';

/** Порядок осей на PDP: ткань → цвет → размер → остальное */
const AXIS_PRIORITY = ['material', 'color', 'width_cm', 'height_cm', 'depth_cm', 'style'];

/** Цвета для свотчей (lowercase ключ) */
export const COLOR_HEX: Record<string, string> = {
  бежевый: '#D4C4A8',
  серый: '#9E9E9E',
  синий: '#4A6FA5',
  графит: '#4A4A4A',
  молочный: '#F5F0E8',
  чёрный: '#1F1D1A',
  черный: '#1F1D1A',
  орех: '#8B5A2B',
  натуральный: '#C4A574',
  коричневый: '#7B5E3A',
  белый: '#F5F5F5',
  'белый глянец': '#F5F5F5',
  'белый мат': '#ECECEC',
  'дуб светлый': '#C9A86C',
  узор: '#B8A088',
  терракота: '#C4704A',
};

export interface VariantAxis {
  key: string;
  label: string;
  values: string[];
  isColor: boolean;
}

export interface VariantConfig {
  axes: VariantAxis[];
  colorImage: Record<string, string>;
  defaultSelection: Record<string, string>;
  variants: Variant[];
  basePrice: number;
}

function normalizeValue(value: string | number | undefined): string {
  if (value === undefined) return '';
  return String(value).trim();
}

function compareAxisKeys(a: string, b: string): number {
  const ia = AXIS_PRIORITY.indexOf(a);
  const ib = AXIS_PRIORITY.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b, 'ru');
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function collectAxisValues(variants: Variant[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const variant of variants) {
    if (!variant.attributes) continue;
    for (const [key, value] of Object.entries(variant.attributes)) {
      const normalized = normalizeValue(value);
      if (!normalized) continue;
      const set = map.get(key) ?? new Set<string>();
      set.add(normalized);
      map.set(key, set);
    }
  }

  return map;
}

function buildColorImageMap(variants: Variant[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (const variant of variants) {
    const color = normalizeValue(variant.attributes?.color);
    if (!color || !variant.image || map[color]) continue;
    map[color] = variant.image;
  }

  return map;
}

function buildDefaultSelection(variants: Variant[], axes: VariantAxis[]): Record<string, string> {
  const first = variants[0];
  const selection: Record<string, string> = {};

  for (const axis of axes) {
    const fromFirst = normalizeValue(first.attributes?.[axis.key]);
    selection[axis.key] = fromFirst || axis.values[0] || '';
  }

  return selection;
}

export function deriveVariantAxes(product: Product): VariantConfig | null {
  const variants = product.variants;
  if (!variants || variants.length <= 1) return null;

  const valueMap = collectAxisValues(variants);
  const axisKeys = [...valueMap.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([key]) => key)
    .sort(compareAxisKeys);

  if (axisKeys.length === 0) return null;

  const axes: VariantAxis[] = axisKeys.map((key) => {
    const values = [...(valueMap.get(key) ?? [])].sort((a, b) =>
      a.localeCompare(b, 'ru', { numeric: true }),
    );
    return {
      key,
      label: attributeLabel(key),
      values,
      isColor: key === 'color',
    };
  });

  return {
    axes,
    colorImage: buildColorImageMap(variants),
    defaultSelection: buildDefaultSelection(variants, axes),
    variants,
    basePrice: product.price,
  };
}

function variantMatches(variant: Variant, selection: Record<string, string>): boolean {
  if (!variant.attributes) return false;

  for (const [key, value] of Object.entries(selection)) {
    if (!value) continue;
    const variantValue = normalizeValue(variant.attributes[key]);
    if (variantValue !== value) return false;
  }

  return true;
}

function scoreVariant(variant: Variant, selection: Record<string, string>): number {
  if (!variant.attributes) return 0;
  let score = 0;

  for (const [key, value] of Object.entries(selection)) {
    if (!value) continue;
    const variantValue = normalizeValue(variant.attributes[key]);
    if (variantValue === value) score += 1;
  }

  return score;
}

/** Находит вариант по текущему выбору; при неполном совпадении — ближайший */
export function resolveVariant(
  variants: Variant[],
  selection: Record<string, string>,
): Variant {
  const exact = variants.find((v) => variantMatches(v, selection));
  if (exact) return exact;

  let best = variants[0];
  let bestScore = -1;

  for (const variant of variants) {
    const score = scoreVariant(variant, selection);
    if (score > bestScore) {
      bestScore = score;
      best = variant;
    }
  }

  return best;
}

export function selectionFromVariant(variant: Variant, axes: VariantAxis[]): Record<string, string> {
  const selection: Record<string, string> = {};

  for (const axis of axes) {
    selection[axis.key] = normalizeValue(variant.attributes?.[axis.key]) || axis.values[0] || '';
  }

  return selection;
}

export function getColorHex(value: string): string | undefined {
  return COLOR_HEX[value.toLowerCase()];
}

export function formatVariantLabel(variant: Variant, axes: VariantAxis[]): string {
  return axes
    .map((axis) => normalizeValue(variant.attributes?.[axis.key]))
    .filter(Boolean)
    .join(', ');
}
