/** Словарь синонимов → канонические ключи атрибутов */
const ATTRIBUTE_SYNONYMS: Record<string, string[]> = {
  material: [
    'материал',
    'material',
    'материал каркаса',
    'материал обивки',
    'ткань',
    'обивка',
    'фасад',
  ],
  color: ['цвет', 'color', 'colour', 'оттенок'],
  width_cm: ['ширина', 'width', 'ширина см', 'ширина (см)'],
  height_cm: ['высота', 'height', 'высота см', 'высота (см)'],
  depth_cm: ['глубина', 'depth', 'длина', 'length', 'глубина см'],
  seats: ['мест', 'количество мест', 'seats', 'спальных мест'],
  weight_kg: ['вес', 'weight', 'масса'],
  style: ['стиль', 'style'],
  manufacturer: ['производитель', 'бренд', 'brand', 'manufacturer'],
};

const DIMENSION_KEYS = new Set(['width_cm', 'height_cm', 'depth_cm', 'weight_kg']);

/** Нормализованные названия цветов для фильтров */
const COLOR_ALIASES: Record<string, string> = {
  серый: 'серый',
  grey: 'серый',
  gray: 'серый',
  бежевый: 'бежевый',
  beige: 'бежевый',
  белый: 'белый',
  white: 'белый',
  чёрный: 'чёрный',
  черный: 'чёрный',
  black: 'чёрный',
  синий: 'синий',
  blue: 'синий',
  зелёный: 'зелёный',
  зеленый: 'зелёный',
  green: 'зелёный',
  коричневый: 'коричневый',
  brown: 'коричневый',
  натуральный: 'натуральный',
  natural: 'натуральный',
};

function slugifyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_|_$/g, '');
}

export function normalizeAttributeKey(raw: string): string {
  const lowered = raw.toLowerCase().trim();

  for (const [canonical, synonyms] of Object.entries(ATTRIBUTE_SYNONYMS)) {
    if (synonyms.some((syn) => lowered === syn || lowered.includes(syn))) {
      return canonical;
    }
  }

  return slugifyKey(raw);
}

function parseNumericValue(raw: string): number | null {
  const match = raw.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number.parseFloat(match[1]);
  return Number.isFinite(num) ? num : null;
}

function normalizeColorValue(value: string): string {
  const key = value.toLowerCase().trim();
  return COLOR_ALIASES[key] ?? value.trim();
}

export function normalizeAttributeValue(
  key: string,
  value: string | number,
): string | number {
  if (typeof value === 'number') return value;

  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (key === 'color') {
    return normalizeColorValue(trimmed);
  }

  if (DIMENSION_KEYS.has(key)) {
    const num = parseNumericValue(trimmed);
    if (num !== null) return num;
  }

  if (key === 'seats') {
    const num = parseNumericValue(trimmed);
    if (num !== null) return Math.round(num);
  }

  return trimmed;
}

/** Нормализует сырой набор param → attributes */
export function normalizeAttributes(
  raw: Record<string, string | number | undefined>,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    const key = normalizeAttributeKey(rawKey);
    const value =
      typeof rawValue === 'number'
        ? rawValue
        : normalizeAttributeValue(key, rawValue);

    if (result[key] === undefined) {
      result[key] = value;
    }
  }

  return result;
}
