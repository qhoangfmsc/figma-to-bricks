// The picture names a node. This checks that the node has the structure of that kind.
// One miss may widen a single step, to the parent or to one child. A second miss is not done here.
// Two equal groups are not a guess.
import { NodeType, isType, isText, shapeRole } from './node-type.mjs';
import { PartKind } from './kinds.mjs';
import { findNode } from './cite.mjs';

const ROW = new Set([
  PartKind.PRICE_TABLE,
  PartKind.COMPARE_TABLE,
  PartKind.TABS,
  PartKind.TAB_SWITCH,
  PartKind.CAROUSEL,
  PartKind.GALLERY,
  PartKind.ICON_LIST,
  PartKind.MENU,
  PartKind.BREADCRUMBS,
]);

const kids = (node) => (node?.children ?? []).filter((child) => child && child.visible !== false);

function hasWords(node) {
  if (isText(node)) return true;
  return kids(node).some(hasWords);
}

// A row of marks with no words is a part of a carousel, not a second content group.
function isMarkStrip(node) {
  const parts = kids(node);
  return parts.length >= 2 && parts.every((child) => !hasWords(child));
}

function shapeOf(node) {
  return shapeRole(node, kids);
}

// A row whose children share one shape. Two shapes with the same count is 'ask'.
function rowMatch(node) {
  if (isMarkStrip(node)) return null;
  const items = kids(node).filter((child) => !isText(child) && !isType(child, NodeType.LINE) && !isMarkStrip(child));
  if (items.length < 2) return null;
  const groups = new Map();
  for (const item of items) {
    const key = shapeOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const sizes = [...groups.values()].map((group) => group.length).sort((a, b) => b - a);
  if (sizes[0] < 2) return null;
  if (sizes.length > 1 && sizes[0] === sizes[1]) return 'ask';
  return 'ok';
}

function parentOf(tree, id) {
  let found = null;
  const walk = (node) => {
    for (const child of node?.children ?? []) {
      if (!child) continue;
      if (child.id === id) { found = node; return; }
      walk(child);
      if (found) return;
    }
  };
  walk(tree);
  return found;
}

// The picture names the tab bar and the tab data. The frame that holds both is their nearest common parent, and it must have exactly two
// branches, one for each. Nothing else about the frame (name, shape, count of titles) is read.
function tabContainer(tree, barId, dataId) {
  const pathTo = (id) => {
    const trail = [];
    const walk = (node) => {
      trail.push(node);
      if (node.id === id) return true;
      for (const child of node.children ?? []) if (child && walk(child)) return true;
      trail.pop();
      return false;
    };
    return walk(tree) ? trail : null;
  };
  const bar = pathTo(barId);
  const data = pathTo(dataId);
  if (!bar || !data) return null;
  let at = 0;
  while (at < bar.length - 1 && at < data.length - 1 && bar[at + 1].id === data[at + 1].id) at += 1;
  const holder = bar[at];
  const branches = kids(holder);
  const own = (path) => path[at + 1];
  return branches.length === 2 && own(bar) && own(data) && own(bar) !== own(data) ? holder : null;
}

export function confirmNode(tree, kind, nodeId, params = {}) {
  if ((kind === PartKind.TABS || kind === PartKind.TAB_SWITCH) && params.tabs_bar && params.tabs_data) {
    const holder = tabContainer(tree, params.tabs_bar, params.tabs_data);
    if (holder) return holder.id === nodeId ? { confirm: 'ok', node: nodeId } : { confirm: 'again', node: holder.id };
  }
  const node = findNode(tree, nodeId);
  if (!node) return { confirm: 'ask', node: nodeId };
  if (!ROW.has(kind)) return { confirm: 'ok', node: nodeId };
  if (isMarkStrip(node)) {
    const parent = parentOf(tree, nodeId);
    const sibling = parent && kids(parent).find((child) => child.id !== nodeId && rowMatch(child) === 'ok');
    if (sibling) return { confirm: 'again', node: sibling.id };
    return { confirm: 'ask', node: nodeId };
  }
  const here = rowMatch(node);
  if (here === 'ok') return { confirm: 'ok', node: nodeId };
  if (here === 'ask') return { confirm: 'ask', node: nodeId };
  const parent = parentOf(tree, nodeId);
  const parentOk = parent && rowMatch(parent) === 'ok' ? parent : null;
  const childOk = kids(node).filter((child) => rowMatch(child) === 'ok');
  const hits = [...(parentOk ? [parentOk] : []), ...childOk];
  if (hits.length === 1) return { confirm: 'again', node: hits[0].id };
  return { confirm: 'ask', node: nodeId };
}
