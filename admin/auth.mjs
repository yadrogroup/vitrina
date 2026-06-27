/**
 * Минимальная авторизация админки: один пароль (ADMIN_PASSWORD),
 * сессия — подписанная HMAC кука (ADMIN_SECRET). Без внешних зависимостей.
 */

import crypto from 'node:crypto';

const COOKIE = 'vitrina_admin';
const TTL_MS = 1000 * 60 * 60 * 12; // 12 часов

function secret() {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'change-me-in-production';
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueToken() {
  const expires = Date.now() + TTL_MS;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, mac] = token.split('.');
  const expected = sign(payload);
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  return Number(payload) > Date.now();
}

export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) throw new Error('ADMIN_PASSWORD не задан — вход невозможен');
  const a = Buffer.from(String(input));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function sessionCookie(token) {
  const secure = process.env.ADMIN_COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TTL_MS / 1000}${secure}`;
}

export function clearedCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function isAuthed(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifyToken(cookies[COOKIE]);
}

export { COOKIE };
