import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getProducts } from '../../src/lib/catalog';

const ATTRIBUTE_COLORS: Record<string, string> = {
  'чёрный': '#1c1c1c',
  'черный': '#1c1c1c',
  'серый': '#8a8a8a',
  'молочный': '#f3efe6',
  'бежевый': '#c9b896',
  'натуральный': '#c4a574',
  'орех': '#8b5a2b',
  'белый': '#f5f5f5',
};

const PALETTE: Record<string, string> = {
  sofa: '#8a8a8a',
  bed: '#a67c52',
  armchair: '#6b8e7f',
  wardrobe: '#5c6b7a',
  shelf: '#9a8b7a',
  set: '#c4b5a0',
  interior: '#d4c4a8',
  default: '#b0a99f',
};

function buildDemoColorMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const product of getProducts()) {
    const color = product.attributes?.color;
    const hex = typeof color === 'string' ? ATTRIBUTE_COLORS[color.toLowerCase()] : undefined;
    if (!hex) continue;

    for (const image of product.images) {
      if (image.startsWith('/demo/')) map.set(image, hex);
    }

    for (const variant of product.variants ?? []) {
      const variantColor = variant.attributes?.color;
      const variantHex =
        typeof variantColor === 'string' ? ATTRIBUTE_COLORS[variantColor.toLowerCase()] : undefined;
      if (variant.image?.startsWith('/demo/') && variantHex) {
        map.set(variant.image, variantHex);
      }
    }
  }

  return map;
}

function colorForPath(relativePath: string, colorMap: Map<string, string>): string {
  const url = relativePath.startsWith('/demo/') ? relativePath : `/demo/${relativePath}`;
  const mapped = colorMap.get(url);
  if (mapped) return mapped;

  const name = path.basename(relativePath, path.extname(relativePath)).toLowerCase();
  if (name.includes('sofa')) return PALETTE.sofa;
  if (name.includes('bed')) return PALETTE.bed;
  if (name.includes('armchair')) return PALETTE.armchair;
  if (name.includes('wardrobe')) return PALETTE.wardrobe;
  if (name.includes('shelf')) return PALETTE.shelf;
  if (name.startsWith('set-')) return PALETTE.set;
  if (name.includes('interior')) return PALETTE.interior;
  return PALETTE.default;
}

/** Создаёт placeholder-фото для путей из каталога. */
export async function ensureCatalogDemoImages(root: string): Promise<string[]> {
  const demoDir = path.join(root, 'public', 'demo');
  await mkdir(demoDir, { recursive: true });

  const colorMap = buildDemoColorMap();
  const paths = new Set<string>();

  for (const product of getProducts()) {
    for (const image of product.images) {
      if (image.startsWith('/demo/')) paths.add(image);
    }
    for (const variant of product.variants ?? []) {
      if (variant.image?.startsWith('/demo/')) paths.add(variant.image);
    }
  }

  const created: string[] = [];

  for (const url of paths) {
    const fileName = url.replace('/demo/', '');
    const target = path.join(demoDir, fileName);

    try {
      await sharp(target).metadata();
      continue;
    } catch {
      // файла нет — создаём
    }

    const background = colorForPath(fileName, colorMap);

    await sharp({
      create: {
        width: 960,
        height: 720,
        channels: 3,
        background,
      },
    })
      .webp({ quality: 82 })
      .toFile(target);

    created.push(url);
  }

  return created;
}
