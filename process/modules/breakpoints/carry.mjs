// Owner rule: every component must render at every breakpoint. A component the base frame approved is the same component on the
// frame of each breakpoint, on the node that pairs with it (match.mjs). The variant frame is never left to re-detect it on its own:
// a variant that keeps the picture or a plain block where the base has a video, a menu or a button is a mismatch.
//
// carryComponents(base, variant, pairs, variantRootId) -> the variant detections with, for each approved base component whose node
// has a pair in the variant frame:
//   * the variant's own approved detection of the same kind on that node is kept (it was decided on that frame);
//   * otherwise every other detection on that node that is not rejected is replaced by a copy of the base one (same kind, same
//     params), so the same element is built there. Node ids inside params and the cites are renamed to the paired nodes;
//   * a base node with no pair in the variant frame carries nothing (the frame does not draw it; merge hides the element there).
// A component whose shape the variant frame cannot draw still fails its own `check` in the build and stays a block with a warning.
import { isKind } from '../recognize-parts/kinds.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const NODE_ID = /^I?\d+:\d+(?:;\d+:\d+)*$/;

// strings that are base node ids become the paired variant ids; an id with no pair becomes null
function rename(value, toVariant) {
  if (typeof value === 'string') return NODE_ID.test(value) ? (toVariant.get(value) ?? null) : value;
  if (Array.isArray(value)) return value.map((v) => rename(v, toVariant));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rename(v, toVariant)]));
  return value;
}

export function carryComponents(baseDetections, variantDetections, pairs, variantRootId) {
  const base = (baseDetections?.components ?? []).filter((item) => item.status === 'approved');
  if (!base.length) return variantDetections;
  const toVariant = new Map();
  for (const [variantId, baseId] of pairs ?? []) toVariant.set(baseId, variantId);
  const own = variantDetections?.components ?? [];
  const taken = new Set(); // variant nodes whose detections a base component replaces
  const carried = [];
  for (const item of base) {
    const node = toVariant.get(item.node);
    if (!node) continue;
    if (own.some((v) => v.node === node && v.status === 'approved' && isKind(v, item.component))) continue;
    taken.add(node);
    carried.push({
      ...item,
      id: `${item.id}@${variantRootId}`,
      node,
      cite: (item.cite ?? []).map((c) => ({ ...c, node: toVariant.get(c.node) ?? node })),
      params: rename(item.params ?? {}, toVariant),
    });
  }
  if (!carried.length) return variantDetections;
  const rest = own.filter((v) => !(taken.has(v.node) && v.status !== 'rejected'));
  return { ...(variantDetections ?? {}), components: [...rest, ...carried] };
}

// ---- pairing for carrying, by CONTENT and never by layer name (the designers' names are not reliable) ----
// A node's content is what Figma draws in it: the image fills it holds and the text it holds. Two nodes are the same node in two frames
// when that content is the same and no other free node on either side has it. Order of the tiers: the whole subtree (type, images, texts
// and children), then the digest (type, every image, every text). An empty frame has no content, so it never pairs this way.
const kids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const ownText = (n) => (n.type === 'TEXT' ? String(n.text?.characters ?? n.characters ?? '').trim() : '');
const images = (n) => (n.fills ?? []).filter((f) => f.type === 'IMAGE' && f.imageRef).map((f) => f.imageRef).sort().join(',');
function full(n) {
  const sub = kids(n).map(full).join(',');
  return `${n.type}|${images(n)}|${ownText(n)}|[${sub}]`;
}
function digest(n) {
  const parts = [];
  (function rec(x) { const i = images(x), t = ownText(x); if (i) parts.push(`i:${i}`); if (t) parts.push(`t:${t}`); kids(x).forEach(rec); })(n);
  return parts.length ? `${n.type}|${parts.join('|')}` : '';
}
const everyNode = (root) => { const out = []; (function rec(n) { out.push(n); kids(n).forEach(rec); })(root); return out; };

export function matchByContent(base, variant) {
  const out = new Map(); // variantId -> baseId
  const usedB = new Set();
  const tiers = [full, digest];
  for (const sign of tiers) {
    const groups = new Map();
    const put = (side, n) => {
      if (side === 'b' ? usedB.has(n.id) : out.has(n.id)) return;
      const key = sign === digest ? digest(n) : (digest(n) ? full(n) : '');
      if (!key) return;
      const g = groups.get(key) ?? { b: [], v: [] };
      g[side].push(n);
      groups.set(key, g);
    };
    everyNode(base).forEach((n) => put('b', n));
    everyNode(variant).forEach((n) => put('v', n));
    for (const g of groups.values()) {
      if (g.b.length !== g.v.length || !g.b.length) continue; // one on each side, or the same count of identical ones taken in order
      g.v.forEach((v, i) => { out.set(v.id, g.b[i].id); usedB.add(g.b[i].id); });
    }
  }
  return out;
}

// the pairs used for carrying: content first, then the name pairs of the merge for what content could not tell
// An alias (responsive.json, variant id -> base id) is a decision the AI or the owner wrote, so it comes before everything else.
export function carryPairs(base, variant, namePairs, aliases = {}) {
  const out = matchByContent(base, variant);
  for (const [variantId, baseId] of Object.entries(aliases)) {
    for (const [other, b] of [...out]) if (b === baseId && other !== variantId) out.delete(other);
    out.set(variantId, baseId);
  }
  const usedB = new Set(out.values());
  for (const [variantId, baseId] of namePairs ?? []) {
    if (out.has(variantId) || usedB.has(baseId)) continue;
    out.set(variantId, baseId);
  }
  return out;
}

// approved base components whose node has no partner in the variant frame: reported in the plan, never silent
export function carryGaps(baseDetections, pairs) {
  const toVariant = new Set(pairs.values());
  return (baseDetections?.components ?? [])
    .filter((item) => item.status === 'approved' && item.source === 'ai' && !toVariant.has(item.node))
    .map((item) => `component ${item.component} ở node ${item.node} chưa tìm được node tương ứng ở frame này (không cùng ảnh hay chữ). Component này chưa dựng ở breakpoint đó. Việc cần làm: thêm alias vào responsive.json.`);
}

// What the code could not do goes into the plan, so the owner sees it. A generate run does not edit process/.
const NOTE_START = '<!-- code-notes -->';
const NOTE_END = '<!-- /code-notes -->';
export function writePlanNotes(ws, lines) {
  const file = ws.file('plan.md');
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  const cut = text.includes(NOTE_START) ? text.slice(0, text.indexOf(NOTE_START)).trimEnd() : text.trimEnd();
  const block = lines.length
    ? `\n\n${NOTE_START}\n## Lỗi do code (không sửa trong lúc generate)\n${lines.map((l) => `- ${l}`).join('\n')}\n${NOTE_END}\n`
    : '\n';
  writeFileSync(file, cut + block);
}
