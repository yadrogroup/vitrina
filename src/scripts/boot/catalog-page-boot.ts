import { readPageData } from '../../lib/page-data';
import type { FilterFacet } from '../../lib/filters';
import { initCatalogPage } from '../catalog-page';

export function bootCatalogPage(): void {
  const facets = readPageData<FilterFacet[]>('[data-page-data="catalog-page"]');
  initCatalogPage({ facets });
}
