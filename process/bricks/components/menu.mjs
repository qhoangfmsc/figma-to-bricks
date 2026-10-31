// COMPONENT menu: a row of link-like items (one short text each) is what a developer builds as  nav > ul > li > a.
// Bricks 1.9.8: the row is a block with tag `ul`, every item a block with tag `li`, the label of every item a `text-link` (text + link), and the
// block that holds the row (when it holds nothing but the row and its controls) gets tag `nav`.
//   source: includes/elements/container.php (tag select: ul, li, nav), text-link.php (text, link); the look of every block and text stays the Figma look.
// Why not `nav-nested`: it brings its own mobile menu (a toggle, a full-screen panel) that Figma does not draw. Its `mobileMenu: never` + no toggle
// would give back the same `nav > ul` without any of that, so the plain blocks are exact and the same element a developer can edit. When a Figma file
// draws the hamburger and the open panel, nav-nested is the element to use (CATALOG.md).
// params: links { textNodeId: url } (what the owner typed in the Plan; missing -> '#' and the Plan keeps asking)
import { tagSettings, tagReset, linkSetting, visibleKids, MISSING_URL } from './helpers.mjs';

const textsOf = (n) => (n.visible === false ? [] : n.type === 'TEXT' && !n.svg && n.text?.characters?.trim() ? [n] : visibleKids(n).flatMap(textsOf));
export const menuLabels = (node) => visibleKids(node).map((item) => textsOf(item)[0]).filter(Boolean);

function parentOf(root, id) {
  for (const c of root.children ?? []) { if (c.id === id) return root; const p = parentOf(c, id); if (p) return p; }
  return null;
}

export default {
  id: 'menu',
  status: 'implemented',
  label: 'Menu (nav > ul > li > text-link)',
  figma: 'a horizontal row of >= 3 link-like items (one short text each, no picture), named like a menu',
  bricks: 'row = block `ul`, items = blocks `li`, labels = `text-link` with the URL from the Plan, the block holding the row = `nav`',
  limits: 'no mobile menu / hamburger / dropdown (Figma does not draw them); URLs come from the Plan (missing -> "#"); a sticky or scrolling row keeps the Figma layout',

  check(node, det) {
    const items = visibleKids(node);
    if (items.length < 3) return { ok: false, reason: `needs at least 3 items, found ${items.length}` };
    const bad = items.find((i) => textsOf(i).length !== 1);
    if (bad) return { ok: false, reason: `item "${bad.name}" (${bad.id}) must hold exactly one text, it holds ${textsOf(bad).length}` };
    const missing = menuLabels(node).filter((t) => !det.params?.links?.[t.id]);
    return { ok: true, warnings: missing.length ? [`${missing.length} of ${items.length} menu item(s) have no URL: written as "${MISSING_URL}" (the Plan asks for them)`] : [] };
  },

  apply({ s }) {
    Object.assign(s, tagSettings('ul'));
    const r = tagReset('ul');
    for (const [k, v] of Object.entries(r.defaults)) s[k] ??= v;
  },

  descendants(node, det, { root }) {
    const out = {};
    for (const item of visibleKids(node)) {
      out[item.id] = { settings: tagSettings('li'), ...tagReset('li') };
      const label = textsOf(item)[0];
      if (label) out[label.id] = { kind: 'text-link', settings: { link: linkSetting(det.params?.links?.[label.id]) } };
    }
    // the block that holds the row is the <nav> when it holds nothing else with text (the scroll arrows of a sub menu are icons, not text)
    const parent = parentOf(root, node.id);
    if (parent && parent.id !== root.id && visibleKids(parent).every((k) => k.id === node.id || textsOf(k).length === 0)) out[parent.id] = { settings: tagSettings('nav') };
    return out;
  },
};
