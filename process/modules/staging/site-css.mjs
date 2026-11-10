// Shared look of the site in WP_URL, kept in this repo and copied into local uploads.
// Bricks loads these four files from wp-content/uploads/bricks/css when CSS loading is External files.
// The class registry itself is not on the staging MCP. Pull reads the public CSS files and the
// homepage inline global classes, which is the part a page actually paints.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, env, requireSiteEnv } from '../common/env.mjs';

export const SNAPSHOT_DIR = fileURLToPath(new URL('./site-css/', import.meta.url));
export const LOCAL_CSS_DIR = join(ROOT, 'wp-content/uploads/bricks/css');

// Staging inlines these two style tags. There is no global-custom-css.min.css on that site (404).
const CLASS_STYLE_IDS = ['bricks-global-classes-inline-inline-css', 'bricks-frontend-inline-inline-css'];

// Local file name is the one includes/assets/files.php enqueues.
const FILES = [
  { snapshot: 'color-palettes.css', local: 'color-palettes.min.css', remote: 'color-palettes.min.css' },
  { snapshot: 'global-variables.css', local: 'global-variables.min.css', remote: 'global-variables.min.css' },
  { snapshot: 'global-elements.css', local: 'global-elements.min.css', remote: 'global-elements.min.css' },
  { snapshot: 'global-classes.css', local: 'global-custom-css.min.css', remote: null },
];

export function siteOrigin(source = env) {
  const wp = source.WP_URL;
  if (!wp) fail('Set WP_URL in .env to the site you are on.');
  return new URL(wp).origin;
}

// The palette file repeats names. A later declaration wins in CSS, so the snapshot keeps one of each.
export function normalizePalette(css) {
  const pairs = [...css.matchAll(/(--bricks-color-[a-z0-9]+)\s*:\s*([^;}]+)/g)];
  if (!pairs.length) fail('Color palette from WP_URL has no --bricks-color variables');
  const order = [];
  const last = new Map();
  for (const [, name, value] of pairs) {
    if (!last.has(name)) order.push(name);
    last.set(name, value.trim());
  }
  return {
    css: `:root {${order.map((name) => `${name}: ${last.get(name)};`).join('')}}\n`,
    declarations: pairs.length,
    unique: order.length,
  };
}

export function extractGlobalClasses(html) {
  const parts = [];
  for (const [, attrs, body] of html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/gi)) {
    if (!CLASS_STYLE_IDS.some((id) => attrs.includes(id))) continue;
    const cleaned = body.replace(/\/\*# sourceURL=[^*]*\*\//g, '').trim();
    if (cleaned) parts.push(cleaned);
  }
  if (!parts.length) fail('Staging homepage has no Bricks global class styles');
  return `${parts.join('\n')}\n`;
}

export function applySiteCss(snapshotDir = SNAPSHOT_DIR, uploadsDir = LOCAL_CSS_DIR) {
  mkdirSync(uploadsDir, { recursive: true });
  const written = [];
  for (const file of FILES) {
    const css = readFileSync(join(snapshotDir, file.snapshot), 'utf8');
    if (!css.trim()) fail(`Snapshot ${file.snapshot} is empty`);
    writeFileSync(join(uploadsDir, file.local), css);
    written.push(file.local);
  }
  return written;
}

export async function pullSiteCss({ origin = siteOrigin(), fetchImpl = fetch, snapshotDir = SNAPSHOT_DIR, now = () => new Date() } = {}) {
  const base = `${origin}/wp-content/uploads/bricks/css`;
  const paletteRaw = await textFrom(`${base}/color-palettes.min.css`, fetchImpl);
  const variables = await textFrom(`${base}/global-variables.min.css`, fetchImpl);
  const elements = await textFrom(`${base}/global-elements.min.css`, fetchImpl);
  const home = await textFrom(`${origin}/`, fetchImpl);
  const palette = normalizePalette(paletteRaw);
  const classes = extractGlobalClasses(home);
  mkdirSync(snapshotDir, { recursive: true });
  const written = {
    'color-palettes.css': palette.css,
    'global-variables.css': ensureTrailingNewline(variables),
    'global-elements.css': ensureTrailingNewline(elements),
    'global-classes.css': classes,
  };
  for (const [name, css] of Object.entries(written)) writeFileSync(join(snapshotDir, name), css);
  const manifest = {
    origin,
    fetchedAt: now().toISOString(),
    palette: { declarations: palette.declarations, unique: palette.unique },
    files: FILES.map((file) => ({ snapshot: file.snapshot, local: file.local, remote: file.remote })),
    classStyleIds: CLASS_STYLE_IDS,
    limit: 'bricks_global_classes is not on the staging MCP. A class id that only appears inside one template stays in that template CSS.',
  };
  writeFileSync(join(snapshotDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function ensureTrailingNewline(css) {
  const text = css.trim();
  if (!text) fail('Shared CSS file from WP_URL was empty');
  return text.endsWith('\n') ? text : `${text}\n`;
}

async function textFrom(url, fetchImpl) {
  const res = await fetchImpl(url);
  if (!res.ok) fail(`${url} returned ${res.status}`);
  return res.text();
}

function fail(message) {
  const error = new Error(message);
  error.code = 'STAGING_CSS';
  throw error;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  requireSiteEnv();
  const command = process.argv[2];
  const run = command === 'pull' ? pullSiteCss() : command === 'apply' ? Promise.resolve(applySiteCss()) : null;
  if (!run) {
    console.error('Use: node process/modules/staging/site-css.mjs pull|apply');
    process.exit(1);
  }
  run.then((result) => {
    console.log(command === 'pull' ? `pulled ${result.origin} at ${result.fetchedAt}` : `applied ${result.join(', ')}`);
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
