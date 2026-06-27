import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  AutoProcessor,
  AutoTokenizer,
  SiglipTextModel,
  SiglipVisionModel,
  env,
} from '@huggingface/transformers';
import { CLIP_MODEL_ID } from '../../src/lib/search/config';
import { l2Normalize } from '../../src/lib/search/math';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODELS_CACHE = path.join(SCRIPT_ROOT, 'public', 'models', '.cache');

export function getProjectRoot(): string {
  return SCRIPT_ROOT;
}

export function configureNodeClipEnv(allowRemote: boolean): void {
  env.localModelPath = MODELS_CACHE;
  env.cacheDir = MODELS_CACHE;
  env.allowLocalModels = true;
  env.allowRemoteModels = allowRemote;
  env.useBrowserCache = false;
}

export interface ClipModels {
  visionModel: Awaited<ReturnType<typeof SiglipVisionModel.from_pretrained>>;
  textModel: Awaited<ReturnType<typeof SiglipTextModel.from_pretrained>>;
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
}

export async function loadClipModels(
  progress?: (progress: { status: string; file?: string; progress?: number }) => void,
): Promise<ClipModels> {
  const progress_callback = progress
    ? (data: { status: string; file?: string; progress?: number }) => progress(data)
    : undefined;

  const [visionModel, textModel, processor, tokenizer] = await Promise.all([
    SiglipVisionModel.from_pretrained(CLIP_MODEL_ID, { progress_callback, dtype: 'fp32' }),
    SiglipTextModel.from_pretrained(CLIP_MODEL_ID, { progress_callback, dtype: 'fp32' }),
    AutoProcessor.from_pretrained(CLIP_MODEL_ID, { progress_callback }),
    AutoTokenizer.from_pretrained(CLIP_MODEL_ID, { progress_callback }),
  ]);

  return { visionModel, textModel, processor, tokenizer };
}

function tensorToNormalizedVector(tensor: {
  data: Float32Array | number[];
  normalize: (p: number, dim: number) => unknown;
}): number[] {
  const normalized = tensor.normalize(2, -1) as { data: Float32Array | number[] };
  return l2Normalize(Array.from(normalized.data));
}

export async function embedImageWithClip(
  models: ClipModels,
  source: string | Buffer,
): Promise<number[]> {
  const { RawImage } = await import('@huggingface/transformers');
  const image = await loadRawImage(source, RawImage);
  const inputs = await models.processor(image);
  const { pooler_output } = await models.visionModel(inputs);
  return tensorToNormalizedVector(pooler_output);
}

async function loadRawImage(
  source: string | Buffer,
  RawImage: typeof import('@huggingface/transformers').RawImage,
): Promise<InstanceType<typeof RawImage>> {
  if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
    return RawImage.read(source);
  }

  const filePath =
    typeof source === 'string' && source.startsWith('/')
      ? path.join(SCRIPT_ROOT, 'public', source.slice(1))
      : typeof source === 'string' && path.isAbsolute(source)
        ? source
        : typeof source === 'string'
          ? path.join(SCRIPT_ROOT, source)
          : null;

  const input = Buffer.isBuffer(source)
    ? sharp(source, { failOn: 'none' })
    : sharp(filePath!, { failOn: 'none' });

  const { data, info } = await input
    .rotate()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, info.channels);
}

export async function embedTextWithClip(models: ClipModels, text: string): Promise<number[]> {
  const inputs = models.tokenizer([text], { padding: true, truncation: true });
  const { pooler_output } = await models.textModel(inputs);
  return tensorToNormalizedVector(pooler_output);
}

export async function resolveImageSource(url: string): Promise<string | Buffer | null> {
  if (!url) return null;

  if (url.startsWith('/')) {
    return url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  return url;
}
