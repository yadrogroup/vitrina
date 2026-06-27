/**
 * Пересборка сайта из админки. «Опубликовать» = sync (source=db) → embed → build.
 * Запускается как дочерний процесс; статус опрашивается из UI.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

let state = { running: false, step: null, startedAt: null, finishedAt: null, ok: null, log: [] };

export function getStatus() {
  return { ...state, log: state.log.slice(-40) };
}

function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      shell: false,
    });
    const push = (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) state.log.push(line.trim());
      }
    };
    child.stdout.on('data', push);
    child.stderr.on('data', push);
    child.on('close', (code) => resolve(code === 0));
    child.on('error', (err) => {
      state.log.push(`Ошибка запуска ${command}: ${err.message}`);
      resolve(false);
    });
  });
}

/** Шаги пересборки. embed/build пропускаются флагами для быстрых прогонов. */
export async function publish({ skipEmbed = false, skipBuild = false } = {}) {
  if (state.running) return getStatus();

  state = { running: true, step: 'sync', startedAt: new Date().toISOString(), finishedAt: null, ok: null, log: [] };
  const env = { CATALOG_SOURCE: 'db' };

  try {
    state.step = 'sync';
    if (!(await run('npm', ['run', 'sync'], env))) throw new Error('sync');

    if (!skipEmbed) {
      state.step = 'embed';
      if (!(await run('npm', ['run', 'embed'], env))) throw new Error('embed');
    }

    if (!skipBuild) {
      state.step = 'build';
      if (!(await run('npm', ['run', 'build'], env))) throw new Error('build');
    }

    state.ok = true;
    state.step = 'done';
  } catch (err) {
    state.ok = false;
    state.step = `failed:${err.message}`;
  } finally {
    state.running = false;
    state.finishedAt = new Date().toISOString();
  }

  return getStatus();
}
