export interface CsvColumnMap {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  description?: string;
  category?: string;
  categories?: string;
  images?: string;
  stock?: string;
  availability?: string;
  attributeColumns?: string[];
}

export const DEFAULT_CSV_COLUMN_MAP: CsvColumnMap = {
  id: 'id',
  title: 'title',
  price: 'price',
  oldPrice: 'old_price',
  description: 'description',
  category: 'category',
  images: 'images',
  stock: 'stock',
  availability: 'availability',
};
