import { CART_STORAGE_KEY, type CartItem, type CartState } from '../lib/cart-types';

function readCart(): CartState {
  if (typeof localStorage === 'undefined') return { items: [] };

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as CartState;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

function writeCart(state: CartState): void {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: state }));
}

export function getCartItems(): CartItem[] {
  return readCart().items;
}

export function getCartCount(): number {
  return readCart().items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartTotal(): number {
  return readCart().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1): void {
  const cart = readCart();
  const key = `${item.productId}:${item.variantId ?? ''}`;
  const existing = cart.items.find(
    (i) => `${i.productId}:${i.variantId ?? ''}` === key,
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ ...item, quantity });
  }

  writeCart(cart);
}

export function updateQuantity(productId: string, variantId: string | undefined, quantity: number): void {
  const cart = readCart();
  const key = `${productId}:${variantId ?? ''}`;
  const item = cart.items.find((i) => `${i.productId}:${i.variantId ?? ''}` === key);

  if (!item) return;

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => `${i.productId}:${i.variantId ?? ''}` !== key);
  } else {
    item.quantity = quantity;
  }

  writeCart(cart);
}

export function removeFromCart(productId: string, variantId?: string): void {
  updateQuantity(productId, variantId, 0);
}

export function clearCart(): void {
  writeCart({ items: [] });
}

export function formatCartPrice(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
}
