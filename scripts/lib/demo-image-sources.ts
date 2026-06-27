import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Группа фото товара: все файлы из папки pics/ → public/demo/<base>-N.webp */
export interface DemoProductGroup {
  productId: string;
  base: string;
  folder: string;
  /** Имя файла внутри folder — идёт первым в галерее и в embed. */
  primary: string;
  credit: string;
}

export interface DemoHeroSource {
  file: string;
  localPath: string;
  credit: string;
}

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** 15 товаров каталога ↔ папки pics/. */
export const DEMO_PRODUCT_GROUPS: DemoProductGroup[] = [
  {
    productId: '110',
    base: 'sofa-oslo',
    folder: 'pics/Диван Осло',
    primary: '74b383a17305688e4baa657600b1e26e.jpg',
    credit: 'pics/Диван Осло',
  },
  {
    productId: '111',
    base: 'sofa-loft',
    folder: 'pics/Диван Лофт',
    primary: '20788.970.jpg',
    credit: 'pics/Диван Лофт',
  },
  {
    productId: 'group-G-roma',
    base: 'sofa-roma',
    folder: 'pics/Диван «Рим»',
    primary: 'Divan_Rim_Bluvel_13_camera_5__1699972211.jpg',
    credit: 'pics/Диван «Рим»',
  },
  {
    productId: '201',
    base: 'bed-belluno',
    folder: 'pics/Кровать «Беллуно»',
    primary: 'recline-07.jpg',
    credit: 'pics/Кровать «Беллуно»',
  },
  {
    productId: '202',
    base: 'bed-bonso',
    folder: 'pics/Кровать «Бонсо»',
    primary: 'krovat_sleepart_bons.webp',
    credit: 'pics/Кровать «Бонсо»',
  },
  {
    productId: '203',
    base: 'bed-son',
    folder: 'pics/Кровать «Сон»',
    primary: 'europa.webp',
    credit: 'pics/Кровать «Сон»',
  },
  {
    productId: '301',
    base: 'armchair-scandi',
    folder: 'pics/Кресло «Сканди»',
    primary: 'gala_collezione_armchair_scandi_1280_800_f_1.jpg',
    credit: 'pics/Кресло «Сканди»',
  },
  {
    productId: '302',
    base: 'armchair-classic',
    folder: 'pics/Кресло «Классик»',
    primary: '482db55665927c294e312645c8168e83.webp',
    credit: 'pics/Кресло «Классик»',
  },
  {
    productId: '401',
    base: 'wardrobe-dual',
    folder: 'pics/Шкаф-купе «Дуал»',
    primary: '906302.webp',
    credit: 'pics/Шкаф-купе «Дуал»',
  },
  {
    productId: '402',
    base: 'wardrobe-escape',
    folder: 'pics/Шкаф «Эскейп»',
    primary: 'шкаф-купе-escape-250-cm-78620-344266.webp',
    credit: 'pics/Шкаф «Эскейп»',
  },
  {
    productId: '403',
    base: 'wardrobe-befree',
    folder: 'pics/Шкаф «Би Фри»',
    primary: 'vqxiy2bx4er4fe8g03lnercax0vpzuoz.webp',
    credit: 'pics/Шкаф «Би Фри»',
  },
  {
    productId: '501',
    base: 'shelf-norway',
    folder: 'pics/Стеллаж «Норвегия»',
    primary: 'polka_norvegiya.jpg',
    credit: 'pics/Стеллаж «Норвегия»',
  },
  {
    productId: '601',
    base: 'set-loft',
    folder: 'pics/Комплект «Гостиная Лофт»',
    primary: 'vitalnya_loft_komplekt_07.jpg',
    credit: 'pics/Комплект «Гостиная Лофт»',
  },
  {
    productId: '602',
    base: 'set-minimal',
    folder: 'pics/Комплект «Минимал»',
    primary: '48363-set-for-living-room-harley-7.jpg',
    credit: 'pics/Комплект «Минимал»',
  },
  {
    productId: '603',
    base: 'set-terra',
    folder: 'pics/Комплект «Терракота»',
    primary:
      'u4228977262_design_a_loft-style_living_room_that_showcases_in_e6b54398-7318-4a24-b1ad-c8072510c9ea_1.png.webp',
    credit: 'pics/Комплект «Терракота»',
  },
];

/** Отдельный кадр для hero на главной — не входит в галереи товаров. */
export const DEMO_HERO_SOURCE: DemoHeroSource = {
  file: 'interior-hero',
  localPath: 'pics/Диван «Рим»/Divan_Rim_Bluvel_13_camera_6__1699972212.jpg',
  credit: 'pics/Диван «Рим»',
};

export function getProjectRoot(): string {
  return ROOT;
}

export function resolveFolderPath(folder: string): string {
  return path.join(ROOT, folder);
}

export function resolveFilePath(relativePath: string): string {
  return path.join(ROOT, relativePath);
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export function sortGroupFiles(files: string[], primary: string): string[] {
  const rest = files.filter((name) => name !== primary).sort((a, b) => a.localeCompare(b, 'ru'));
  if (files.includes(primary)) return [primary, ...rest];
  return rest;
}
