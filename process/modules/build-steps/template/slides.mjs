import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
// The "Bộ item" answer is a Figma link of the frame that holds every slide, in order.
// The link is fetched beside THIS section (not into another section's workspace) and those items replace the slides drawn in the frame.
// perPage stays the number that fit the frame, so a longer set still shows the same window.
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { findNode } from '../../write-bricks/components/helpers.mjs';
import { download, getRenders } from '../../read-figma/api.mjs';
import { imageInfo, sha256 } from '../../common/image-info.mjs';
import { safeId } from '../../common/workspace.mjs';
import { copyAssets, fetchSideTree } from './expand.mjs';
import { rejectTabButtons } from './recheck.mjs';

const CONTROL_NAME = /^(pagination|dots|pager|navigation|arrows?|controls)$/i;
const stamp = (id) => `s${safeId(id)}`;

function visible(node) {
  return (node.children ?? []).filter((c) => c.visible !== false && !CONTROL_NAME.test(String(c.name ?? '')));
}

// The row of items, whether the link is that row or a section that contains it.
export function slideChildren(root) {
  const direct = visible(root);
  if (root.layout?.mode === 'HORIZONTAL' && direct.length >= 2) return direct;
  let best = null;
  const walk = (n) => {
    const kids = visible(n);
    if (n.layout?.mode === 'HORIZONTAL' && kids.length >= 2 && kids.length > (best?.length ?? 1)) best = kids;
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return best ?? direct.filter((c) => c.type !== 'TEXT');
}

function prefixSlide(node, hostId) {
  const copy = structuredClone(node);
  const walk = (n) => {
    n.id = `${stamp(hostId)}${safeId(n.id)}`;
    for (const c of n.children ?? []) walk(c);
  };
  walk(copy);
  copy.place = 'FLOW';
  return copy;
}

function fits(node, slides) {
  if (!node?.box) return Math.max(1, slides.length);
  const room = node.box.w - (node.layout?.padding?.right ?? 0);
  const n = slides.filter((c) => c.box && c.box.x + c.box.w <= room + 1).length;
  return Math.max(1, n || slides.length);
}

// Replace the host's slides with the source items. Controls drawn on the slider stay.
export function graftSlides(tree, hostId, sourceTree, keepIds = []) {
  const host = findNode(tree, hostId);
  if (!host) throw new Error(`Không thấy slider ${hostId} để gắn bộ item.`);
  const incoming = slideChildren(sourceTree).map((n) => prefixSlide(n, hostId));
  if (!incoming.length) throw new Error('Link bộ item không có item nào. Cần link khung chứa các item, theo thứ tự.');
  const keep = new Set(keepIds);
  const kept = (host.children ?? []).filter((c) => keep.has(c.id));
  const dropping = new Set((host.children ?? []).filter((c) => !keep.has(c.id)).map((c) => c.id));
  const ids = new Set();
  const take = (n, skip) => {
    if (skip.has(n.id)) return;
    if (ids.has(n.id)) throw new Error(`Bộ item trùng id ${n.id} với khung đang build.`);
    ids.add(n.id);
    for (const c of n.children ?? []) take(c, skip);
  };
  take(tree, dropping);
  for (const n of incoming) take(n, new Set());
  host.children = [...incoming, ...kept];
  return incoming.length;
}

// Slides that live in several frames (owner decision 2026-11-26): each linked frame is one slide, shown as the picture Figma renders for it.
// The node `at` (the slides drawn in this section, or a placeholder) is replaced by a new slider frame in the same place that holds one picture
// per link. The default (one link, the slides are the children of one row) is not touched.
const dig = (node, id, parent = null, index = -1) => {
  if (node.id === id) return { node, parent, index };
  for (const [i, c] of (node.children ?? []).entries()) {
    const hit = dig(c, id, node, i);
    if (hit) return hit;
  }
  return null;
};

const allIds = (node, out = new Set()) => {
  out.add(node.id);
  for (const c of node.children ?? []) allIds(c, out);
  return out;
};

export function wrapSlides(tree, atId, slides) {
  const hit = dig(tree, atId);
  if (!hit?.parent) throw new Error(`Không thấy chỗ đặt slider ${atId} trong section này.`);
  const { node, parent, index } = hit;
  const taken = allIds(tree);
  for (const slide of slides) if (taken.has(slide.id) && !allIds(node).has(slide.id)) throw new Error(`Slide trùng id ${slide.id} với khung đang build.`);
  const wrapper = {
    id: `${atId}:slides`, type: 'FRAME', name: 'Slides', visible: true,
    box: { ...node.box, w: Math.max(...slides.map((n) => n.box?.w ?? 0)), h: Math.max(...slides.map((n) => n.box?.h ?? 0)) },
    sizing: { h: 'FIXED', v: 'FIXED' },
    layout: { mode: 'HORIZONTAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, primaryAlign: 'MIN', counterAlign: 'MIN' },
    place: node.place, constraints: node.constraints, clip: true, children: [],
  };
  for (const slide of slides) {
    slide.box = { ...slide.box, x: 0, y: 0 };
    slide.place = 'FLOW';
    delete slide.constraints;
  }
  wrapper.children = slides;
  parent.children[index] = wrapper;
  return { wrapper, replaced: allIds(node) };
}

// The picture Figma renders for a node, kept as an image of this workspace and returned as an image node of the same size.
async function renderSlide(ws, manifest, frame, position, { width: fitW } = {}) {
  const scale = 2;
  const urls = await getRenders(frame.fileKey || ws.ref.fileKey, [frame.nodeId], 'png', { scale });
  if (!urls[frame.nodeId]) throw new Error(`Figma không render được ${frame.nodeId}.`);
  const buf = await download(urls[frame.nodeId]);
  const { width, height, ext } = imageInfo(buf);
  const sha = sha256(buf);
  const ref = `slide${sha.slice(0, 32)}`;
  const file = `images/${ref}.${ext}`;
  mkdirSync(ws.file('assets/images'), { recursive: true });
  writeFileSync(ws.file('assets/' + file), buf);
  manifest.images ??= {};
  manifest.images[ref] = { file, bytes: buf.length, sha256: sha, ext, width, height };
  const w = fitW ?? width / scale;
  return {
    id: `${stamp(frame.nodeId)}`, type: 'RECTANGLE', name: `Slide ${position}`, visible: true,
    box: { x: 0, y: 0, w, h: (height / width) * w, absX: 0, absY: 0 },
    sizing: { h: 'FIXED', v: 'FIXED' }, place: 'FLOW',
    fills: [{ type: 'IMAGE', imageRef: ref, scaleMode: 'FILL', alpha: 1, asset: { file, width, height, sha256: sha } }],
  };
}

// A slide that is a picture plus blocks drawn beside it (owner decision 2026-11-26: the floating badges of a carousel item stay part of that
// item). `statics` names the Figma node whose visible children are the blocks. They are laid in a wrapping grid of `columns` and `gap`, above
// the picture, and the picture is fitted to the slide width. A node already in this tree is moved into the slide; any other is fetched.
export function gridCards(cards, { width, columns, gap }) {
  const cardW = (width - (columns - 1) * gap) / columns;
  const rowH = [];
  cards.forEach((c, i) => { const r = Math.floor(i / columns); rowH[r] = Math.max(rowH[r] ?? 0, c.box?.h ?? 0); });
  const height = rowH.reduce((a, b) => a + b, 0) + Math.max(0, rowH.length - 1) * gap;
  for (const c of cards) {
    c.box = { ...c.box, x: 0, y: 0, w: cardW };
    c.sizing = { ...(c.sizing ?? {}), h: 'FIXED', v: 'FIXED' };
    c.place = 'FLOW';
    delete c.constraints;
  }
  return { cardW, height };
}

async function composeSlide(ws, tree, manifest, frame, position, width) {
  const { statics } = frame;
  const columns = statics.columns ?? 2;
  const gap = statics.gap ?? 8;
  const image = await renderSlide(ws, manifest, frame, position, { width });
  let cards;
  const held = dig(tree, statics.nodeId);
  if (held?.parent) {
    cards = visible(held.node);
    held.parent.children.splice(held.index, 1);
  } else {
    const dest = join(ws.dir, 'slides-src', safeId(statics.nodeId));
    const source = await fetchSideTree(statics.url, dest);
    cards = visible(source).map((n) => prefixSlide(n, statics.nodeId));
    copyAssets(dest, ws);
  }
  if (!cards.length) throw new Error(`Không có khối nào trong ${statics.nodeId} để đặt trên slide.`);
  const { height } = gridCards(cards, { width, columns, gap });
  const space = statics.below ?? gap;
  const grid = {
    id: `${stamp(frame.nodeId)}grid`, type: 'FRAME', name: 'Khối tĩnh', visible: true,
    box: { x: 0, y: 0, w: width, h: height }, sizing: { h: 'FIXED', v: 'HUG' }, place: 'FLOW',
    layout: { mode: 'HORIZONTAL', wrap: true, gap, counterGap: gap, padding: { top: 0, right: 0, bottom: 0, left: 0 }, primaryAlign: 'MIN', counterAlign: 'MIN' },
    children: cards,
  };
  return {
    id: `${stamp(frame.nodeId)}slide`, type: 'FRAME', name: `Slide ${position}`, visible: true,
    box: { x: 0, y: 0, w: width, h: height + space + image.box.h }, sizing: { h: 'FIXED', v: 'HUG' }, place: 'FLOW',
    layout: { mode: 'VERTICAL', wrap: false, gap: space, padding: { top: 0, right: 0, bottom: 0, left: 0 }, primaryAlign: 'MIN', counterAlign: 'MIN' },
    children: [grid, image],
  };
}

export async function attachSlideFrames(ws, { log = () => {} } = {}) {
  await attachSlideSet(ws, { log });
  await attachSlideLinks(ws, { log });
}

async function attachSlideSet(ws, { log = () => {} } = {}) {
  const det = ws.readJson('detections.json', { components: [] });
  const jobs = det.components.filter((c) => isKind(c, PartKind.CAROUSEL) && c.status === 'approved' && c.params?.items?.kind === 'frames');
  if (!jobs.length) return;
  const tree = ws.readJson('tree.json');
  const manifest = ws.readJson('assets/manifest.json', { images: {}, svgs: {} });
  for (const c of jobs) {
    const { at, frames = [] } = c.params.items;
    if (frames.length < 2) throw new Error('Cần ít nhất hai link khung cho một slider nhiều slide.');
    if (dig(tree, `${at}:slides`)) continue; // an earlier build of this workspace already put the slides in
    if (!dig(tree, at)) throw new Error(`Chỗ đặt slider ${at} không nằm trong section này.`);
    const slides = [];
    const host = dig(tree, at).node;
    for (const [i, f] of frames.entries()) {
      log(`Đang lấy ảnh slide ${f.nodeId}`);
      slides.push(f.statics ? await composeSlide(ws, tree, manifest, f, i + 1, host.box.w) : await renderSlide(ws, manifest, f, i + 1));
    }
    const { wrapper, replaced } = wrapSlides(tree, at, slides);
    // What was detected inside the replaced nodes is gone with them (a detection on a node that is not in the tree blocks the sign-off).
    // A block moved into a slide is no longer where a detection cited it.
    const present = allIds(tree);
    det.components = det.components.filter((other) => other === c || (!replaced.has(other.node) && present.has(other.node) && (other.cite ?? []).every((q) => !q?.node || present.has(q.node))));
    c.node = wrapper.id;
    if (c.params.perPage == null) c.params.perPage = 1;
    log(`Slider gồm ${slides.length} slide, mỗi slide là một ảnh`);
  }
  ws.writeJson('assets/manifest.json', manifest);
  ws.writeJson('detections.json', det);
  ws.writeJson('tree.json', tree);
}

async function attachSlideLinks(ws, { log = () => {} } = {}) {
  const det = ws.readJson('detections.json', { components: [] });
  const jobs = det.components.filter((c) => isKind(c, PartKind.CAROUSEL) && c.status === 'approved' && c.params?.items?.kind === 'figma');
  if (!jobs.length) return;
  const tree = ws.readJson('tree.json');
  for (const c of jobs) {
    const { url, nodeId } = c.params.items;
    if (nodeId === c.node) throw new Error('Link bộ item đang trỏ vào chính slider. Cần link khung chứa các item.');
    log(`Đang lấy bộ item ${nodeId}`);
    const dest = join(ws.dir, 'slides-src', safeId(nodeId));
    const source = await fetchSideTree(url, dest);
    rejectTabButtons(slideChildren(source));
    const host = findNode(tree, c.node);
    const keep = [c.params?.pagination, c.params?.prev, c.params?.next, ...(c.params?.controls ?? [])].filter(Boolean);
    if (host && c.params?.perPage == null) c.params.perPage = c.params?.allowSingle ? 1 : fits(host, (host.children ?? []).filter((n) => n.visible !== false && !keep.includes(n.id)));
    const n = graftSlides(tree, c.node, source, keep);
    if (c.params?.itemCount && c.params.itemCount !== n) log(`Tổng số item ghi ${c.params.itemCount}, link có ${n}: dựng theo ${n} item của link`);
    copyAssets(dest, ws);
  }
  ws.writeJson('detections.json', det);
  ws.writeJson('tree.json', tree);
}
