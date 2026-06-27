/**
 * Реестр API-провайдеров. Подключение нового клиента сводится к выбору
 * provider в site.config.ts (catalog.apiProvider) и ключу в .env.
 */

import type { SiteConfig } from '../../../../site.config';
import type { SourceAdapter } from '../../types/product';
import { type ApiAdapterOptions, type ApiProvider, resolveCredentials } from './base';
import { createBitrixAdapter } from './bitrix';
import { createInsalesAdapter } from './insales';
import { createMoyskladAdapter } from './moysklad';
import { createOnecAdapter } from './onec';
import { createRetailcrmAdapter } from './retailcrm';

type AdapterFactory = (opts: ApiAdapterOptions) => SourceAdapter;

const REGISTRY: Record<ApiProvider, AdapterFactory> = {
  moysklad: createMoyskladAdapter,
  onec: createOnecAdapter,
  bitrix: createBitrixAdapter,
  insales: createInsalesAdapter,
  retailcrm: createRetailcrmAdapter,
};

export const SUPPORTED_API_PROVIDERS = Object.keys(REGISTRY) as ApiProvider[];

export function createApiAdapter(config: SiteConfig): SourceAdapter {
  const provider = (process.env.API_PROVIDER?.trim() as ApiProvider | undefined) ?? config.catalog.apiProvider;

  if (!provider) {
    throw new Error(
      `Источник "api" выбран, но не указан apiProvider. Допустимо: ${SUPPORTED_API_PROVIDERS.join(', ')}.`,
    );
  }

  const factory = REGISTRY[provider];
  if (!factory) {
    throw new Error(
      `Неизвестный apiProvider "${provider}". Допустимо: ${SUPPORTED_API_PROVIDERS.join(', ')}.`,
    );
  }

  const credentials = resolveCredentials(provider);
  return factory({ baseUrl: config.catalog.url, credentials });
}

export { type ApiProvider } from './base';
