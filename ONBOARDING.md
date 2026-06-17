# Заведение нового клиента (Vitrina)

Один клиент = один `site.config.ts` + его каталог + деплой `./dist`. Код общий, ребрендинг — смена токенов.

## Чек-лист: 10 шагов

| # | Шаг | Команда / действие |
|---|------|-------------------|
| 1 | **Клонировать репозиторий** | `git clone …` → `npm install` |
| 2 | **Заполнить `site.config.ts`** | `tenant`, `name`, `tagline`, `url`, `theme`, `contacts`, `telegram`, `catalog` |
| 3 | **Создать `.env`** | `cp .env.example .env` — GigaChat, `PUBLIC_ORDER_RELAY_URL`, SMTP/Telegram для релая |
| 4 | **Подключить каталог** | YML / CSV / Google Sheets URL в `catalog.url`; для CSV — `columnMap` |
| 5 | **Скачать CLIP** | `npm run fetch-model` → веса в `public/models/` (самохостинг, RU) |
| 6 | **Синк каталога** | `npm run sync` → `data/catalog.json` |
| 7 | **Эмбеддинги** | `npm run embed` → `data/embeddings.json` + `public/embeddings.json` |
| 8 | **Тексты SEO (опц.)** | `npm run enrich` — GigaChat, кеш в `data/enrich-cache.json` |
| 9 | **Сборка** | `npm run client:build` или по шагам; проверка: `npm run verify-theme` |
| 10 | **Деплой** | `./dist` на Object Storage / CDN / хостинг клиента; в релее — запись в `TENANTS_JSON` |

Полный пайплайн одной командой (без `fetch-model`, если веса уже есть):

```bash
npm run client:build
```

С нуля (включая модель):

```bash
npm run fetch-model && npm run client:build
```

## `site.config.ts` — что менять

```ts
export const siteConfig: SiteConfig = {
  tenant: 'client-slug',           // id для релая заказов
  name: 'Название магазина',
  tagline: '…',
  url: 'https://shop-client.ru',   // canonical, og, sitemap
  theme: {
    accent: '#23395B',             // ← главный рычаг перекраски
    accentHover: '#1A2C47',
    accentInk: '#FFFFFF',
    // опц.: bg, surface2 для тёплого/холодного нейтраля
    …defaultTheme или свои значения
  },
  contacts: { phone, email, city, address, whatsapp? },
  telegram: { chatId, botUsername? },
  catalog: { source: 'yml' | 'csv' | 'gsheets', url: '…', columnMap? },
};
```

Токены инжектятся в `<html style="--accent: …">` на сборке. **Меняете только `theme` — перекрашивается весь UI** (кнопки, ссылки, фокус, header, герой). Код и CSS не трогаем.

Проверка:

```bash
npm run build && npm run verify-theme
```

## Релей заказов

1. Задеплоить `relay/` как Yandex Cloud Function (или `npm run relay:dev` локально).
2. В `.env` клиентской сборки: `PUBLIC_ORDER_RELAY_URL=https://…`
3. В релее `TENANTS_JSON`:

```json
{
  "client-slug": {
    "name": "Название",
    "email": "orders@client.ru",
    "telegramChatId": "123456789"
  }
}
```

`client-slug` = `site.config.ts` → `tenant`.

## Quality floor (Lighthouse)

Перед сдачей клиенту:

```bash
npm run build
npm run preview          # http://localhost:4321
npm run quality          # отчёт в data/lighthouse-home.json
```

**Целевые пороги (MVP):**

| Категория | Цель |
|-----------|------|
| SEO | ≥ 95 |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 90 |
| Performance | ≥ 70 (статика; CLIP грузится лениво, не на всех страницах) |

На главной perf может быть ниже из‑за Google Fonts и первого захода — для prod рекомендуем self-host шрифтов Onest + Golos Text.

Ручная проверка: адаптив (320px+), Tab-фокус, `alt` у картинок, `prefers-reduced-motion`.

## Деплой

- Артефакт: содержимое `./dist`
- Нужны: `embeddings.json`, `public/models/` (если не на CDN), статика Astro
- После обновления каталога: `sync → embed → (enrich) → build → deploy`

## Частые проблемы

| Симптом | Решение |
|---------|---------|
| Поиск по фото не работает | `npm run fetch-model`, проверить `public/models/` |
| Пустой каталог | `npm run sync`, проверить URL и формат источника |
| Заказ не уходит | `PUBLIC_ORDER_RELAY_URL`, `TENANTS_JSON`, SMTP/Telegram |
| Enrich падает на Windows TLS | `GIGACHAT_TLS_INSECURE=1` в `.env` (только dev) |
| Категории «1», «2» в YML | В фиде должен быть блок `<categories>`; пересобрать `sync` |
