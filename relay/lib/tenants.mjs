export function loadTenants() {
  const raw = process.env.TENANTS_JSON;
  if (!raw) {
    return {
      demo: {
        name: 'Vitrina Demo',
        email: process.env.DEMO_ORDER_EMAIL || 'shop@example.com',
        telegramChatId: process.env.DEMO_TELEGRAM_CHAT_ID || '',
      },
    };
  }

  return JSON.parse(raw);
}

export function getTenantConfig(tenantId) {
  const tenants = loadTenants();
  return tenants[tenantId] ?? null;
}
