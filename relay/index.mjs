import { formatOrderMessage, validateOrderPayload } from './lib/format-order.mjs';
import { sendEmailOrder } from './lib/email.mjs';
import { getTenantConfig } from './lib/tenants.mjs';
import { sendTelegramOrder } from './lib/telegram.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}

export async function processOrderRequest({ method, body }) {
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Допустим только POST' });
  }

  let parsed;
  try {
    parsed = JSON.parse(body || '{}');
  } catch {
    return jsonResponse(400, { ok: false, error: 'Невалидный JSON' });
  }

  const validation = validateOrderPayload(parsed);
  if (!validation.ok) {
    return jsonResponse(400, { ok: false, error: validation.error });
  }

  const tenant = getTenantConfig(validation.tenant);
  if (!tenant) {
    return jsonResponse(404, { ok: false, error: `Неизвестный tenant: ${validation.tenant}` });
  }

  const siteName = tenant.name || validation.tenant;
  const message = formatOrderMessage(validation.order, siteName);

  const [telegramResult, emailResult] = await Promise.all([
    sendTelegramOrder({ chatId: tenant.telegramChatId, text: message }),
    sendEmailOrder({
      to: tenant.email,
      subject: `Новый заказ — ${siteName}`,
      text: message,
      siteName,
    }),
  ]);

  const delivered = telegramResult.ok || emailResult.ok;

  if (!delivered && process.env.RELAY_DRY_RUN === '1') {
    return jsonResponse(200, {
      ok: true,
      dryRun: true,
      preview: message,
      details: { telegram: telegramResult, email: emailResult },
    });
  }

  if (!delivered) {
    return jsonResponse(502, {
      ok: false,
      error: 'Не удалось отправить заказ ни в Telegram, ни на email',
      details: {
        telegram: telegramResult,
        email: emailResult,
      },
    });
  }

  return jsonResponse(200, {
    ok: true,
    delivered: {
      telegram: telegramResult.ok,
      email: emailResult.ok,
    },
  });
}

/** Точка входа Yandex Cloud Functions (HTTP-триггер) */
export async function handler(event) {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
  const body = event.body || event.requestBody || '{}';

  return processOrderRequest({ method, body });
}
