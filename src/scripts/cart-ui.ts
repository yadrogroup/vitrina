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
  const badge = document.querySelector<HTMLElement>('[data-cart-count]');
  if (!badge) return;

  const count = getCartCount();
  badge.textContent = String(count);
  badge.hidden = count === 0;
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

export function initProductVariants(): void {
  const root = document.querySelector('[data-product-variants]');
  if (!root) return;

  const priceEl = document.querySelector<HTMLElement>('[data-product-price]');
  const imageEl = document.querySelector<HTMLImageElement>('[data-product-main-image]');
  const addBtn = document.querySelector<HTMLElement>('[data-add-to-cart]');

  root.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-variant-id]');
    if (!btn) return;

    root.querySelectorAll('[data-variant-id]').forEach((el) => {
      el.classList.remove('is-active');
      el.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');

    const price = btn.dataset.variantPrice;
    const image = btn.dataset.variantImage;
    const variantId = btn.dataset.variantId;
    const label = btn.dataset.variantLabel;

    if (price && priceEl) priceEl.textContent = formatCartPrice(Number(price));
    if (image && imageEl) {
      imageEl.src = image;
      imageEl.alt = label ?? imageEl.alt;
    }
    if (addBtn) {
      if (variantId) addBtn.dataset.variantId = variantId;
      if (price) addBtn.dataset.price = price;
      if (image) addBtn.dataset.image = image;
      if (label) addBtn.dataset.title = `${addBtn.dataset.baseTitle ?? addBtn.dataset.title}, ${label}`;
    }
  });
}
