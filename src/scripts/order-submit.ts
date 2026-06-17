import { clearCart, getCartItems, getCartTotal } from './cart-store';
import { buildOrderFallbackLinks } from '../lib/order-fallback';
import { buildOrder, type Order, type OrderCustomer } from '../lib/order-types';

export interface OrderClientConfig {
  tenant: string;
  siteName: string;
  relayUrl?: string;
  contacts: {
    phone: string;
    email: string;
    whatsapp?: string;
  };
  telegram?: {
    botUsername?: string;
  };
}

type OrderUiState = 'idle' | 'sending' | 'success' | 'error';

export function initOrderForm(config: OrderClientConfig): void {
  const form = document.querySelector<HTMLFormElement>('[data-order-form]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitOrder(form, config);
  });
}

async function submitOrder(form: HTMLFormElement, config: OrderClientConfig): Promise<void> {
  const honeypot = form.querySelector<HTMLInputElement>('[name="website"]')?.value.trim();
  if (honeypot) return;

  const items = getCartItems();
  if (items.length === 0) {
    setOrderState('error', 'Добавьте товары в корзину перед оформлением.');
    return;
  }

  const customer = readCustomer(form);
  if (!customer) return;

  const order = buildOrder(customer, items, getCartTotal());
  const relayUrl = config.relayUrl?.trim();

  if (!relayUrl) {
    showFallback(
      config,
      order,
      'Релей заказов не настроен. Отправьте заказ через Telegram, WhatsApp или email:',
    );
    setOrderState('error', 'Релей заказов не настроен.');
    return;
  }

  setOrderState('sending');

  try {
    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: config.tenant, order }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body.slice(0, 160) || `Ошибка ${response.status}`);
    }

    clearCart();
    setOrderState('success', 'Заказ отправлен. Мы свяжемся с вами для подтверждения.');
    form.reset();
    hideFallback();
    window.dispatchEvent(new CustomEvent('cart:updated'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось отправить заказ';
    setOrderState(
      'error',
      `Не удалось отправить заказ. Проверьте соединение или отправьте заказ другим способом.`,
    );
    showFallback(config, order, message);
  }
}

function readCustomer(form: HTMLFormElement): OrderCustomer | null {
  const name = form.querySelector<HTMLInputElement>('[name="customer_name"]')?.value.trim();
  const phone = form.querySelector<HTMLInputElement>('[name="customer_phone"]')?.value.trim();
  const email = form.querySelector<HTMLInputElement>('[name="customer_email"]')?.value.trim();
  const comment = form.querySelector<HTMLTextAreaElement>('[name="customer_comment"]')?.value.trim();

  if (!name) {
    setOrderState('error', 'Укажите имя.');
    return null;
  }

  if (!phone) {
    setOrderState('error', 'Укажите телефон.');
    return null;
  }

  return {
    name,
    phone,
    email: email || undefined,
    comment: comment || undefined,
  };
}

function setOrderState(state: OrderUiState, message = ''): void {
  const form = document.querySelector<HTMLFormElement>('[data-order-form]');
  const status = document.querySelector<HTMLElement>('[data-order-status]');
  const submit = document.querySelector<HTMLButtonElement>('[data-order-submit]');

  if (status) {
    status.textContent = message;
    status.hidden = !message;
    status.dataset.state = state;
  }

  if (submit) {
    submit.disabled = state === 'sending' || state === 'success';
    submit.textContent =
      state === 'sending' ? 'Отправляем…' : state === 'success' ? 'Заказ отправлен' : 'Оформить заказ';
  }

  if (form) {
    const fields = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
    fields.forEach((field) => {
      if (field.name === 'website') return;
      field.disabled = state === 'sending' || state === 'success';
    });
  }
}

function showFallback(config: OrderClientConfig, order: Order, reason: string): void {
  const root = document.querySelector<HTMLElement>('[data-order-fallback]');
  const reasonEl = document.querySelector<HTMLElement>('[data-order-fallback-reason]');
  if (!root || !reasonEl) return;

  const links = buildOrderFallbackLinks(order, config.siteName, {
    phone: config.contacts.phone,
    email: config.contacts.email,
    whatsapp: config.contacts.whatsapp,
    telegramBotUsername: config.telegram?.botUsername,
  });

  reasonEl.textContent = reason;
  root.hidden = false;

  setLink('[data-fallback-mailto]', links.mailto);
  setLink('[data-fallback-telegram]', links.telegram);
  setLink('[data-fallback-whatsapp]', links.whatsapp);
}

function hideFallback(): void {
  const root = document.querySelector<HTMLElement>('[data-order-fallback]');
  if (root) root.hidden = true;
}

function setLink(selector: string, href?: string): void {
  const el = document.querySelector<HTMLAnchorElement>(selector);
  if (!el) return;

  if (href) {
    el.href = href;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}
