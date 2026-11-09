// A tab answer can be a Figma link of that tab's full frame. The frame is fetched beside this section
// and replaces the pane of the same index, or is added when Figma drew no pane. The same sources are
// already copied onto tablet and mobile tabs that match, so each of those workspaces is grafted too.
import { join } from 'node:path';
import { findNode, visibleKids } from '../write-bricks/components/helpers.mjs';
import { activeTitle, inspect, isNamedTabBar, repeatedSet, tabTitles } from '../write-bricks/components/tab-switch.mjs';
import { safeId } from '../common/workspace.mjs';
import { copyAssets, fetchSideTree } from '../single-template/expand.mjs';
import { rejectAmbiguousItems, rejectTabBar } from '../single-template/recheck.mjs';

const stamp = (id) => `p${safeId(id)}`;

// A link that points at the whole section (title, tab bar, mask and the logo row) must not be pasted
// as the pane: the bar is already on the outside, and the section is wider than the slot.
// The frame under the bar is the pane.
export function paneSource(tree) {
  const info = inspect(tree);
  if (!info?.list) return tree;
  const kids = visibleKids(tree);
  const at = kids.findIndex((c) => c.id === info.list.id);
  if (at < 0) return tree;
  const content = kids[at + 1];
  if (content && visibleKids(content).length) return content;
  return tree;
}

// The same read as the default frame: the repeated items under the tab buttons, not the buttons.
export function tabDataFrame(tree) {
  const frame = paneSource(tree);
  const inner = visibleKids(frame);
  const data = repeatedSet(inner);
  if (!data.items.length || data.ambiguous || data.items.length === inner.length) return frame;
  return { ...frame, children: data.items };
}

function prefixPane(node, salt) {
  const copy = structuredClone(node);
  const walk = (n) => {
    n.id = `${stamp(salt)}${safeId(n.id)}`;
    for (const c of n.children ?? []) walk(c);
  };
  walk(copy);
  copy.place = 'FLOW';
  if (!/tab\s*panel/i.test(copy.name ?? '')) copy.name = 'Tab Panel';
  return copy;
}

function parentOf(root, id) {
  let found = null;
  (function walk(n) {
    for (const c of n.children ?? []) {
      if (c.id === id) found = n;
      else walk(c);
    }
  })(root);
  return found;
}

function dropId(n, id) {
  n.children = (n.children ?? []).filter((c) => c.id !== id);
  for (const c of n.children) dropId(c, id);
}

function assertUnique(tree, node) {
  const ids = new Set();
  const take = (n) => {
    if (ids.has(n.id)) throw new Error(`Nội dung tab trùng id ${n.id} với khung đang build.`);
    ids.add(n.id);
    for (const c of n.children ?? []) take(c);
  };
  take(tree);
  take(node);
}

// The pane of title 0 is the first visible child. A link for a later tab has to land at that
// index, with an empty pane in front when Figma drew nothing there. Otherwise the fetched
// frame becomes the first tab and the later tab stays the empty extra pane.
function placeAt(parent, existing, grafted, index) {
  const kids = [...(parent.children ?? [])];
  if (existing) {
    parent.children = kids.map((c) => (c.id === existing.id ? grafted : c));
  } else {
    const visible = () => kids.filter((c) => c.visible !== false);
    while (visible().length < index) {
      const box = parent.box ?? { x: 0, y: 0, w: 0, h: 0, absX: 0, absY: 0 };
      kids.push({
        id: `${grafted.id}pad${visible().length}`,
        name: 'Tab Panel',
        type: 'FRAME',
        children: [],
        box: { x: 0, y: 0, w: box.w, h: box.h ?? 0, absX: box.absX ?? 0, absY: box.absY ?? 0 },
        sizing: { h: 'FIXED', v: 'FIXED' },
      });
    }
    const shown = visible();
    if (shown[index]) kids[kids.indexOf(shown[index])] = grafted;
    else kids.push(grafted);
    parent.children = kids;
  }
  // An empty frame is often exported as one svg. An svg element does not render the panes, so the frame becomes a block once it holds them.
  if (parent.svg && (parent.children ?? []).some((c) => c.visible !== false)) delete parent.svg;
}

// The frame under the bar holds the open tab's cards, not one pane per card.
// Five logo frames and two titles means one pane (those five) plus a later pane from the link.
export function bundleOpenPane(host, { activeId, dataName } = {}) {
  const kids = visibleKids(host);
  const bar = kids.find(isNamedTabBar);
  if (!bar) return false;
  const content = kids[kids.findIndex((c) => c.id === bar.id) + 1];
  if (!content) return false;
  const inner = visibleKids(content);
  const titles = visibleKids(bar);
  if (!inner.length) return false;
  if (inner.every((n) => /tab\s*panel/i.test(n.name ?? ''))) return false;
  const data = repeatedSet(dataName ? inner.filter((n) => String(n.name ?? '').trim().toLowerCase() === String(dataName).trim().toLowerCase()) : inner);
  if (!dataName && data.ambiguous) return false;
  if (!dataName && data.items.length < 2 && inner.length === titles.length) return false;
  const marked = activeTitle(titles);
  const index = marked.clear ? marked.index : titles.findIndex((t) => t.id === activeId);
  if (index < 0) return false;
  const box = content.box ?? { x: 0, y: 0, w: 0, h: 0, absX: 0, absY: 0 };
  const rowLayout = { ...(content.layout ?? { mode: 'HORIZONTAL' }) };
  // The slot already has the space under the tab bar. Copying it onto the pane doubles that gap.
  if (rowLayout.padding) rowLayout.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const body = data.items.length >= 2 ? data.items : content.children;
  const pane = {
    id: `${content.id}__open`,
    name: 'Tab Panel',
    type: 'FRAME',
    children: body,
    box: { x: 0, y: 0, w: box.w, h: box.h, absX: box.absX ?? 0, absY: box.absY ?? 0 },
    sizing: { h: 'HUG', v: 'HUG' },
    layout: rowLayout,
  };
  const panes = [];
  for (let i = 0; i < index; i++) {
    panes.push({
      id: `${content.id}__pad${i}`,
      name: 'Tab Panel',
      type: 'FRAME',
      children: [],
      box: { x: 0, y: 0, w: box.w, h: 0, absX: box.absX ?? 0, absY: box.absY ?? 0 },
      sizing: { h: 'FIXED', v: 'FIXED' },
    });
  }
  panes.push(pane);
  content.children = panes;
  content.layout = { ...(content.layout ?? {}), mode: 'VERTICAL', gap: 0 };
  if (content.svg) delete content.svg;
  return true;
}

export function bundleOpenPanes(tree, detections) {
  const byHost = new Map();
  for (const c of detections?.components ?? []) {
    if (c.component !== 'tab-switch' && c.component !== 'tabs') continue;
    byHost.set(c.node, { activeId: c.params?.content?.activeTitleId, dataName: c.params?.content?.dataName });
  }
  let wrapped = 0;
  (function walk(n) {
    if (bundleOpenPane(n, byHost.get(n.id))) wrapped++;
    for (const c of n.children ?? []) walk(c);
  })(tree);
  return wrapped;
}

// Puts the fetched frame on the pane of `titleIndex`. Returns null when that pane is already this frame.
export function graftTabPane(tree, hostId, titleIndex, sourceTree, options) {
  const host = findNode(tree, hostId);
  if (!host) throw new Error(`Không thấy tab ${hostId} để gắn nội dung.`);
  bundleOpenPane(host, options);
  const panel = inspect(host);
  const existing = panel ? panel.panels[titleIndex] : visibleKids(visibleKids(host)[1] ?? {})[titleIndex];
  if (existing && sourceTree.id === existing.id) return null;
  const grafted = prefixPane(sourceTree, `${hostId}-${titleIndex}`);
  const anchor = panel?.panels.at(-1);
  const parent = panel
    ? (existing
      ? parentOf(tree, existing.id)
      : anchor
        ? parentOf(tree, anchor.id)
        : (panel.paneParent ? findNode(tree, panel.paneParent.id) : host))
    : visibleKids(host)[1];
  if (!parent) throw new Error('Tab không có khung nội dung để gắn.');
  // A previous run stored this same frame under the prefixed id. Drop it before inserting, then forget it as the node to replace.
  dropId(tree, grafted.id);
  const mark = stamp(`${hostId}-${titleIndex}`);
  parent.children = (parent.children ?? []).filter((c) => !String(c.id).startsWith(mark));
  assertUnique(tree, grafted);
  const replace = existing && findNode(tree, existing.id) ? existing : null;
  // The slot already insets the panes. A source frame that is itself a slot would add that inset again.
  if (parent.layout?.padding && grafted.layout?.padding) {
    grafted.layout = { ...grafted.layout, padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  }
  placeAt(parent, replace, grafted, titleIndex);
  return grafted.id;
}

export async function attachTabFrames(ws, { log = () => {} } = {}) {
  const det = ws.readJson('detections.json', { components: [] });
  const jobs = det.components.filter((c) => (c.component === 'tabs' || c.component === 'tab-switch') && c.status === 'approved' && c.params?.content?.sources);
  if (!jobs.length) return { grafted: 0 };
  const tree = ws.readJson('tree.json');
  let grafted = 0;
  for (const c of jobs) {
    const node = findNode(tree, c.node);
    if (!node) continue;
    const titles = c.component === 'tab-switch' ? tabTitles(node) : visibleKids(visibleKids(node)[0] ?? {});
    const sources = Object.entries(c.params.content.sources)
      .filter(([, source]) => source?.kind === 'figma')
      .map(([titleId, source]) => ({ titleId, source, index: titles.findIndex((t) => t.id === titleId) }))
      .filter((job) => job.index >= 0)
      .sort((a, b) => a.index - b.index);
    for (const job of sources) {
      if (job.source.nodeId === c.node) throw new Error('Link nội dung tab đang trỏ vào chính khung tab. Cần link khung của riêng tab đó.');
      log(`Đang lấy nội dung tab ${job.source.nodeId}`);
      const dest = join(ws.dir, 'tab-src', safeId(job.source.nodeId));
      const sourceTree = rejectAmbiguousItems(rejectTabBar(tabDataFrame(await fetchSideTree(job.source.url, dest))));
      const options = { activeId: c.params?.content?.activeTitleId, dataName: c.params?.content?.dataName };
      const placed = graftTabPane(tree, c.node, job.index, sourceTree, options);
      if (!placed) continue;
      copyAssets(dest, ws);
      grafted++;
    }
  }
  if (grafted) ws.writeJson('tree.json', tree);
  return { grafted };
}
