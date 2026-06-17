import { CLIP_MODEL_ID, MODELS_BASE_PATH } from '../lib/search/config';
import { l2Normalize } from '../lib/search/math';

type ProgressHandler = (message: string) => void;

interface TextModels {
  model: Awaited<
    ReturnType<typeof import('@huggingface/transformers').SiglipTextModel.from_pretrained>
  >;
  tokenizer: Awaited<
    ReturnType<typeof import('@huggingface/transformers').AutoTokenizer.from_pretrained>
  >;
}

interface VisionModels {
  model: Awaited<
    ReturnType<typeof import('@huggingface/transformers').SiglipVisionModel.from_pretrained>
  >;
  processor: Awaited<
    ReturnType<typeof import('@huggingface/transformers').AutoProcessor.from_pretrained>
  >;
}

let textModelsPromise: Promise<TextModels> | null = null;
let visionModelsPromise: Promise<VisionModels> | null = null;

function configureBrowserEnv(env: typeof import('@huggingface/transformers').env): void {
  env.localModelPath = MODELS_BASE_PATH;
  env.cacheDir = MODELS_BASE_PATH;
  env.allowRemoteModels = false;
  env.useBrowserCache = true;
}

function createProgressHandler(onProgress?: ProgressHandler) {
  return (data: { status: string; file?: string }) => {
    if (data.status === 'progress' && data.file) {
      onProgress?.(`Загрузка ${data.file}…`);
    }
  };
}

function tensorToVector(tensor: {
  data: Float32Array | number[];
  normalize: (p: number, dim: number) => unknown;
}): number[] {
  const normalized = tensor.normalize(2, -1) as { data: Float32Array | number[] };
  return l2Normalize(Array.from(normalized.data));
}

async function loadTextModels(onProgress?: ProgressHandler): Promise<TextModels> {
  const { SiglipTextModel, AutoTokenizer, env } = await import('@huggingface/transformers');
  configureBrowserEnv(env);
  onProgress?.('Загрузка text-encoder…');

  const progress_callback = createProgressHandler(onProgress);
  const [model, tokenizer] = await Promise.all([
    SiglipTextModel.from_pretrained(CLIP_MODEL_ID, { progress_callback }),
    AutoTokenizer.from_pretrained(CLIP_MODEL_ID, { progress_callback }),
  ]);

  return { model, tokenizer };
}

async function loadVisionModels(onProgress?: ProgressHandler): Promise<VisionModels> {
  const { SiglipVisionModel, AutoProcessor, env } = await import('@huggingface/transformers');
  configureBrowserEnv(env);
  onProgress?.('Загрузка image-encoder…');

  const progress_callback = createProgressHandler(onProgress);
  const [model, processor] = await Promise.all([
    SiglipVisionModel.from_pretrained(CLIP_MODEL_ID, { progress_callback }),
    AutoProcessor.from_pretrained(CLIP_MODEL_ID, { progress_callback }),
  ]);

  return { model, processor };
}

export async function embedTextQuery(
  text: string,
  onProgress?: ProgressHandler,
): Promise<number[]> {
  if (!textModelsPromise) {
    textModelsPromise = loadTextModels(onProgress);
  }

  const { model, tokenizer } = await textModelsPromise;
  onProgress?.('Анализирую запрос…');

  const inputs = tokenizer([text], { padding: true, truncation: true });
  const { pooler_output } = await model(inputs);
  return tensorToVector(pooler_output);
}

export async function embedImageBlob(
  file: Blob,
  onProgress?: ProgressHandler,
): Promise<number[]> {
  if (!visionModelsPromise) {
    visionModelsPromise = loadVisionModels(onProgress);
  }

  const { model, processor } = await visionModelsPromise;
  onProgress?.('Анализирую фото…');

  const { RawImage } = await import('@huggingface/transformers');
  const image = await RawImage.fromBlob(file);
  const inputs = await processor(image);
  const { pooler_output } = await model(inputs);
  return tensorToVector(pooler_output);
}

export function preloadTextEncoder(onProgress?: ProgressHandler): void {
  if (!textModelsPromise) {
    textModelsPromise = loadTextModels(onProgress);
  }
}
