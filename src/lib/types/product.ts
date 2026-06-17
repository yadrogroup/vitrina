export type Availability = 'in_stock' | 'on_order' | 'out_of_stock' | 'unknown';

export interface Variant {
  id: string;
  label: string;
  attributes?: Record<string, string>;
  image?: string;
  price?: number;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description?: string;
  descriptionRich?: string;
  seo?: { title?: string; description?: string };
  price: number;
  oldPrice?: number;
  currency: 'RUB';
  availability: Availability;
  stock?: number;
  categories: string[];
  images: string[];
  attributes: Record<string, string | number>;
  variants?: Variant[];
  embedding?: number[];
  models3d?: { glb?: string; usdz?: string };
  showrooms?: string[];
}

export interface AdapterCapabilities {
  stock: boolean;
  images: boolean;
  variants: boolean;
  attributes: boolean;
}

export interface SourceAdapter {
  name: 'yml' | 'csv' | 'gsheets';
  capabilities: AdapterCapabilities;
  fetch(): Promise<unknown[]>;
  toCanonical(raw: unknown): Product;
}

export interface CatalogMeta {
  tenant: string;
  updatedAt: string;
  source: 'yml' | 'csv' | 'gsheets';
  capabilities: AdapterCapabilities;
  productCount: number;
  warnings: string[];
}

export interface Catalog {
  products: Product[];
  meta: CatalogMeta;
}
