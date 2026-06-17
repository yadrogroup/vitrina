import siteConfig from '../../site.config';
import type { Availability, Product } from './types/product';

const SCHEMA_AVAILABILITY: Record<Availability, string> = {
  in_stock: 'https://schema.org/InStock',
  on_order: 'https://schema.org/PreOrder',
  out_of_stock: 'https://schema.org/OutOfStock',
  unknown: 'https://schema.org/LimitedAvailability',
};

export interface PageSeo {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: 'website' | 'product';
  ogImage?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function absoluteUrl(path: string): string {
  const base = siteConfig.url.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function productDescription(product: Product): string {
  return product.descriptionRich ?? product.description ?? siteConfig.tagline;
}

export function productSeoTitle(product: Product): string {
  return product.seo?.title ?? `${product.title} — ${siteConfig.name}`;
}

export function productSeoDescription(product: Product): string {
  return product.seo?.description ?? product.description ?? siteConfig.tagline;
}

export function splitRichText(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildProductSchema(product: Product): Record<string, unknown> {
  const description = productSeoDescription(product);
  const images = product.images.map((image) => absoluteUrl(image));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    image: images.length > 0 ? images : undefined,
    sku: product.id,
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${product.slug}/`),
      priceCurrency: product.currency,
      price: product.price,
      availability: SCHEMA_AVAILABILITY[product.availability],
    },
  };
}

export function buildProductPageSeo(product: Product): PageSeo {
  const canonicalUrl = absoluteUrl(`/product/${product.slug}/`);
  const ogImage = product.images[0] ? absoluteUrl(product.images[0]) : undefined;

  return {
    title: productSeoTitle(product),
    description: productSeoDescription(product),
    canonicalUrl,
    ogType: 'product',
    ogImage,
    jsonLd: buildProductSchema(product),
  };
}

export function buildSitePageSeo(
  title: string,
  description: string,
  path: string,
): PageSeo {
  return {
    title: `${title} — ${siteConfig.name}`,
    description,
    canonicalUrl: absoluteUrl(path),
    ogType: 'website',
  };
}

export function serializeJsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
