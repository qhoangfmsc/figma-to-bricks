// A horizontal row is a scroll when the clip window shows one item whole and cuts the next,
// so a slice of that next item stays on screen. The item that sits fully in the window keeps
// the width Figma drew. A row whose items all sit inside the clip is not this.

import { PartKind, isKind } from '../../../recognize-parts/kinds.mjs';
import { detectScrollLists } from '../../../recognize-parts/rules/scroll.mjs';

const shown = (node) => (node?.children ?? []).filter((child) => child && child.visible !== false);

function parentOf(root, id) {
  let found = null;
  const walk = (node) => {
    for (const child of node?.children ?? []) {
      if (!child) continue;
      if (child.id === id) { found = node; return; }
      walk(child);
      if (found) return;
    }
  };
  walk(root);
  return found;
}

function clipWindows(node, root) {
  const windows = [];
  let current = node;
  while (current) {
    if (current.clip && current.box) windows.push(current);
    if (!root || current.id === root.id) break;
    current = parentOf(root, current.id);
  }
  return windows;
}

export function peekOf(row, root) {
  if (!row || row.layout?.mode !== 'HORIZONTAL' || !row.box) return null;
  const items = shown(row).filter((item) => item.box && item.box.w > 1 && item.box.h > 1);
  if (items.length < 2) return null;
  for (const clip of clipWindows(row, root)) {
    const left = clip.box.absX;
    const right = left + clip.box.w;
    const seen = items.map((item) => {
      const start = item.box.absX;
      const end = start + item.box.w;
      const overlap = Math.min(end, right) - Math.max(start, left);
      return {
        item,
        overlap,
        full: overlap >= item.box.w - 0.5,
        cut: overlap > 1 && overlap < item.box.w - 0.5,
      };
    });
    const clear = seen.filter((item) => item.full).sort((a, b) => b.overlap - a.overlap)[0];
    // A scroll repeats one item kind. A mark beside a text box cut by the clip is one line, not a list.
    const cut = seen.find((item) => item.cut);
    const sameKind = clear && cut && clear.item.type === cut.item.type && cut.item.type !== 'TEXT';
    if (clear && cut && sameKind) return { row, item: clear.item, width: clear.item.box.w };
  }
  return null;
}

export function markPeekScroll(root, detections) {
  const approved = (detections?.components ?? []).filter((item) => item.status === 'approved' && isKind(item, PartKind.SCROLL));
  const owned = new Set(approved.map((item) => item.params?.list).filter(Boolean));
  const pending = approved.filter((item) => !item.params?.list);
  if (pending.length && root) {
    const byNode = new Map(detectScrollLists(root).filter((item) => isKind(item, PartKind.SCROLL)).map((item) => [item.node, item]));
    for (const item of pending) {
      const list = byNode.get(item.node)?.params?.list;
      if (list) owned.add(list);
    }
  }
  const walk = (node) => {
    const hit = peekOf(node, root);
    if (hit && !owned.has(hit.row.id)) {
      hit.row.__peekScroll = true;
      hit.item.__lockWidth = hit.width;
    }
    shown(node).forEach(walk);
  };
  if (root) walk(root);
}
