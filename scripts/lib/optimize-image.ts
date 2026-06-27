import path from 'node:path';
import sharp from 'sharp';

export const WEBP_MAX_WIDTH = 1200;
export const WEBP_QUALITY = 82;
export const WEBP_ASPECT = 4 / 3;

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Доли от размера после autorotate (0–1). */
export interface CropFractions {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OptimizeResult {
  outputPath: string;
  width: number;
  height: number;
  bytes: number;
}

function toCropRect(
  width: number,
  height: number,
  crop: CropRect | CropFractions,
): CropRect {
  if ('left' in crop && crop.left <= 1 && crop.width <= 1 && crop.height <= 1) {
    const fractions = crop as CropFractions;
    return {
      left: Math.round(width * fractions.left),
      top: Math.round(height * fractions.top),
      width: Math.round(width * fractions.width),
      height: Math.round(height * fractions.height),
    };
  }
  return crop as CropRect;
}

/** Кроп по центру 4:3, resize, WebP. */
export async function optimizeImageToWebp(
  inputPath: string,
  outputPath: string,
  preCrop?: CropRect | CropFractions,
): Promise<OptimizeResult> {
  const baseMeta = await sharp(inputPath, { failOn: 'none' }).rotate().metadata();
  const baseWidth = baseMeta.width ?? WEBP_MAX_WIDTH;
  const baseHeight = baseMeta.height ?? Math.round(WEBP_MAX_WIDTH / WEBP_ASPECT);

  let image = sharp(inputPath, { failOn: 'none' }).rotate();
  if (preCrop) {
    const rect = toCropRect(baseWidth, baseHeight, preCrop);
    const safe = {
      left: Math.max(0, Math.min(rect.left, baseWidth - 1)),
      top: Math.max(0, Math.min(rect.top, baseHeight - 1)),
      width: Math.min(rect.width, baseWidth - Math.max(0, Math.min(rect.left, baseWidth - 1))),
      height: Math.min(rect.height, baseHeight - Math.max(0, Math.min(rect.top, baseHeight - 1))),
    };
    image = image.extract(safe);
  }

  let width = baseWidth;
  let height = baseHeight;
  if (preCrop) {
    const rect = toCropRect(baseWidth, baseHeight, preCrop);
    width = Math.min(rect.width, baseWidth - rect.left);
    height = Math.min(rect.height, baseHeight - rect.top);
  }

  const targetHeight = Math.round(width / WEBP_ASPECT);
  let pipeline = image;

  if (height > targetHeight) {
    const top = Math.floor((height - targetHeight) / 2);
    pipeline = pipeline.extract({ left: 0, top, width, height: targetHeight });
  } else if (height < targetHeight) {
    const targetWidth = Math.round(height * WEBP_ASPECT);
    const left = Math.floor((width - targetWidth) / 2);
    pipeline = pipeline.extract({ left, top: 0, width: targetWidth, height });
  }

  const result = await pipeline
    .resize(WEBP_MAX_WIDTH, Math.round(WEBP_MAX_WIDTH / WEBP_ASPECT), {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toFile(outputPath);

  return {
    outputPath,
    width: result.width,
    height: result.height,
    bytes: result.size,
  };
}

export function demoWebpPath(demoDir: string, basename: string): string {
  return path.join(demoDir, `${basename}.webp`);
}
