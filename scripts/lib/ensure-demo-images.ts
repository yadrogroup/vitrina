import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getProducts } from '../../src/lib/catalog';

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

function colorForPath(relativePath: string): string {
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

/** Создаёт placeholder-фото для путей из каталога, если файлов нет на диске. */
export async function ensureCatalogDemoImages(root: string): Promise<string[]> {
  const demoDir = path.join(root, 'public', 'demo');
  await mkdir(demoDir, { recursive: true });

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

    const background = colorForPath(fileName);
    await sharp({
      create: {
        width: 960,
        height: 720,
        channels: 3,
        background,
      },
    })
      .jpeg({ quality: 88 })
      .toFile(target);

    created.push(url);
  }

  return created;
}
