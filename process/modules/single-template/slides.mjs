// The "Bộ item" answer is a Figma link of the frame that holds every slide, in order.
// The link is fetched beside THIS section (not into another section's workspace) and those items replace the slides drawn in the frame.
// perPage stays the number that fit the frame, so a longer set still shows the same window.
import { join } from 'node:path';
import { findNode } from '../write-bricks/components/helpers.mjs';
import { safeId } from '../common/workspace.mjs';
import { copyAssets, fetchSideTree } from '../single-template/expand.mjs';
import { rejectTabButtons } from '../single-template/recheck.mjs';

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

export async function attachSlideFrames(ws, { log = () => {} } = {}) {
  const det = ws.readJson('detections.json', { components: [] });
  const jobs = det.components.filter((c) => c.component === 'carousel' && c.status === 'approved' && c.params?.items?.kind === 'figma');
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
