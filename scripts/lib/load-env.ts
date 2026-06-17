import { loadEnvFile } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let loaded = false;

/** Загружает `.env` из корня проекта (Node 22+). */
export function loadProjectEnv(): void {
  if (loaded) return;

  try {
    loadEnvFile(path.join(ROOT, '.env'));
  } catch {
    // .env необязателен
  }

  loaded = true;
}

export function getProjectRootFromLib(): string {
  return ROOT;
}
