// .env is the shared site config. .env.local overrides it on this machine. The shell wins over both.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readEnvFile(name, target, override) {
  let text;
  try { text = readFileSync(ROOT + name, 'utf8'); } catch { return; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (!m || m[1] in process.env) continue;
    if (!override && m[1] in target) continue;
    target[m[1]] = m[2];
  }
}

export const env = { ...process.env };
readEnvFile('.env', env, false);
readEnvFile('.env.local', env, true);

export function need(key, hint) {
  if (!env[key]) throw new Error(`Missing ${key}. ${hint ?? 'Add it to .env'}`);
  return env[key];
}

export function siteUrl() {
  return new URL(need('WP_URL', 'Set WP_URL in .env to the local site or staging.'));
}

// A container cannot open the host's localhost. Staging is reached by its own host name.
export function isLocalSite(url = siteUrl()) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}
