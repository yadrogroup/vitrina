import { EMBEDDINGS_URL, PHOTO_SEARCH_API_URL, SEARCH_TOP_K } from '../lib/search/config';
import siteConfig from '../../site.config';
import { rankProductsByKeyword } from '../lib/search/keyword';
import { formatPrice, productImageAlt } from '../lib/format';
import { rankEmbeddings } from '../lib/search/math';
import type { EmbeddingsFile, PhotoSearchPayload, RankedProduct } from '../lib/search/types';
import { PHOTO_SEARCH_STORAGE_KEY } from '../lib/search/types';
import type { Product } from '../lib/types/product';

interface SearchProduct extends Product {
  score?: number;
}

const PHOTO_PREVIEW_MAX = 480;
const PHOTO_PREVIEW_JPEG_QUALITY = 0.85;
const PHOTO_SEARCH_REMOTE_TIMEOUT_MS = 60_000;
const PHOTO_SEARCH_UNAVAILABLE = 'Сервис поиска временно недоступен';

const photoSearchEndpoint = siteConfig.photoSearchApiUrl ?? PHOTO_SEARCH_API_URL;

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

export function refinePhotoResults(products: SearchProduct[], topK: number): SearchProduct[] {
  if (products.length === 0) return products;

  const topScore = products[0].score ?? 0;
  const minScore = Math.max(0.12, topScore - 0.08);
  const topCategory = products[0].categories?.[0];

  return products
    .filter((product) => (product.score ?? 0) >= minScore)
    .sort((a, b) => {
      const aBoost = topCategory && a.categories?.includes(topCategory) ? 0.03 : 0;
      const bBoost = topCategory && b.categories?.includes(topCategory) ? 0.03 : 0;
      return (b.score! + bBoost) - (a.score! + aBoost);
    })
    .slice(0, topK);
}

async function resizeFileToJpegBlob(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_PREVIEW_MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Не удалось подготовить фото');
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', PHOTO_PREVIEW_JPEG_QUALITY),
  );
  if (!blob) {
    throw new Error('Не удалось подготовить фото');
  }
  return blob;
}

async function createPreviewDataUrl(file: Blob): Promise<string> {
  if (typeof createImageBitmap === 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать фото'));
      reader.readAsDataURL(file);
    });
  }

  const jpegBlob = await resizeFileToJpegBlob(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать фото'));
    reader.readAsDataURL(jpegBlob);
  });
}

async function embedImageRemote(
  file: Blob,
  onProgress?: (message: string) => void,
): Promise<number[]> {
  onProgress?.('Анализирую фото…');
  const jpegBlob = await resizeFileToJpegBlob(file);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PHOTO_SEARCH_REMOTE_TIMEOUT_MS);

  try {
    const response = await fetch(photoSearchEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: jpegBlob,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(PHOTO_SEARCH_UNAVAILABLE);
    }

    const payload = (await response.json()) as { ok?: boolean; vector?: number[] };
    if (!payload.ok || !Array.isArray(payload.vector)) {
      throw new Error(PHOTO_SEARCH_UNAVAILABLE);
    }

    return payload.vector;
  } catch (error) {
    if (error instanceof Error && error.message === PHOTO_SEARCH_UNAVAILABLE) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(PHOTO_SEARCH_UNAVAILABLE);
    }
    throw new Error(PHOTO_SEARCH_UNAVAILABLE);
  } finally {
    clearTimeout(timeout);
  }
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

export function searchByText(query: string, products: Product[]): SearchProduct[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const ranked = rankProductsByKeyword(trimmed, products, SEARCH_TOP_K);
  return mapRankedProducts(products, ranked);
}

export async function searchByPhoto(
  file: Blob,
  products: Product[],
  onProgress?: (message: string) => void,
): Promise<{ previewUrl: string; results: SearchProduct[] }> {
  const embeddings = await loadEmbeddings();
  const vector = await embedImageRemote(file, onProgress);
  const ranked = rankEmbeddings(vector, embeddings.items, SEARCH_TOP_K * 2);
  const previewUrl = await createPreviewDataUrl(file);
  const mapped = mapRankedProducts(products, ranked);

  return {
    previewUrl,
    results: refinePhotoResults(mapped, SEARCH_TOP_K),
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

  const results = searchByText(query, products);
  setSearchStatus(statusEl, '');
  renderSearchGrid(
    gridEl,
    results,
    'Ничего не найдено. Попробуйте другой запрос или загрузите фото.',
  );
}

export function initPhotoDropzone(products: Product[]): void {
  const root = document.querySelector<HTMLElement>('[data-photo-dropzone]');
  if (!root) return;

  const input = root.querySelector<HTMLInputElement>('[data-photo-input]');
  const upload = root.querySelector<HTMLElement>('[data-photo-upload]');
  const statusEl = root.querySelector<HTMLElement>('[data-photo-status]');

  if (!input || !upload) return;

  const setBusy = (busy: boolean): void => {
    input.disabled = busy;
    upload.setAttribute('aria-disabled', busy ? 'true' : 'false');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSearchStatus(statusEl, 'Выберите файл изображения (JPG, PNG, WebP).');
      return;
    }

    setBusy(true);
    setSearchStatus(statusEl, 'Анализирую фото…');

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
      setBusy(false);
    }
  };

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    void handleFile(file);
  });

  root.addEventListener('dragover', (event) => {
    event.preventDefault();
    root.classList.add('is-dragover');
  });

  root.addEventListener('dragleave', () => root.classList.remove('is-dragover'));

  root.addEventListener('drop', (event) => {
    event.preventDefault();
    root.classList.remove('is-dragover');
    void handleFile(event.dataTransfer?.files?.[0]);
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
