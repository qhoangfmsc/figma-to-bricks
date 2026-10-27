// Figma REST API. Needs FIGMA_TOKEN (Personal Access Token, scope: file_content:read).
import { need } from '../shared/env.mjs';

const BASE = 'https://api.figma.com';

export async function figmaGet(path, { retries = 4 } = {}) {
  const token = need('FIGMA_TOKEN', 'Create one at Figma > Settings > Security > Personal access tokens (scope file_content:read) and add FIGMA_TOKEN=... to .env');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BASE + path, { headers: { 'X-Figma-Token': token } });
    if (res.status === 429 && attempt < retries) {
      const wait = Number(res.headers.get('retry-after') ?? 5) * 1000;
      console.error(`  figma 429, waiting ${wait / 1000}s`);
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}
