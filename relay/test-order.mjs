const relayUrl = process.env.RELAY_URL || 'http://localhost:8787';

const order = {
  tenant: 'demo',
  order: {
    customer: {
      name: 'Тест Покупатель',
      phone: '+7 900 000-00-00',
      email: 'buyer@example.com',
      comment: 'Тестовый заказ из relay/test-order.mjs',
    },
    items: [
      {
        productId: '201',
        title: 'Кровать «Сон»',
        price: 32990,
        quantity: 1,
      },
    ],
    total: 32990,
    currency: 'RUB',
    createdAt: new Date().toISOString(),
  },
};

const response = await fetch(relayUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order),
});

const text = await response.text();
console.log(`[test-order] ${response.status}`, text);
