/**
 * Базовый слой API-адаптеров складских систем.
 *
 * Идея: один интерфейс для всех источников. Подключение нового клиента =
 * выбрать `apiProvider` в site.config.ts + положить ключ в .env.
 * Ключи НИКОГДА не в site.config.ts и не в бандле — только переменные окружения
 * (build-time секрет, как GIGACHAT_*).
 */

export type ApiProvider = 'moysklad' | 'onec' | 'bitrix' | 'insales' | 'retailcrm';

export interface ApiCredentials {
  /** Bearer-токен (МойСклад, RetailCRM-ключ и т.п.) */
  token?: string;
  /** Логин (Basic-auth: МойСклад, InSales) */
  login?: string;
  /** Пароль / секрет */
  password?: string;
  /** Готовый webhook-URL c ключом (Битрикс) */
  webhookUrl?: string;
}

export interface ApiAdapterOptions {
  /** Базовый URL аккаунта/сервиса (из site.config.ts → catalog.url) */
  baseUrl: string;
  credentials: ApiCredentials;
}

/** Какие env-переменные читать для каждого провайдера и какие из них обязательны. */
interface EnvFieldSpec {
  env: string;
  field: keyof ApiCredentials;
  required?: boolean;
}

interface ProviderEnvSpec {
  /** Группы «или» — достаточно, чтобы сработала хотя бы одна полностью заполненная группа. */
  groups: EnvFieldSpec[][];
  /** Подсказка, если ничего не задано. */
  hint: string;
}

export const PROVIDER_ENV: Record<ApiProvider, ProviderEnvSpec> = {
  moysklad: {
    groups: [
      [{ env: 'MOYSKLAD_TOKEN', field: 'token', required: true }],
      [
        { env: 'MOYSKLAD_LOGIN', field: 'login', required: true },
        { env: 'MOYSKLAD_PASSWORD', field: 'password', required: true },
      ],
    ],
    hint: 'Задайте MOYSKLAD_TOKEN (рекомендуется) или MOYSKLAD_LOGIN + MOYSKLAD_PASSWORD.',
  },
  onec: {
    groups: [
      [
        { env: 'ONEC_LOGIN', field: 'login', required: true },
        { env: 'ONEC_PASSWORD', field: 'password', required: true },
      ],
    ],
    hint: 'Задайте ONEC_LOGIN + ONEC_PASSWORD (пользователь OData-сервиса 1С).',
  },
  bitrix: {
    groups: [[{ env: 'BITRIX_WEBHOOK_URL', field: 'webhookUrl', required: true }]],
    hint: 'Задайте BITRIX_WEBHOOK_URL (входящий вебхук с правом catalog).',
  },
  insales: {
    groups: [
      [
        { env: 'INSALES_API_KEY', field: 'login', required: true },
        { env: 'INSALES_PASSWORD', field: 'password', required: true },
      ],
    ],
    hint: 'Задайте INSALES_API_KEY + INSALES_PASSWORD (пароль приложения).',
  },
  retailcrm: {
    groups: [[{ env: 'RETAILCRM_API_KEY', field: 'token', required: true }]],
    hint: 'Задайте RETAILCRM_API_KEY.',
  },
};

/** Собирает учётные данные из env; кидает понятную ошибку, если ключей нет. */
export function resolveCredentials(provider: ApiProvider): ApiCredentials {
  const spec = PROVIDER_ENV[provider];

  for (const group of spec.groups) {
    const creds: ApiCredentials = {};
    let complete = true;

    for (const { env, field, required } of group) {
      const value = process.env[env]?.trim();
      if (value) {
        creds[field] = value;
      } else if (required) {
        complete = false;
      }
    }

    if (complete && Object.keys(creds).length > 0) {
      return creds;
    }
  }

  throw new Error(`Нет ключей для источника "${provider}". ${spec.hint}`);
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

/** fetch JSON с таймаутом, ретраями и нормализацией ошибок. */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { headers = {}, method = 'GET', body, timeoutMs = 20_000, retries = 2 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: { Accept: 'application/json', ...headers },
        body,
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(500 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(
    `Запрос к API не удался (${url}): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function basicAuthHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
