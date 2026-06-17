# Модель данных и адаптеры

## Канонический формат товара

Весь сайт работает только с этим типом. Адаптеры приводят к нему любой источник. Почти все поля опциональны — это нужно для graceful degradation.

```ts
type Availability = 'in_stock' | 'on_order' | 'out_of_stock' | 'unknown';

interface Variant {
  id: string;
  label: string;                 // «Велюр, серый»
  attributes?: Record<string, string>;
  image?: string;
  price?: number;                // если отличается от базовой
}

interface Product {
  id: string;                    // стабильный id из источника (offer id)
  slug: string;                  // url-safe, генерится из title+id
  title: string;
  description?: string;          // сырое описание из фида
  descriptionRich?: string;      // полированный текст от GigaChat (build-time)
  seo?: { title?: string; description?: string };

  price: number;                 // текущая цена, ₽
  oldPrice?: number;             // для отображения скидки
  currency: 'RUB';

  availability: Availability;
  stock?: number;                // кол-во, если есть

  categories: string[];          // путь/иды категорий
  images: string[];              // URL картинок (первая = главная)
  attributes: Record<string, string | number>;  // нормализованные: material, color, width_cm, ...
  variants?: Variant[];          // ткань/цвет и т.п.

  embedding?: number[];          // эмбеддинг главного фото (добавляется на сборке)
  models3d?: { glb?: string; usdz?: string };    // опц. AR/3D-тир
  showrooms?: string[];          // где есть офлайн (опц.)
}
```

## Интерфейс адаптера

```ts
interface SourceAdapter {
  name: string;                  // 'yml' | 'csv' | 'gsheets'
  capabilities: {
    stock: boolean;
    images: boolean;
    variants: boolean;
    attributes: boolean;
  };
  fetch(): Promise<unknown[]>;            // вытащить сырые записи из источника
  toCanonical(raw: unknown): Product;     // привести к канону + нормализация
}
```

Добавить новый источник = написать один адаптер. Ядро (рендер, поиск, эмбеддинги) не трогается.

## Адаптеры MVP

### 1. YML (приоритетный)
Формат Яндекс.Маркета (XML), который умеют отдавать 1С, МойСклад, Битрикс, InSales и др.

- Источник: URL фида (в `.env` / `site.config.ts`).
- Парсинг `<offer>` → `Product`. `<param name="...">` → `attributes`.
- **Варианты**: в YML моделируются по-разному — то отдельными офферами с общим `group_id`, то одним оффером с параметрами. Адаптер должен поддержать оба: группировать по `group_id` в `variants`, если он есть.
- Capabilities: `{ stock: true, images: true, variants: true, attributes: true }` (по факту фида).

### 2. CSV / Excel
Когда фида нет — клиент выгружает таблицу.

- Маппинг колонок → поля канона задаётся в конфиге (`columnMap`).
- Терпимый парсинг: пропускать кривые строки, логировать.
- Capabilities: обычно `{ stock: true, images: true, variants: false, attributes: true }`.

### 3. Google Sheets (= «ручной ввод» для мелких)
Клиент заполняет таблицу по твоему шаблону → тянем как источник. Без админки.

- Источник: публичный CSV-export листа или Sheets API (read-only).
- Тот же `columnMap`, что у CSV.
- Capabilities: `{ stock: true, images: true, variants: false, attributes: true }`.

## Нормализация атрибутов (важно)

Качество фидов — главная боль, не транспорт. `<param>` под материал/цвет/размер не стандартизированы («Материал» / «материал каркаса» / «Ткань»).

- **Словарь синонимов** атрибутов → канонические ключи (`material`, `color`, `width_cm`, `height_cm`, `depth_cm`, `seats`, …).
- Единицы → числа (`«180 см»` → `width_cm: 180`).
- Цвета → к нормализованному набору (для фильтров).
- **GigaChat в помощь:** на сложных/мусорных фидах можно прогнать маппинг параметров через GigaChat на сборке (см. `GIGACHAT.md`).
- Чем хуже структурированы атрибуты, тем сильнее опираемся на визуальный + семантический поиск вместо точных фильтров.

## Выход сборки

- `data/catalog.json` — массив `Product` (без `embedding`).
- `data/embeddings.json` — `{ model, dim, items: { [id]: number[] } }`, векторы L2-нормированы.
- Фильтры и сортировка строятся автоматически из `attributes` всех товаров.
