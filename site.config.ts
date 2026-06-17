/**
 * Per-client конфигурация тенанта.
 * Ребрендинг = правка этого файла + пересборка.
 */

import type { CsvColumnMap } from './src/lib/types/catalog';

export type CatalogSourceType = 'yml' | 'csv' | 'gsheets';

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
    whatsapp?: string;
  };
  telegram: {
    chatId: string;
    botUsername?: string;
  };
  orderRelayUrl?: string;
  catalog: {
    source: CatalogSourceType;
    /** URL YML/CSV, ID Google Sheets или локальный путь (data/fixtures/...) */
    url: string;
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
  url: 'https://example.com',
  theme: defaultTheme,
  contacts: {
    phone: '+7 (495) 000-00-00',
    email: 'shop@example.com',
    city: 'Москва',
    address: 'ул. Примерная, 1',
    whatsapp: '+74950000000',
  },
  telegram: {
    chatId: '',
    botUsername: '',
  },
  orderRelayUrl: 'http://vitrina.72.56.21.243.sslip.io/api/order',
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
