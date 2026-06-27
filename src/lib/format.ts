import type { Availability, Product } from './types/product';
import { getCapabilities } from './catalog';

const ATTRIBUTE_LABELS: Record<string, string> = {
  material: 'Материал',
  color: 'Цвет',
  width_cm: 'Ширина, см',
  height_cm: 'Высота, см',
  depth_cm: 'Глубина, см',
  seats: 'Количество мест',
  weight_kg: 'Вес, кг',
  style: 'Стиль',
  manufacturer: 'Производитель',
  состав: 'Состав',
};

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function discountPercent(price: number, oldPrice?: number): number | null {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.round((1 - price / oldPrice) * 100);
}

export function attributeLabel(key: string): string {
  return ATTRIBUTE_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function formatAttributeValue(value: string | number): string {
  return typeof value === 'number' ? String(value) : value;
}

export interface AvailabilityInfo {
  label: string;
  tone: 'success' | 'muted' | 'danger' | 'warning';
}

export function getAvailabilityInfo(product: Product): AvailabilityInfo {
  const hasStock = getCapabilities().stock;

  if (!hasStock || product.availability === 'unknown') {
    return { label: 'Уточняйте наличие', tone: 'muted' };
  }

  const labels: Record<Availability, AvailabilityInfo> = {
    in_stock: { label: 'В наличии', tone: 'success' },
    on_order: { label: 'Под заказ', tone: 'warning' },
    out_of_stock: { label: 'Нет в наличии', tone: 'danger' },
    unknown: { label: 'Уточняйте наличие', tone: 'muted' },
  };

  return labels[product.availability];
}

export function productImageAlt(product: Product, index = 0): string {
  const suffix = index > 0 ? ` — фото ${index + 1}` : '';
  return `${product.title}${suffix}`;
}
