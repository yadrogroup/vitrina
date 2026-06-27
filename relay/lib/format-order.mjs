export function formatOrderMessage(order, siteName = 'Vitrina') {
  const lines = [
    `🛒 Новый заказ — ${siteName}`,
    '',
    `👤 ${order.customer.name}`,
    `📞 ${order.customer.phone}`,
  ];

  if (order.customer.email) lines.push(`✉️ ${order.customer.email}`);
  if (order.customer.comment) lines.push(`💬 ${order.customer.comment}`);

  lines.push('', 'Товары:');
  for (const item of order.items) {
    lines.push(`• ${item.title} × ${item.quantity} — ${item.price * item.quantity} ₽`);
  }

  lines.push('', `Итого: ${order.total} ₽`);
  lines.push(`Время: ${order.createdAt}`);
  return lines.join('\n');
}

export function validateOrderPayload(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Тело запроса должно быть JSON-объектом' };
  }

  const { tenant, order } = body;

  if (!tenant || typeof tenant !== 'string') {
    return { ok: false, error: 'Поле tenant обязательно' };
  }

  if (!order || typeof order !== 'object') {
    return { ok: false, error: 'Поле order обязательно' };
  }

  if (!order.customer?.name?.trim() || !order.customer?.phone?.trim()) {
    return { ok: false, error: 'Укажите имя и телефон покупателя' };
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return { ok: false, error: 'Корзина пуста' };
  }

  if (!Number.isFinite(order.total) || order.total <= 0) {
    return { ok: false, error: 'Некорректная сумма заказа' };
  }

  return { ok: true, tenant, order };
}
