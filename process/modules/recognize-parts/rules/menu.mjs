// Candidate menus: a HORIZONTAL row of >= 2 link-like items (one short text each, no picture) that is named like a menu, or whose items are.
//   E1 item    the items are named / componentised like menu items ("_sub-menu-item", "Nav link", "menu item")
//   E1 named   the row, or a frame above it, is named menu / nav / navigation
// A row of short links with no menu name is still proposed, at low confidence. A taller row of cards is not a menu. Vertical link lists are lists (rules in decide).
// Items that fit the frame stay a plain menu. Items that run past the clip (or start before it) become a slider of those items: the arrows drawn
// beside the row (angle-left / angle-right, often inside a Navigation frame) are that slider's arrows.
import { hasDivider, isActionBar } from '../../write-bricks/components/tab-switch.mjs';
import { isLinkRow } from '../../recognize-parts/rules/links.mjs';
import { containsChoice, isPressable, textsOf } from './shape.mjs';
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const ITEM = /menu[ _-]?item|nav[ _-]?(item|link)|sub[ _-]?menu/i;
const ROW = /(^|[^a-z])(menu|nav|navigation)([^a-z]|$)/i;

function arrowSide(n) {
  const t = [
    n.name, n.text?.characters,
    ...Object.entries(n.props ?? {}).map(([k, v]) => `${k} ${v}`),
    ...visibleKids(n).flatMap((c) => [c.name, c.text?.characters, ...Object.entries(c.props ?? {}).map(([k, v]) => `${k} ${v}`)]),
  ].filter(Boolean).join(' ');
  // A side property ("Property 2 = Left") is enough. The icon text (angle-left) is the other way the file names it.
  if (!/angle|chevron|arrow|caret|prev|next|left|right/i.test(t)) return null;
  const left = /left|prev|back/i.test(t), right = /right|next|forward/i.test(t);
  if (left && !right) return 'prev';
  if (right && !left) return 'next';
  return null;
}

// Arrows are siblings of the menu, or the children of one sibling frame (the Navigation overlay). Not children of the menu: those are the items.
function findArrows(parent, row) {
  const hit = { prev: null, next: null, controls: [] };
  if (!parent) return hit;
  const consider = (node, frame) => {
    const side = arrowSide(node);
    if (!side || hit[side]) return;
    hit[side] = node;
    if (frame && !hit.controls.includes(frame.id)) hit.controls.push(frame.id);
  };
  for (const c of visibleKids(parent)) {
    if (c.id === row.id) continue;
    consider(c, null);
    if (!arrowSide(c)) for (const g of visibleKids(c)) consider(g, c);
  }
  return hit;
}

// The room is the menu's own width, tightened when a clipping parent cuts the row sooner. An item past either edge means the row does not fit.
function overflows(row, parent) {
  const kids = visibleKids(row).filter((k) => k.box);
  if (!row.box || !kids.length) return false;
  const left = row.layout?.padding?.left ?? 0;
  let right = row.box.w - (row.layout?.padding?.right ?? 0);
  if (parent?.clip && parent.box && row.box.absX != null && parent.box.absX != null) {
    const edge = parent.box.absX + parent.box.w - row.box.absX;
    if (edge > 0) right = Math.min(right, edge);
  }
  return kids.some((k) => k.box.x < left - 1 || k.box.x + k.box.w > right + 1);
}

function holds(n, id) {
  return n?.id === id || visibleKids(n).some((c) => holds(c, id));
}

// The pane of a line tab is the region under the row, or peer panes that follow it.
// A hero plus a later section is the rest of the page, so the underlined row stays a menu.
function paneFollows(row, trail) {
  for (const parent of trail) {
    const kids = visibleKids(parent);
    const index = kids.findIndex((k) => k.id === row.id || holds(k, row.id));
    if (index < 0) continue;
    const rest = kids.slice(index + 1);
    const below = rest[0]?.box && row.box && rest[0].box.absY >= row.box.absY + row.box.h - 1;
    if (!below) continue;
    if (rest.length === 1) return true;
    const key = (item) => visibleKids(item).map((c) => c.type).join('+') || item.type;
    if (new Set(rest.map(key)).size === 1) return true;
  }
  return false;
}

export function detectMenus(tree) {
  const found = [];
  (function walk(n, trail) {
    if (n.visible === false) return;
    const kids = visibleKids(n);
    // The row is a tab when a pane follows it, or a divider splits the triggers.
    // One underlined or Active link, with no pane, stays a menu.
    if (isActionBar(n) && (paneFollows(n, trail) || hasDivider(n))) {
      kids.forEach((c) => walk(c, [n, ...trail]));
      return;
    }
    const chip = (k) => {
      if ((k.box?.h ?? 0) > 28 || (k.box?.w ?? 0) >= (n.box?.w ?? 0) * 0.45 || textsOf(k).length !== 1) return false;
      if ((k.fills ?? []).some((f) => f.type === 'SOLID' && (f.alpha ?? 1) > 0.5)) return true;
      const inner = (k.children ?? []).filter((c) => c.visible !== false);
      return inner.length === 1 && (inner[0].fills ?? []).some((f) => f.type === 'SOLID' && (f.alpha ?? 1) > 0.5);
    };
    const titleAndBadge = kids.some((k) => k.type === 'TEXT' && (k.box?.w ?? 0) >= (n.box?.w ?? 0) * 0.45) && kids.some(chip);
    const actionBar = kids.length >= 2 && kids.every(isPressable);
    if (n.layout?.mode === 'HORIZONTAL' && kids.length >= 2 && isLinkRow(kids) && !kids.some(containsChoice) && !titleAndBadge && !actionBar) {
      const itemNamed = kids.every((k) => ITEM.test(`${k.name} ${k.componentSet ?? ''}`));
      const namedNode = [n, ...trail].find((x) => ROW.test(x.name ?? '')), rowNamed = !!namedNode;
      const short = kids.every((k) => (k.box?.h ?? 0) <= 48);
      if ((itemNamed || rowNamed || short)) {
        const cite = [{ node: n.id, field: 'layout.mode', equals: 'HORIZONTAL' }];
        if (itemNamed) cite.push({ node: kids[0].id, field: 'name', equals: kids[0].name });
        if (rowNamed) cite.push({ node: namedNode.id, field: 'name', equals: namedNode.name });
        const parent = trail[0] ?? null;
        const scroll = overflows(n, parent);
        const arrows = scroll ? findArrows(parent, n) : { prev: null, next: null, controls: [] };
        const params = {};
        if (scroll) {
          if (arrows.prev) params.prev = arrows.prev.id;
          if (arrows.next) params.next = arrows.next.id;
          if (arrows.controls.length) params.controls = arrows.controls;
        }
        found.push({
          component: scroll ? 'menu-slider' : 'menu', node: n.id, level: itemNamed || rowNamed ? 'E1' : 'E2', confidence: itemNamed && rowNamed ? 'high' : itemNamed || rowNamed ? 'medium' : 'low', cite,
          evidence: `"${n.name}" is a horizontal row of ${kids.length} link-like items (${kids.slice(0, 4).map((k) => `"${k.name}"`).join(', ')}${kids.length > 4 ? ', …' : ''})${itemNamed ? ' named like menu items' : ''}${rowNamed ? ', in a frame named like a menu' : ''}${scroll ? '; the items run past the frame' : ''}`,
          params,
          note: scroll
            ? `${kids.length} menu items do not fit the frame, so this is a menu slider (drag and arrows, no loop, no autoplay); the URL of every item is not in Figma, the Plan asks for them`
            : `${kids.length} menu items; the URL of every item is not in Figma, the Plan asks for them`,
        });
        return;
      }
    }
    kids.forEach((c) => walk(c, [n, ...trail]));
  })(tree, []);
  return found;
}
