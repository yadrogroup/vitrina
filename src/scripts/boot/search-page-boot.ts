import { readPageData } from '../../lib/page-data';
import type { Product } from '../../lib/types/product';
import { initSearchPage } from '../search-ui';

export function bootSearchPage(): void {
  const products = readPageData<Product[]>('[data-page-data="search-page"]');
  void initSearchPage(products);
}
