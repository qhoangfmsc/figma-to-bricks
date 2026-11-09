// The "Nội dung khi mở" answer is either extra text (handled at render) or a Figma link of the expanded frame.
// The link is fetched into a side folder of THIS section. It is not written to the OS temp scratch of that node,
// because that folder may already be another section's workspace.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { findNode } from '../write-bricks/components/helpers.mjs';
import { download, getImageFills, getNode, getRenders } from '../read-figma/api.mjs';
import { collectImageRefs, collectSvgRoots } from '../read-figma/nodes.mjs';
import { normalizeRoot } from '../read-figma/normalize.mjs';
import { imageInfo, sha256 } from '../common/image-info.mjs';
import { safeId } from '../common/workspace.mjs';
import { parseFigmaUrl } from '../read-figma/url.mjs';
import { rejectTabBar } from '../single-template/recheck.mjs';

const stamp = (id) => `o${safeId(id)}`;

function prefixOpen(node, hostId) {
  const copy = structuredClone(node);
  const walk = (n, root) => {
    n.id = `${stamp(hostId)}${safeId(n.id)}`;
    n.openOnly = true;
    if (root) n.openRoot = true;
    for (const c of n.children ?? []) walk(c, false);
  };
  walk(copy, true);
  copy.place = 'FLOW';
  return copy;
}

export function graftExpand(tree, hostId, expandTree) {
  const host = findNode(tree, hostId);
  if (!host) throw new Error(`Không thấy khung Xem thêm ${hostId} để gắn bản đầy đủ.`);
  const prefixed = prefixOpen(expandTree, hostId);
  const ids = new Set();
  const take = (n) => {
    if (ids.has(n.id)) throw new Error(`Bản đầy đủ trùng id ${n.id} với khung đang build.`);
    ids.add(n.id);
    for (const c of n.children ?? []) take(c);
  };
  take(tree);
  take(prefixed);
  host.children = [...(host.children ?? []), prefixed];
  return prefixed.id;
}

export async function fetchSideTree(url, dest) {
  const { fileKey, nodeId } = parseFigmaUrl(url);
  const images = join(dest, 'assets/images');
  const svgs = join(dest, 'assets/svg');
  mkdirSync(images, { recursive: true });
  mkdirSync(svgs, { recursive: true });
  const raw = await getNode(fileKey, nodeId);
  const root = raw.nodes?.[nodeId]?.document;
  if (!root) throw new Error(`Không thấy node ${nodeId}. Kiểm tra lại link bản đầy đủ.`);
  const refs = collectImageRefs(root);
  if (refs.length) {
    const urls = await getImageFills(fileKey);
    for (const ref of refs) {
      if (!urls[ref]) throw new Error(`Bản đầy đủ thiếu ảnh ${ref}.`);
      const buf = await download(urls[ref]);
      writeFileSync(join(images, `${ref}.${imageInfo(buf).ext}`), buf);
    }
  }
  const svgRoots = collectSvgRoots(root);
  if (svgRoots.length) {
    const urls = await getRenders(fileKey, svgRoots.map((n) => n.id), 'svg');
    for (const n of svgRoots) {
      if (!urls[n.id]) continue;
      writeFileSync(join(svgs, `${safeId(n.id)}.svg`), await download(urls[n.id]));
    }
  }
  const manifest = { images: {}, svgs: {} };
  for (const f of readdirSync(images)) {
    const buf = readFileSync(join(images, f));
    manifest.images[basename(f, extname(f))] = { file: `images/${f}`, bytes: buf.length, sha256: sha256(buf), ...imageInfo(buf) };
  }
  for (const f of readdirSync(svgs)) {
    const buf = readFileSync(join(svgs, f));
    manifest.svgs[basename(f, '.svg')] = { file: `svg/${f}`, bytes: buf.length, sha256: sha256(buf) };
  }
  return normalizeRoot(raw, nodeId, manifest);
}

export function copyAssets(from, ws) {
  for (const folder of ['images', 'svg']) {
    const src = join(from, 'assets', folder);
    if (!existsSync(src)) continue;
    const dest = join(ws.dir, 'assets', folder);
    mkdirSync(dest, { recursive: true });
    for (const f of readdirSync(src)) {
      const target = join(dest, f);
      if (!existsSync(target)) cpSync(join(src, f), target);
    }
  }
}

export async function attachExpandFrames(ws, { log = () => {} } = {}) {
  const det = ws.readJson('detections.json', { components: [] });
  const jobs = det.components.filter((c) => c.component === 'readmore' && c.status === 'approved' && c.params?.expand?.kind === 'figma');
  if (!jobs.length) return;
  const tree = ws.readJson('tree.json');
  for (const c of jobs) {
    const { url, nodeId } = c.params.expand;
    if (nodeId === c.node) throw new Error('Link bản đầy đủ đang trỏ vào chính khung bị cắt. Cần link khung đang mở hết.');
    log(`Đang lấy bản đầy đủ ${nodeId}`);
    const dest = join(ws.dir, 'expand-src', safeId(nodeId));
    const expandTree = rejectTabBar(await fetchSideTree(url, dest));
    graftExpand(tree, c.node, expandTree);
    copyAssets(dest, ws);
  }
  ws.writeJson('tree.json', tree);
}
