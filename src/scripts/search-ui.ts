import { SEARCH_TOP_K, EMBEDDINGS_URL } from '../lib/search/config';
import { formatPrice, productImageAlt } from '../lib/format';
import { rankEmbeddings } from '../lib/search/math';
import type { EmbeddingsFile, PhotoSearchPayload, RankedProduct } from '../lib/search/types';
import { PHOTO_SEARCH_STORAGE_KEY } from '../lib/search/types';
import type { Product } from '../lib/types/product';
import { embedImageBlob, embedTextQuery } from './clip-client';

interface SearchProduct extends Product {
  score?: number;
}

let embeddingsCache: EmbeddingsFile | null = null;

export async function loadEmbeddings(): Promise<EmbeddingsFile> {
  if (embeddingsCache) return embeddingsCache;

  const response = await fetch(EMBEDDINGS_URL);
  if (!response.ok) {
    throw new Error('Файл embeddings.json не найден. Запустите npm run embed.');
  }

  embeddingsCache = (await response.json()) as EmbeddingsFile;
  return embeddingsCache;
}

export function mapRankedProducts(
  products: Product[],
  ranked: RankedProduct[],
): SearchProduct[] {
  const byId = new Map(products.map((product) => [product.id, product]));

  return ranked
    .map(({ id, score }) => {
      const product = byId.get(id);
      return product ? { ...product, score } : null;
    })
    .filter((product): product is SearchProduct => product !== null);
}

export async function searchByText(
  query: string,
  products: Product[],
  onProgress?: (message: string) => void,
): Promise<SearchProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const embeddings = await loadEmbeddings();
  const vector = await embedTextQuery(trimmed, onProgress);
  const ranked = rankEmbeddings(vector, embeddings.items, SEARCH_TOP_K);
  return mapRankedProducts(products, ranked);
}

export async function searchByPhoto(
  file: Blob,
  products: Product[],
  onProgress?: (message: string) => void,
): Promise<{ previewUrl: string; results: SearchProduct[] }> {
  const embeddings = await loadEmbeddings();
  const vector = await embedImageBlob(file, onProgress);
  const ranked = rankEmbeddings(vector, embeddings.items, SEARCH_TOP_K);
  const previewUrl = URL.createObjectURL(file);

  return {
    previewUrl,
    results: mapRankedProducts(products, ranked),
  };
}

export function savePhotoSearchPayload(payload: PhotoSearchPayload): void {
  sessionStorage.setItem(PHOTO_SEARCH_STORAGE_KEY, JSON.stringify(payload));
}

export function readPhotoSearchPayload(): PhotoSearchPayload | null {
  const raw = sessionStorage.getItem(PHOTO_SEARCH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PhotoSearchPayload;
  } catch {
    return null;
  }
}

export function clearPhotoSearchPayload(): void {
  sessionStorage.removeItem(PHOTO_SEARCH_STORAGE_KEY);
}

export function renderSearchGrid(
  container: HTMLElement,
  products: SearchProduct[],
  emptyMessage: string,
): void {
  if (products.length === 0) {
    container.innerHTML = `<p class="search-empty text-muted">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = products.map((product) => renderProductCard(product)).join('');

  container.querySelectorAll('[data-add-to-cart]').forEach((button) => {
    button.addEventListener('click', () => {
      import('./cart-store').then(({ addToCart }) => {
        const el = button as HTMLElement;
        addToCart({
          productId: el.dataset.productId!,
          slug: el.dataset.slug!,
          title: el.dataset.title!,
          price: Number(el.dataset.price),
          image: el.dataset.image || undefined,
        });
      });
    });
  });
}

function renderProductCard(product: SearchProduct): string {
  const image = product.images[0];

  return `
    <article class="product-card search-card">
      <a href="/product/${product.slug}/" class="product-card__media">
        ${
          image
            ? `<img class="product-card__img product-card__img--main" src="${image}" alt="${escapeHtml(productImageAlt(product))}" width="320" height="240" loading="lazy" />`
            : `<div class="product-card__placeholder"><span class="text-muted">Нет фото</span></div>`
        }
      </a>
      <div class="product-card__body">
        <h3 class="product-card__title"><a href="/product/${product.slug}/">${escapeHtml(product.title)}</a></h3>
        <p class="price-block__current price">${formatPrice(product.price)}</p>
        <button type="button" class="btn btn--primary btn--sm product-card__add" data-add-to-cart
          data-product-id="${product.id}" data-slug="${product.slug}" data-title="${escapeHtml(product.title)}"
          data-price="${product.price}" data-image="${image ?? ''}">В корзину</button>
      </div>
    </article>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function setSearchStatus(element: HTMLElement | null, message: string): void {
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
}

export async function initSearchPage(products: Product[]): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const query = params.get('q') ?? '';
  const statusEl = document.querySelector<HTMLElement>('[data-search-status]');
  const gridEl = document.querySelector<HTMLElement>('[data-search-grid]');
  const previewEl = document.querySelector<HTMLElement>('[data-search-preview]');
  const titleEl = document.querySelector<HTMLElement>('[data-search-title]');

  if (!gridEl) return;

  if (mode === 'photo') {
    const payload = readPhotoSearchPayload();
    if (!payload) {
      setSearchStatus(statusEl, 'Загрузите фото для поиска.');
      renderSearchGrid(gridEl, [], 'Нет результатов.');
      return;
    }

    if (titleEl) titleEl.textContent = 'Похожие по фото';
    if (previewEl) {
      previewEl.innerHTML = `<img src="${payload.previewUrl}" alt="Загруженное фото" class="search-preview__image" />`;
      previewEl.hidden = false;
    }

    const results = mapRankedProducts(products, payload.ranked);
    renderSearchGrid(gridEl, results, 'Похожих товаров не найдено.');
    return;
  }

  if (previewEl) previewEl.hidden = true;
  if (!query.trim()) {
    if (titleEl) titleEl.textContent = 'Поиск';
    setSearchStatus(statusEl, 'Введите запрос в строке поиска.');
    renderSearchGrid(gridEl, [], 'Нет результатов.');
    return;
  }

  if (titleEl) titleEl.textContent = `Результаты: «${query}»`;

  try {
    setSearchStatus(statusEl, 'Загрузка модели…');
    const results = await searchByText(query, products, (message) => setSearchStatus(statusEl, message));
    setSearchStatus(statusEl, '');
    renderSearchGrid(
      gridEl,
      results,
      'Ничего не найдено. Попробуйте другой запрос или загрузите фото.',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка поиска';
    setSearchStatus(statusEl, message);
    renderSearchGrid(gridEl, [], 'Поиск недоступен.');
  }
}

export function initPhotoDropzone(products: Product[]): void {
  const root = document.querySelector<HTMLElement>('[data-photo-dropzone]');
  const input = document.querySelector<HTMLInputElement>('[data-photo-input]');
  const statusEl = document.querySelector<HTMLElement>('[data-photo-status]');
  const button = document.querySelector<HTMLButtonElement>('[data-photo-button]');

  if (!root || !input || !button) return;

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) {
      setSearchStatus(statusEl, 'Выберите файл изображения (JPG, PNG, WebP).');
      return;
    }

    button.disabled = true;
    setSearchStatus(statusEl, 'Загрузка модели…');

    try {
      const { previewUrl, results } = await searchByPhoto(file, products, (message) =>
        setSearchStatus(statusEl, message),
      );

      savePhotoSearchPayload({
        previewUrl,
        ranked: results.map((product) => ({
          id: product.id,
          score: product.score ?? 0,
        })),
      });

      window.location.href = '/search/?mode=photo';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось обработать фото';
      setSearchStatus(statusEl, message);
      button.disabled = false;
    }
  };

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => handleFile(input.files?.[0]));

  root.addEventListener('dragover', (event) => {
    event.preventDefault();
    root.classList.add('is-dragover');
  });

  root.addEventListener('dragleave', () => root.classList.remove('is-dragover'));

  root.addEventListener('drop', (event) => {
    event.preventDefault();
    root.classList.remove('is-dragover');
    handleFile(event.dataTransfer?.files?.[0]);
  });
}

export function initHeaderSearch(): void {
  const form = document.querySelector<HTMLFormElement>('[data-header-search]');
  form?.addEventListener('submit', (event) => {
    const input = form.querySelector<HTMLInputElement>('input[name="q"]');
    if (!input?.value.trim()) {
      event.preventDefault();
    }
  });
}
