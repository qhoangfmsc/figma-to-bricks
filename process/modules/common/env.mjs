// .env is the one site. Staging or local is whichever WP_URL is written there. The shell wins over the file.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readEnvFile(name, target) {
  let text;
  try { text = readFileSync(ROOT + name, 'utf8'); } catch { return; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (!m || m[1] in process.env) continue;
    if (m[1] in target) continue;
    target[m[1]] = m[2];
  }
}

export const env = { ...process.env };
readEnvFile('.env', env);

export const SITE_KEYS = ['WP_URL', 'WP_USER', 'WP_PASSWORD', 'FIGMA_TOKEN', 'MCP_TOKEN'];

export function need(key, hint) {
  if (!env[key]) throw new Error(`Missing ${key}. ${hint ?? 'Add it to .env'}`);
  return env[key];
}

export function requireSiteEnv(source = env) {
  const missing = SITE_KEYS.filter((key) => !String(source[key] ?? '').trim());
  if (missing.length) {
    throw new Error(`Missing ${missing.join(', ')}. Set them in .env for the site you are on.`);
  }
}

export function siteUrl() {
  return new URL(need('WP_URL', 'Set WP_URL in .env to the site you are on.'));
}

export function isLocalSite(url = siteUrl()) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}
