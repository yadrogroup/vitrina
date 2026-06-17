import type { Order } from './order-types';

export interface FallbackContacts {
  phone: string;
  email: string;
  telegramBotUsername?: string;
  whatsapp?: string;
}

export interface OrderFallbackLinks {
  telegram?: string;
  whatsapp?: string;
  mailto: string;
}

export function formatOrderText(order: Order, siteName: string): string {
  const lines = [
    `Заказ с сайта ${siteName}`,
    '',
    `Имя: ${order.customer.name}`,
    `Телефон: ${order.customer.phone}`,
  ];

  if (order.customer.email) lines.push(`Email: ${order.customer.email}`);
  if (order.customer.comment) lines.push(`Комментарий: ${order.customer.comment}`);

  lines.push('', 'Товары:');
  for (const item of order.items) {
    lines.push(
      `— ${item.title} × ${item.quantity} = ${formatRub(item.price * item.quantity)}`,
    );
  }

  lines.push('', `Итого: ${formatRub(order.total)}`);
  return lines.join('\n');
}

function formatRub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildOrderFallbackLinks(
  order: Order,
  siteName: string,
  contacts: FallbackContacts,
): OrderFallbackLinks {
  const text = formatOrderText(order, siteName);
  const subject = `Заказ с сайта ${siteName}`;

  const links: OrderFallbackLinks = {
    mailto: `mailto:${contacts.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
  };

  if (contacts.telegramBotUsername) {
    links.telegram = `https://t.me/${contacts.telegramBotUsername.replace(/^@/, '')}?text=${encodeURIComponent(text)}`;
  }

  const whatsappPhone = contacts.whatsapp ?? contacts.phone;
  const digits = whatsappPhone.replace(/\D/g, '');
  if (digits) {
    links.whatsapp = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  return links;
}
