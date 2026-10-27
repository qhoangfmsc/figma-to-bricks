// Loads <repo>/.env (KEY=value, optional quotes) into an object; process env wins.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const env = { ...process.env };
try {
  for (const line of readFileSync(ROOT + '.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
} catch {}

export function need(key, hint) {
  if (!env[key]) throw new Error(`Missing ${key}. ${hint ?? 'Add it to .env'}`);
  return env[key];
}
