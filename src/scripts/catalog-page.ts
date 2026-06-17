import type { ActiveFilters, FilterFacet, SortOption } from '../lib/filters';

interface CatalogPageData {
  facets: FilterFacet[];
}

const MOBILE_MQ = '(max-width: 768px)';

function isMobileFilters(): boolean {
  return window.matchMedia(MOBILE_MQ).matches;
}

function parseActiveFilters(form: HTMLFormElement): ActiveFilters {
  const data = new FormData(form);
  const active: ActiveFilters = { attributes: {}, attrRanges: {} };

  const category = data.getAll('category').map(String).filter(Boolean);
  if (category.length) active.category = category;

  const priceMin = data.get('price_min');
  const priceMax = data.get('price_max');
  if (priceMin) active.priceMin = Number(priceMin);
  if (priceMax) active.priceMax = Number(priceMax);

  for (const [key, value] of data.entries()) {
    if (!value || key === 'sort') continue;

    if (key.startsWith('attr_')) {
      const attrKey = key.slice(5);
      if (!active.attributes[attrKey]) active.attributes[attrKey] = [];
      active.attributes[attrKey].push(String(value));
      continue;
    }

    if (key.endsWith('_min') && key !== 'price_min') {
      const attrKey = key.slice(0, -4);
      active.attrRanges[attrKey] ??= {};
      active.attrRanges[attrKey].min = Number(value);
      continue;
    }

    if (key.endsWith('_max') && key !== 'price_max') {
      const attrKey = key.slice(0, -4);
      active.attrRanges[attrKey] ??= {};
      active.attrRanges[attrKey].max = Number(value);
    }
  }

  return active;
}

function matchesFilters(card: HTMLElement, active: ActiveFilters): boolean {
  const price = Number(card.dataset.price);
  if (active.priceMin !== undefined && price < active.priceMin) return false;
  if (active.priceMax !== undefined && price > active.priceMax) return false;

  if (active.category?.length) {
    const cats = (card.dataset.category ?? '').split('|');
    if (!active.category.some((c) => cats.includes(c))) return false;
  }

  for (const [key, values] of Object.entries(active.attributes)) {
    if (!values.length) continue;
    const cardValue = card.dataset[`attr_${key}`];
    if (!cardValue || !values.includes(cardValue)) return false;
  }

  for (const [key, range] of Object.entries(active.attrRanges)) {
    const cardValue = Number(card.dataset[`attr_${key}`]);
    if (!Number.isFinite(cardValue)) return false;
    if (range.min !== undefined && cardValue < range.min) return false;
    if (range.max !== undefined && cardValue > range.max) return false;
  }

  return true;
}

function getSortValue(card: HTMLElement, sort: SortOption): string | number {
  switch (sort) {
    case 'price_asc':
    case 'price_desc':
      return Number(card.dataset.price);
    case 'title_asc':
    case 'title_desc':
      return card.dataset.title ?? '';
    default:
      return Number(card.dataset.index ?? 0);
  }
}

function sortCards(cards: HTMLElement[], sort: SortOption): HTMLElement[] {
  const sorted = [...cards];
  const dir = sort.endsWith('_desc') ? -1 : 1;

  sorted.sort((a, b) => {
    const av = getSortValue(a, sort);
    const bv = getSortValue(b, sort);
    let cmp = 0;

    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), 'ru');
    }

    if (cmp !== 0) return cmp * dir;

    const ai = Number(a.dataset.index ?? 0);
    const bi = Number(b.dataset.index ?? 0);
    return ai - bi;
  });

  return sorted;
}

function renderChips(form: HTMLFormElement, chipsRoot: HTMLElement): void {
  chipsRoot.innerHTML = '';
  const data = new FormData(form);

  for (const [key, value] of data.entries()) {
    if (!value || key === 'sort') continue;
    if (key.endsWith('_min') || key.endsWith('_max')) {
      const label = key.includes('price') ? `Цена: ${value}` : `${key}: ${value}`;
      chipsRoot.appendChild(createChip(label, () => {
        const input = form.querySelector<HTMLInputElement>(`[name="${key}"]`);
        if (input) input.value = '';
        applyFilters(form);
      }));
      continue;
    }

    const label = key.startsWith('attr_')
      ? `${key.slice(5)}: ${value}`
      : `${key}: ${value}`;

    chipsRoot.appendChild(createChip(label, () => {
      const input = form.querySelector<HTMLInputElement>(`[name="${key}"][value="${value}"]`);
      if (input) input.checked = false;
      applyFilters(form);
    }));
  }
}

function createChip(label: string, onRemove: () => void): HTMLElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'filter-chip';
  chip.textContent = `${label} ×`;
  chip.addEventListener('click', onRemove);
  return chip;
}

function countMatching(form: HTMLFormElement): number {
  const grid = document.querySelector<HTMLElement>('[data-product-grid]');
  if (!grid) return 0;

  const cards = [...grid.querySelectorAll<HTMLElement>('[data-product-card]')];
  const active = parseActiveFilters(form);
  return cards.filter((card) => matchesFilters(card, active)).length;
}

function updatePreviewCount(form: HTMLFormElement): void {
  const previewEl = document.querySelector('[data-filters-preview-count]');
  if (previewEl) previewEl.textContent = String(countMatching(form));
}

function applyFilters(form: HTMLFormElement): void {
  const grid = document.querySelector<HTMLElement>('[data-product-grid]');
  const countEl = document.querySelector('[data-results-count]');
  const chipsRoot = document.querySelector('[data-filter-chips]');
  if (!grid || !countEl) return;

  const cards = [...grid.querySelectorAll<HTMLElement>('[data-product-card]')];
  const active = parseActiveFilters(form);
  const sort = (document.querySelector<HTMLSelectElement>('[name="sort"]')?.value ??
    'default') as SortOption;

  let visible = cards.filter((card) => matchesFilters(card, active));
  visible = sortCards(visible, sort);

  cards.forEach((card) => {
    card.hidden = !visible.includes(card);
  });

  visible.forEach((card) => grid.appendChild(card));

  countEl.textContent = String(visible.length);
  if (chipsRoot) renderChips(form, chipsRoot);
  updatePreviewCount(form);
}

function closeFiltersSidebar(): void {
  const sidebar = document.querySelector<HTMLElement>('[data-filters-sidebar]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-filters-toggle]');
  sidebar?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
}

function applyCategoryFromUrl(form: HTMLFormElement): void {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  if (!category) return;

  const checkbox = form.querySelector<HTMLInputElement>(`[name="category"][value="${category}"]`);
  if (!checkbox) return;

  checkbox.checked = true;
  applyFilters(form);
}

export function initCatalogPage(data: CatalogPageData): void {
  const form = document.querySelector<HTMLFormElement>('[data-catalog-filters]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-filters-toggle]');
  const sidebar = document.querySelector<HTMLElement>('[data-filters-sidebar]');
  const applyBtn = document.querySelector<HTMLButtonElement>('[data-filters-apply]');
  const grid = document.querySelector<HTMLElement>('[data-product-grid]');

  if (!form) return;

  const onFilterChange = () => {
    if (isMobileFilters()) {
      updatePreviewCount(form);
      return;
    }
    applyFilters(form);
  };

  form.addEventListener('input', onFilterChange);
  form.addEventListener('change', onFilterChange);

  document.querySelector('[name="sort"]')?.addEventListener('change', () => applyFilters(form));

  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      if (isMobileFilters()) {
        updatePreviewCount(form);
      } else {
        applyFilters(form);
      }
    }, 0);
  });

  toggle?.addEventListener('click', () => {
    const open = sidebar?.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) updatePreviewCount(form);
  });

  sidebar?.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).dataset.filtersClose !== undefined) {
      closeFiltersSidebar();
    }
  });

  applyBtn?.addEventListener('click', () => {
    applyFilters(form);
    closeFiltersSidebar();
    grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  applyCategoryFromUrl(form);
  if (!window.location.search.includes('category=')) {
    applyFilters(form);
  }

  window.matchMedia(MOBILE_MQ).addEventListener('change', () => applyFilters(form));

  if (import.meta.env.DEV && data.facets.length === 0) {
    console.info('[catalog] нет фасетов для фильтрации');
  }
}
