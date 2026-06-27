import { readPageData } from '../../lib/page-data';
import type { Product } from '../../lib/types/product';
import { initPhotoDropzone } from '../search-ui';

export function bootPhotoHero(): void {
  let products: Product[] = [];
  try {
    products = readPageData<Product[]>('[data-page-data="photo-hero"]');
  } catch (error) {
    console.error('photo-hero data error', error);
  }
  initPhotoDropzone(products);
}
