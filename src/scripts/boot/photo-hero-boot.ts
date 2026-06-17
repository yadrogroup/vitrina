import { readPageData } from '../../lib/page-data';
import type { Product } from '../../lib/types/product';
import { initPhotoDropzone } from '../search-ui';

export function bootPhotoHero(): void {
  const products = readPageData<Product[]>('[data-page-data="photo-hero"]');
  initPhotoDropzone(products);
}
