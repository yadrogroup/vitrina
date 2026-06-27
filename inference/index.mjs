import { embedImageBuffer, loadVisionModels } from './lib/clip.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const MODELS_CACHE =
  process.env.MODELS_CACHE || '/opt/vitrina-demo/dist/models/.cache';

let modelsPromise = null;

function getModels() {
  if (!modelsPromise) {
    modelsPromise = loadVisionModels(MODELS_CACHE);
  }
  return modelsPromise;
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}

export async function warmUp() {
  await getModels();
}

export async function handler({ method, bodyBuffer, contentType }) {
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Допустим только POST' });
  }

  if (!bodyBuffer?.length) {
    return jsonResponse(400, { ok: false, error: 'Пустое тело запроса' });
  }

  if (!contentType?.startsWith('image/')) {
    return jsonResponse(400, { ok: false, error: 'Ожидается изображение' });
  }

  try {
    const models = await getModels();
    const vector = await embedImageBuffer(models, bodyBuffer);
    return jsonResponse(200, { ok: true, vector });
  } catch (error) {
    console.error('[inference] error:', error);
    return jsonResponse(500, { ok: false, error: 'Не удалось обработать фото' });
  }
}
