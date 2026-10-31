// Candidate menus: a HORIZONTAL row of >= 3 link-like items (one short text each, no picture) that is named like a menu, or whose items are.
//   E1 item    the items are named / componentised like menu items ("_sub-menu-item", "Nav link", "menu item")
//   E1 named   the row, or a frame above it, is named menu / nav / navigation
// A row of links without any such name is not guessed (a footer legal line is also a row of links). Vertical link lists are lists (rules in decide).
import { isLinkRow } from './links.mjs';
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const ITEM = /menu[ _-]?item|nav[ _-]?(item|link)|sub[ _-]?menu/i;
const ROW = /(^|[^a-z])(menu|nav|navigation)([^a-z]|$)/i;

export function detectMenus(tree) {
  const found = [];
  (function walk(n, trail) {
    if (n.visible === false) return;
    const kids = visibleKids(n);
    if (n.layout?.mode === 'HORIZONTAL' && kids.length >= 3 && isLinkRow(kids)) {
      const itemNamed = kids.every((k) => ITEM.test(`${k.name} ${k.componentSet ?? ''}`));
      const namedNode = [n, ...trail].find((x) => ROW.test(x.name ?? '')), rowNamed = !!namedNode;
      if (itemNamed || rowNamed) {
        const cite = [{ node: n.id, field: 'layout.mode', equals: 'HORIZONTAL' }];
        if (itemNamed) cite.push({ node: kids[0].id, field: 'name', equals: kids[0].name });
        if (rowNamed) cite.push({ node: namedNode.id, field: 'name', equals: namedNode.name });
        found.push({
          component: 'menu', node: n.id, level: 'E1', confidence: itemNamed && rowNamed ? 'high' : 'medium', cite,
          evidence: `"${n.name}" is a horizontal row of ${kids.length} link-like items (${kids.slice(0, 4).map((k) => `"${k.name}"`).join(', ')}${kids.length > 4 ? ', …' : ''})${itemNamed ? ' named like menu items' : ''}${rowNamed ? ', in a frame named like a menu' : ''}`,
          params: {},
          note: `${kids.length} menu items; the URL of every item is not in Figma, the Plan asks for them`,
        });
        return;
      }
    }
    kids.forEach((c) => walk(c, [n, ...trail]));
  })(tree, []);
  return found;
}
