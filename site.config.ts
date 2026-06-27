/**
 * Per-client конфигурация тенанта.
 * Ребрендинг = правка этого файла + пересборка.
 */

import type { CsvColumnMap } from './src/lib/types/catalog';
import type { Showroom } from './src/lib/types/showroom';
import type { ApiProvider } from './src/lib/adapters/api/base';

export type CatalogSourceType = 'yml' | 'csv' | 'gsheets' | 'api' | 'db';

export interface ThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentHover: string;
  accentInk: string;
  highlight: string;
  success: string;
  danger: string;
}

export interface LegalInfo {
  entityType: string;
  entityName: string;
  inn: string;
  ogrn: string;
  legalAddress: string;
  /** Дата последнего обновления правовых документов (YYYY-MM-DD) */
  updatedAt: string;
}

export interface SiteConfig {
  tenant: string;
  name: string;
  tagline: string;
  url: string;
  theme: ThemeTokens;
  contacts: {
    phone: string;
    email: string;
    city: string;
    address?: string;
    /** @deprecated Используйте showrooms[0]; оставлено для обратной совместимости. */
    twoGisUrl?: string;
    twoGisMap?: {
      orgId?: string;
      city: string;
      lat: number;
      lon: number;
      zoom?: number;
    };
    whatsapp?: string;
  };
  /** Салоны на карте (как у Askona — несколько точек). */
  showrooms?: Showroom[];
  telegram: {
    chatId: string;
    botUsername?: string;
  };
  orderRelayUrl?: string;
  /** POST endpoint для поиска по фото (серверный инференс). */
  photoSearchApiUrl?: string;
  /** Реквизиты для оферты, политики и страницы контактов */
  legal: LegalInfo;
  catalog: {
    source: CatalogSourceType;
    /** URL YML/CSV, ID Google Sheets, базовый URL API клиента или локальный путь */
    url: string;
    /** Провайдер складской системы при source: 'api' (ключи — в .env, не здесь) */
    apiProvider?: ApiProvider;
    /** Маппинг колонок для csv / gsheets */
    columnMap?: CsvColumnMap;
  };
}

/** Дефолтная палитра из DESIGN-SYSTEM.md */
const defaultTheme: ThemeTokens = {
  bg: '#FAF9F7',
  surface: '#FFFFFF',
  surface2: '#F1EFEA',
  line: '#E6E2DB',
  ink: '#1F1D1A',
  inkMuted: '#6A6560',
  accent: '#23395B',
  accentHover: '#1A2C47',
  accentInk: '#FFFFFF',
  highlight: '#C8893F',
  success: '#2E7D52',
  danger: '#B23B3B',
};

export const siteConfig: SiteConfig = {
  tenant: 'demo',
  name: 'Vitrina',
  tagline: 'Мебель для дома — найдём похожую по фото',
  url: 'http://vitrina.72.56.21.243.sslip.io',
  theme: defaultTheme,
  contacts: {
    phone: '+7 (495) 000-00-00',
    email: 'konstda@mail.ru',
    city: 'Москва',
    address: 'ул. Примерная, 1',
    twoGisUrl: 'https://2gis.ru/moscow/firm/70000001104322123',
    twoGisMap: {
      orgId: '70000001104322123',
      city: 'moscow',
      lat: 55.7265,
      lon: 37.7356,
      zoom: 16,
    },
    whatsapp: '+74950000000',
  },
  showrooms: [
    {
      id: 'moscow-flagship',
      name: 'Vitrina — шоурум на Таганке',
      type: 'Фирменный салон',
      city: 'moscow',
      address: 'Таганская улица, 29 ст1',
      phone: '+7 (495) 000-00-00',
      hours: 'Ежедневно, 10:00–21:00',
      twoGisUrl: 'https://2gis.ru/moscow/firm/70000001038706223',
      twoGisOrgId: '70000001038706223',
      lat: 55.739703,
      lon: 37.667121,
    },
    {
      id: 'moscow-ryazan',
      name: 'Vitrina — Рязанский проспект',
      type: 'Фирменный салон',
      city: 'moscow',
      address: 'Рязанский проспект, 2 к3, ТЦ Декоратор, 3 этаж',
      phone: '+7 (495) 000-00-01',
      hours: 'Ежедневно, 10:00–21:00',
      twoGisUrl: 'https://2gis.ru/moscow/firm/70000001104322123',
      twoGisOrgId: '70000001104322123',
      lat: 55.730432,
      lon: 37.734102,
    },
    {
      id: 'moscow-entuziastov',
      name: 'Vitrina — шоссе Энтузиастов',
      type: 'Шоурум',
      city: 'moscow',
      address: 'шоссе Энтузиастов, 12 ст2, ТРЦ Город, 4 этаж',
      phone: '+7 (495) 000-00-02',
      hours: 'Ежедневно, 10:00–22:00',
      twoGisUrl: 'https://2gis.ru/moscow/firm/70000001104291960',
      twoGisOrgId: '70000001104291960',
      lat: 55.748123,
      lon: 37.706308,
    },
    {
      id: 'moscow-dmitrov',
      name: 'Vitrina — Дмитровское шоссе',
      type: 'Шоурум',
      city: 'moscow',
      address: 'Дмитровское шоссе, 21 к2, 1 этаж',
      phone: '+7 (495) 000-00-03',
      hours: 'Пн–Вс, 10:00–21:00',
      twoGisUrl: 'https://2gis.ru/moscow/firm/4504127908446738',
      twoGisOrgId: '4504127908446738',
      lat: 55.823234,
      lon: 37.572068,
    },
  ],
  telegram: {
    chatId: '155644008',
    botUsername: 'vitrinatest_bot',
  },
  orderRelayUrl: 'http://vitrina.72.56.21.243.sslip.io/api/order',
  photoSearchApiUrl: '/api/photo-search',
  legal: {
    entityType: 'ООО',
    entityName: 'ООО «Витрина Демо»',
    inn: '7700000000',
    ogrn: '1234567890123',
    legalAddress: '123456, г. Москва, ул. Примерная, д. 1, офис 10',
    updatedAt: '2026-06-22',
  },
  catalog: {
    source: 'yml',
    url: 'data/fixtures/sample.yml',
    columnMap: {
      id: 'id',
      title: 'title',
      price: 'price',
      oldPrice: 'old_price',
      description: 'description',
      category: 'category',
      images: 'images',
      stock: 'stock',
    },
  },
};

export default siteConfig;
