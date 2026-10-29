// Figma REST API. Needs FIGMA_TOKEN (Personal Access Token, scope: file_content:read).
import { need } from '../shared/env.mjs';

const BASE = 'https://api.figma.com';

// ---- per-run cache of the READ-ONLY structure lookups (the file tree at depth N, node texts): the same request was repeated for every section of a page
// (the whole file structure 23 times). Valid for one run only (memory, nothing on disk) and tied to the file version: refreshRunCache() asks Figma for the
// current version (a tiny request) and drops everything when it changed, so a design edited during a run is never read half old, half new.
// Never cached: node geometry (raw.json of a frame) and renders.
let runCache = null; // { version, entries: Map(path -> promise) } or null when not enabled
const cacheable = (path) => /^\/v1\/files\/[^/?]+(\?depth=\d+|\/nodes\?ids=[^&]+)$/.test(path) && !path.includes('geometry');
export function enableRunCache() { runCache = { version: null, entries: new Map(), hits: 0, misses: 0 }; }
export async function refreshRunCache(fileKey) {
  if (!runCache) return;
  const { version } = await figmaGet(`/v1/files/${fileKey}?depth=1`, { skipCache: true });
  if (runCache.version && runCache.version !== version) { runCache.entries.clear(); console.log('  figma file changed during the run: structure cache dropped'); }
  runCache.version = version;
}
export const runCacheStats = () => (runCache ? { hits: runCache.hits, misses: runCache.misses } : null);

export function figmaGet(path, { retries = 4, skipCache = false } = {}) {
  if (!runCache || skipCache || !cacheable(path)) return figmaFetch(path, { retries });
  if (runCache.entries.has(path)) { runCache.hits++; return runCache.entries.get(path); }
  runCache.misses++;
  const p = figmaFetch(path, { retries });
  runCache.entries.set(path, p);
  p.catch(() => runCache.entries.delete(path)); // a failed request is not remembered
  return p;
}

async function figmaFetch(path, { retries = 4 } = {}) {
  const token = need('FIGMA_TOKEN', 'Create one at Figma > Settings > Security > Personal access tokens (scope file_content:read) and add FIGMA_TOKEN=... to .env');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BASE + path, { headers: { 'X-Figma-Token': token }, signal: AbortSignal.timeout(120000) }); // a stalled connection must fail, not hang the run
    if (res.status === 429 && attempt < retries) {
      const wait = Number(res.headers.get('retry-after') ?? 5) * 1000;
      console.error(`  figma 429, waiting ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    // a server-side hiccup ("Error retrieving file, please try again later") is retried with a growing pause; it stopped a whole section before
    if (res.status >= 500 && attempt < retries) {
      const wait = 2000 * (attempt + 1);
      console.error(`  figma ${res.status}, waiting ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Figma ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
}

// Exact raw JSON of one node subtree (every property Figma has).
// geometry=paths is what makes Figma return `size` (unrotated w/h) and `relativeTransform`; without it a rotated node
// only has its rotated bounding box, from which the real size cannot be recovered (a 12x12 square rotated 45deg looks like any 24-diagonal diamond).
export const getNode = (fileKey, nodeId) =>
  figmaGet(`/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&geometry=paths`);

// imageRef -> temporary S3 url, for every image fill in the file
export const getImageFills = async (fileKey) => (await figmaGet(`/v1/files/${fileKey}/images`)).meta.images;

// nodeId -> temporary render url
export async function getRenders(fileKey, ids, format = 'svg', { scale } = {}) {
  const out = {};
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40).map(encodeURIComponent).join(',');
    const r = await figmaGet(`/v1/images/${fileKey}?ids=${chunk}&format=${format}${scale ? `&scale=${scale}` : ''}&svg_include_id=false&svg_simplify_stroke=false`);
    Object.assign(out, r.images);
  }
  return out;
}

export async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`download ${res.status} ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}
