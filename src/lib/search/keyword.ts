import type { Product } from '../types/product';

export interface KeywordSearchHit {
  id: string;
  score: number;
}

const TITLE_WEIGHT = 10;
const CATEGORY_WEIGHT = 8;
const ATTRIBUTE_WEIGHT = 5;
const DESCRIPTION_WEIGHT = 3;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(query: string): string[] {
  return normalizeText(query)
    .split(' ')
    .filter((token) => token.length >= 2);
}

function productSearchText(product: Product): string {
  const attributeText = Object.entries(product.attributes ?? {})
    .map(([key, value]) => `${key} ${value}`)
    .join(' ');

  return normalizeText(
    [
      product.title,
      product.description,
      ...(product.categories ?? []),
      attributeText,
      product.seo?.title,
      product.seo?.description,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function scoreProduct(product: Product, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  const title = normalizeText(product.title);
  const description = normalizeText(product.description ?? '');
  const categories = (product.categories ?? []).map(normalizeText).join(' ');
  const attributes = Object.entries(product.attributes ?? {})
    .map(([key, value]) => normalizeText(`${key} ${value}`))
    .join(' ');
  const fullText = productSearchText(product);

  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += TITLE_WEIGHT;
    if (categories.includes(token)) score += CATEGORY_WEIGHT;
    if (attributes.includes(token)) score += ATTRIBUTE_WEIGHT;
    if (description.includes(token)) score += DESCRIPTION_WEIGHT;
    if (fullText.includes(token) && score === 0) score += 1;
  }

  const normalizedQuery = tokens.join(' ');
  if (title.includes(normalizedQuery)) score += TITLE_WEIGHT * 2;
  if (fullText.includes(normalizedQuery)) score += 2;

  return score;
}

export function rankProductsByKeyword(
  query: string,
  products: Product[],
  topK: number,
): KeywordSearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  return products
    .map((product) => ({ id: product.id, score: scoreProduct(product, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
