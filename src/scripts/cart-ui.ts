import {
  addToCart,
  clearCart,
  formatCartPrice,
  getCartCount,
  getCartItems,
  getCartTotal,
  removeFromCart,
  updateQuantity,
} from './cart-store';

export function initCartBadge(): void {
  updateBadge();
  window.addEventListener('cart:updated', updateBadge);
}

function updateBadge(): void {
  const badges = document.querySelectorAll<HTMLElement>('[data-cart-count]');
  if (badges.length === 0) return;

  const count = getCartCount();
  badges.forEach((badge) => {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  });
}

export function initAddToCartButtons(): void {
  document.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-add-to-cart]');
    if (!target) return;

    event.preventDefault();

    const productId = target.dataset.productId;
    const slug = target.dataset.slug;
    const title = target.dataset.title;
    const price = Number(target.dataset.price);
    const image = target.dataset.image;
    const variantId = target.dataset.variantId;

    if (!productId || !slug || !title || !Number.isFinite(price)) return;

    addToCart({
      productId,
      variantId: variantId || undefined,
      slug,
      title,
      price,
      image: image || undefined,
    });

    target.setAttribute('aria-live', 'polite');
    const original = target.textContent;
    target.textContent = 'Добавлено';
    window.setTimeout(() => {
      target.textContent = original;
    }, 1200);
  });
}

export function initCartPage(): void {
  const root = document.querySelector('[data-cart-page]');
  if (!root) return;

  renderCart();

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const removeBtn = target.closest<HTMLElement>('[data-cart-remove]');
    const qtyBtn = target.closest<HTMLElement>('[data-cart-qty]');

    if (removeBtn) {
      removeFromCart(removeBtn.dataset.productId!, removeBtn.dataset.variantId || undefined);
      renderCart();
      return;
    }

    if (qtyBtn) {
      const productId = qtyBtn.dataset.productId!;
      const variantId = qtyBtn.dataset.variantId || undefined;
      const delta = Number(qtyBtn.dataset.delta);
      const items = getCartItems();
      const item = items.find(
        (i) => i.productId === productId && (i.variantId ?? '') === (variantId ?? ''),
      );
      if (item) {
        updateQuantity(productId, variantId, item.quantity + delta);
        renderCart();
      }
    }
  });

  const clearBtn = document.querySelector('[data-cart-clear]');
  clearBtn?.addEventListener('click', () => {
    clearCart();
    renderCart();
  });

  window.addEventListener('cart:updated', renderCart);
}

function renderCart(): void {
  const list = document.querySelector('[data-cart-list]');
  const empty = document.querySelector('[data-cart-empty]');
  const summary = document.querySelector('[data-cart-summary]');
  const totalEl = document.querySelector('[data-cart-total]');

  if (!list || !empty || !summary || !totalEl) return;

  const items = getCartItems();

  if (items.length === 0) {
    list.innerHTML = '';
    empty.removeAttribute('hidden');
    summary.setAttribute('hidden', '');
    return;
  }

  empty.setAttribute('hidden', '');
  summary.removeAttribute('hidden');
  totalEl.textContent = formatCartPrice(getCartTotal());

  list.innerHTML = items
    .map(
      (item) => `
    <article class="cart-item" data-cart-item>
      <a href="/product/${item.slug}/" class="cart-item__media">
        ${
          item.image
            ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" width="96" height="96" loading="lazy" />`
            : '<div class="cart-item__placeholder" aria-hidden="true"></div>'
        }
      </a>
      <div class="cart-item__body">
        <a href="/product/${item.slug}/" class="cart-item__title">${escapeHtml(item.title)}</a>
        <p class="cart-item__price price">${formatCartPrice(item.price)}</p>
        <div class="cart-item__qty">
          <button type="button" class="cart-item__qty-btn" data-cart-qty data-product-id="${item.productId}" data-variant-id="${item.variantId ?? ''}" data-delta="-1" aria-label="Уменьшить количество">−</button>
          <span class="cart-item__qty-value">${item.quantity}</span>
          <button type="button" class="cart-item__qty-btn" data-cart-qty data-product-id="${item.productId}" data-variant-id="${item.variantId ?? ''}" data-delta="1" aria-label="Увеличить количество">+</button>
        </div>
      </div>
      <button type="button" class="cart-item__remove" data-cart-remove data-product-id="${item.productId}" data-variant-id="${item.variantId ?? ''}" aria-label="Удалить из корзины">Удалить</button>
    </article>
  `,
    )
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface VariantAxisConfig {
  key: string;
  label: string;
  values: string[];
  isColor: boolean;
}

interface VariantConfigPayload {
  axes: VariantAxisConfig[];
  colorImage: Record<string, string>;
  defaultSelection: Record<string, string>;
  variants: Array<{
    id: string;
    label: string;
    attributes?: Record<string, string>;
    image?: string;
    price?: number;
  }>;
  basePrice: number;
}

function readVariantConfig(): VariantConfigPayload | null {
  const el = document.querySelector<HTMLScriptElement>('[data-variant-config]');
  if (!el?.textContent) return null;

  try {
    return JSON.parse(el.textContent) as VariantConfigPayload;
  } catch {
    return null;
  }
}

function formatSpecValue(key: string, value: string): string {
  if (key === 'width_cm' || key === 'height_cm' || key === 'depth_cm') {
    return `${value} см`;
  }
  return value;
}

function resolveVariantFromSelection(
  variants: VariantConfigPayload['variants'],
  selection: Record<string, string>,
): VariantConfigPayload['variants'][number] {
  const exact = variants.find((variant) => {
    if (!variant.attributes) return false;
    return Object.entries(selection).every(([key, value]) => {
      if (!value) return true;
      return String(variant.attributes?.[key] ?? '') === value;
    });
  });
  if (exact) return exact;

  let best = variants[0];
  let bestScore = -1;

  for (const variant of variants) {
    if (!variant.attributes) continue;
    let score = 0;
    for (const [key, value] of Object.entries(selection)) {
      if (!value) continue;
      if (String(variant.attributes[key] ?? '') === value) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = variant;
    }
  }

  return best;
}

function buildVariantLabel(
  variant: VariantConfigPayload['variants'][number],
  axes: VariantAxisConfig[],
): string {
  return axes
    .map((axis) => String(variant.attributes?.[axis.key] ?? ''))
    .filter(Boolean)
    .join(', ');
}

export function initGalleryThumbs(): void {
  document.querySelectorAll<HTMLElement>('[data-thumb-src]:not([data-color])').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.thumbSrc;
      const main = document.querySelector<HTMLImageElement>('[data-product-main-image]');
      if (!src || !main) return;

      main.src = src;
      document.querySelectorAll<HTMLElement>('[data-thumb-src]').forEach((el) => {
        const active = el === btn;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  });
}

export function initProductVariants(): void {
  const root = document.querySelector('[data-product-variants]');
  const config = readVariantConfig();
  if (!root || !config) return;

  const priceEl = document.querySelector<HTMLElement>('[data-product-price]');
  const imageEl = document.querySelector<HTMLImageElement>('[data-product-main-image]');
  const addBtn = document.querySelector<HTMLElement>('[data-add-to-cart]');
  const baseTitle = addBtn?.dataset.baseTitle ?? addBtn?.dataset.title ?? '';

  let selection = { ...config.defaultSelection };

  function setAxisButtonState(axisKey: string, value: string): void {
    root!.querySelectorAll<HTMLElement>(`[data-axis="${axisKey}"][data-value]`).forEach((el) => {
      const active = el.dataset.value === value;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function syncThumbForColor(color: string | undefined): void {
    const targetSrc = color ? config!.colorImage[color] : undefined;
    if (!targetSrc) return;

    document.querySelectorAll<HTMLElement>('[data-thumb-src]').forEach((btn) => {
      const src = btn.dataset.thumbSrc;
      const isColorThumb = Boolean(btn.dataset.color);
      if (isColorThumb) {
        const active = src === targetSrc;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      } else {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function applySelection(nextSelection: Record<string, string>): void {
    selection = { ...nextSelection };
    const variant = resolveVariantFromSelection(config!.variants, selection);
    const resolvedSelection: Record<string, string> = {};

    for (const axis of config!.axes) {
      const value = String(variant.attributes?.[axis.key] ?? selection[axis.key] ?? '');
      resolvedSelection[axis.key] = value;
      setAxisButtonState(axis.key, value);
    }

    selection = resolvedSelection;

    const price = variant.price ?? config!.basePrice;
    const color = resolvedSelection.color;
    const image = (color && config!.colorImage[color]) || variant.image || addBtn?.dataset.image || '';
    const label = buildVariantLabel(variant, config!.axes);

    if (priceEl) priceEl.textContent = formatCartPrice(price);
    if (imageEl && image) {
      imageEl.src = image;
      imageEl.alt = label ? `${baseTitle}, ${label}` : baseTitle;
    }

    if (variant.attributes) {
      for (const [key, value] of Object.entries(variant.attributes)) {
        const specEl = document.querySelector<HTMLElement>(`[data-spec-key="${key}"]`);
        if (specEl) specEl.textContent = formatSpecValue(key, String(value));
      }
    }

    if (addBtn) {
      addBtn.dataset.variantId = variant.id;
      addBtn.dataset.price = String(price);
      if (image) addBtn.dataset.image = image;
      addBtn.dataset.title = label ? `${baseTitle}, ${label}` : baseTitle;
    }

    syncThumbForColor(color);
  }

  root.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-axis][data-value]');
    if (!btn || !root.contains(btn)) return;

    const axisKey = btn.dataset.axis;
    const value = btn.dataset.value;
    if (!axisKey || !value) return;

    applySelection({ ...selection, [axisKey]: value });
  });

  document.querySelectorAll<HTMLElement>('[data-thumb-src][data-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (!color) return;
      applySelection({ ...selection, color });
    });
  });

  applySelection(selection);
}
