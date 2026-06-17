import { randomUUID } from 'node:crypto';

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const DEFAULT_MODEL = 'GigaChat';
const DEFAULT_SCOPE = 'GIGACHAT_API_PERS';

interface OAuthResponse {
  access_token: string;
  expires_at?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function gigachatFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const previousTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  if (process.env.GIGACHAT_TLS_INSECURE === '1') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  try {
    return await fetch(url, init);
  } finally {
    if (process.env.GIGACHAT_TLS_INSECURE === '1') {
      if (previousTls === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTls;
      }
    }
  }
}

async function getAccessToken(apiKey: string, scope: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const response = await gigachatFetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${apiKey}`,
      RqUID: randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ scope }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GigaChat OAuth ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as OAuthResponse;
  if (!data.access_token) {
    throw new Error('GigaChat OAuth: access_token не получен');
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: data.expires_at ? data.expires_at : now + 30 * 60 * 1000,
  };

  return data.access_token;
}

function getGigaChatAuthKey(): string | undefined {
  return (process.env.GIGACHAT_AUTH_KEY || process.env.GIGACHAT_API_KEY)?.trim();
}

export async function gigachatComplete(prompt: string): Promise<string> {
  const apiKey = getGigaChatAuthKey();
  if (!apiKey) {
    throw new Error('GIGACHAT_AUTH_KEY (или GIGACHAT_API_KEY) не задан');
  }

  const scope = process.env.GIGACHAT_SCOPE?.trim() || DEFAULT_SCOPE;
  const model = process.env.GIGACHAT_MODEL?.trim() || DEFAULT_MODEL;
  const token = await getAccessToken(apiKey, scope);

  const response = await gigachatFetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GigaChat chat ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('GigaChat вернул пустой ответ');
  }

  return content;
}

export function hasGigaChatCredentials(): boolean {
  return Boolean(getGigaChatAuthKey());
}
