export async function sendTelegramOrder({ chatId, text }) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, skipped: true, reason: 'TELEGRAM_BOT_TOKEN не задан' };
  }

  if (!chatId) {
    return { ok: false, skipped: true, reason: 'telegramChatId не задан для тенанта' };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: `Telegram ${response.status}: ${body.slice(0, 200)}` };
  }

  return { ok: true };
}
