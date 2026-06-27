/**
 * Сервер админки Vitrina. Запускается на сервере клиента рядом с сайтом.
 *   ADMIN_PASSWORD=...  PORT=8790  node server.mjs
 * Доступ: http://<домен>/admin (через nginx-прокси, см. ADMIN.md).
 */

import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import {
  openDb, listProducts, getProduct, upsertProduct, deleteProduct, listCategories, countProducts,
} from './db.mjs';
import {
  checkPassword, issueToken, isAuthed, sessionCookie, clearedCookie,
} from './auth.mjs';
import { publish, getStatus } from './rebuild.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(DIR, '..');
const PORT = Number(process.env.PORT || 8790);
const DB_PATH = process.env.ADMIN_DB_PATH
  ? path.resolve(PROJECT_ROOT, process.env.ADMIN_DB_PATH)
  : path.join(PROJECT_ROOT, 'data', 'admin.sqlite');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'public', 'uploads');

mkdirSync(UPLOADS_DIR, { recursive: true });
const db = openDb(DB_PATH);

const app = express();
app.use(express.json({ limit: '1mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// --- авторизация ---
app.post('/api/login', (req, res) => {
  try {
    if (!checkPassword(req.body?.password)) {
      return res.status(401).json({ ok: false, error: 'Неверный пароль' });
    }
    res.setHeader('Set-Cookie', sessionCookie(issueToken()));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearedCookie());
  res.json({ ok: true });
});

// гард на всё под /api, кроме логина
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') return next();
  if (!isAuthed(req)) return res.status(401).json({ ok: false, error: 'Требуется вход' });
  next();
});

// --- товары ---
app.get('/api/products', (_req, res) => {
  res.json({ ok: true, products: listProducts(db), count: countProducts(db) });
});

app.get('/api/products/:id', (req, res) => {
  const product = getProduct(db, req.params.id);
  if (!product) return res.status(404).json({ ok: false, error: 'Товар не найден' });
  res.json({ ok: true, product });
});

app.post('/api/products', (req, res) => {
  try {
    res.json({ ok: true, product: upsertProduct(db, req.body || {}) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  res.json({ ok: deleteProduct(db, req.params.id) });
});

app.get('/api/categories', (_req, res) => {
  res.json({ ok: true, categories: listCategories(db) });
});

// --- загрузка фото: ресайз в webp, сохранение в public/uploads ---
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Файл не получен' });
  try {
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(UPLOADS_DIR, name));
    res.json({ ok: true, url: `/uploads/${name}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: `Не удалось обработать изображение: ${err.message}` });
  }
});

// --- публикация ---
app.post('/api/publish', (req, res) => {
  if (getStatus().running) return res.json({ ok: true, status: getStatus() });
  void publish({ skipEmbed: req.body?.skipEmbed === true, skipBuild: req.body?.skipBuild === true });
  res.json({ ok: true, status: getStatus() });
});

app.get('/api/publish/status', (_req, res) => res.json({ ok: true, status: getStatus() }));

// --- статика загруженных фото (для предпросмотра до сборки) ---
app.use('/uploads', express.static(UPLOADS_DIR));

// --- статика UI ---
app.use('/', express.static(path.join(DIR, 'public')));

app.listen(PORT, () => {
  console.log(`[admin] http://127.0.0.1:${PORT}  (БД: ${DB_PATH})`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[admin] ВНИМАНИЕ: ADMIN_PASSWORD не задан — вход работать не будет.');
  }
});
