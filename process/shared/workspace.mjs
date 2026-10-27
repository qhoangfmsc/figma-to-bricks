// One workspace per Figma node:  process/work/<fileKey>/<nodeId with ->/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFigmaUrl } from '../figma/url.mjs';

const WORK = fileURLToPath(new URL('../work/', import.meta.url));

export function resolveWorkspace(arg) {
  if (!arg) throw new Error('Pass a Figma URL or a workspace directory');
  let dir, ref = null;
  if (/^https?:\/\//.test(arg)) {
    ref = parseFigmaUrl(arg);
    dir = join(WORK, ref.fileKey, ref.nodeId.replace(':', '-'));
  } else {
    dir = resolve(arg);
    if (!existsSync(dir)) throw new Error(`Workspace not found: ${dir}`);
  }
  mkdirSync(dir, { recursive: true });
  if (!ref && existsSync(join(dir, 'meta.json'))) ref = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const file = (name) => join(dir, name);
  return {
    dir, ref, file,
    has: (name) => existsSync(file(name)),
    readJson: (name, fallback) => {
      if (!existsSync(file(name))) {
        if (fallback !== undefined) return fallback;
        throw new Error(`Missing ${name} in ${dir}. Run the previous step first.`);
      }
      return JSON.parse(readFileSync(file(name), 'utf8'));
    },
    writeJson: (name, data) => writeFileSync(file(name), JSON.stringify(data, null, 2) + '\n'),
    writeText: (name, text) => writeFileSync(file(name), text),
  };
}

export const safeId = (id) => id.replace(/[^A-Za-z0-9_-]/g, '_');
