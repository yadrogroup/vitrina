import sharp from 'sharp';
import {
  AutoProcessor,
  RawImage,
  SiglipVisionModel,
  env,
} from '@huggingface/transformers';

export const CLIP_MODEL_ID = 'Xenova/siglip-base-patch16-224';

export function configureClipEnv(modelsCache) {
  env.localModelPath = modelsCache;
  env.cacheDir = modelsCache;
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
}

function l2Normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

function tensorToNormalizedVector(tensor) {
  const normalized = tensor.normalize(2, -1);
  return l2Normalize(Array.from(normalized.data));
}

async function loadRawImageFromBuffer(buffer) {
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, info.channels);
}

export async function loadVisionModels(modelsCache) {
  configureClipEnv(modelsCache);
  const [visionModel, processor] = await Promise.all([
    SiglipVisionModel.from_pretrained(CLIP_MODEL_ID, { dtype: 'fp32' }),
    AutoProcessor.from_pretrained(CLIP_MODEL_ID),
  ]);
  return { visionModel, processor };
}

export async function embedImageBuffer(models, buffer) {
  const image = await loadRawImageFromBuffer(buffer);
  const inputs = await models.processor(image);
  const { pooler_output } = await models.visionModel(inputs);
  return tensorToNormalizedVector(pooler_output);
}
