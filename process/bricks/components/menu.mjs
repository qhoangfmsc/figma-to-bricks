// COMPONENT menu: a row of link-like items (one short text each) is what a developer builds as  nav > ul > li > a.
// Bricks 1.9.8: the row is a block with tag `ul`, every item a block with tag `li`, the label of every item a `text-link` (text + link), and the
// block that holds the row (when it holds nothing but the row and its controls) gets tag `nav`.
// A row whose items run past the frame is not this component: that is `menu-slider` (its own file, its own rules).
// An item drawn State=Active is the selected link. Clicking another item moves that look onto it (the colours and the bottom stroke come from the drawn states).
//   source: includes/elements/container.php (tag select: ul, li, nav), text-link.php (text, link)
// Why not `nav-nested`: it brings its own mobile menu (a toggle, a full-screen panel) that Figma does not draw. Its `mobileMenu: never` + no toggle
// would give back the same `nav > ul` without any of that, so the plain blocks are exact and the same element a developer can edit. When a Figma file
// draws the hamburger and the open panel, nav-nested is the element to use (CATALOG.md).
// params: links { textNodeId: url } (what the owner typed in the Plan; missing -> '#' and the Plan keeps asking)
import { tagSettings, tagReset, linkSetting, visibleKids, rowId, MISSING_URL } from './helpers.mjs';
import { addCustomCss, colorObj, cssColor, px } from '../render/utils/css.mjs';

const textsOf = (n) => (n.visible === false ? [] : n.type === 'TEXT' && !n.svg && n.text?.characters?.trim() ? [n] : visibleKids(n).flatMap(textsOf));
export const menuLabels = (node) => visibleKids(node).map((item) => textsOf(item)[0]).filter(Boolean);

export function menuCheck(node, det) {
  const items = visibleKids(node);
  if (items.length < 2) return { ok: false, reason: `needs at least 2 items, found ${items.length}` };
  const bad = items.find((i) => textsOf(i).length !== 1);
  if (bad) return { ok: false, reason: `item "${bad.name}" (${bad.id}) must hold exactly one text, it holds ${textsOf(bad).length}` };
  const missing = menuLabels(node).filter((t) => !det.params?.links?.[t.id]);
  return { ok: true, warnings: missing.length ? [`${missing.length} of ${items.length} menu item(s) have no URL: written as "${MISSING_URL}" (the Plan asks for them)`] : [] };
}

function parentOf(root, id) {
  for (const c of root.children ?? []) { if (c.id === id) return root; const p = parentOf(c, id); if (p) return p; }
  return null;
}

export const isActiveItem = (n) => /^active$/i.test(String(n.props?.State ?? n.props?.state ?? '')) || /state\s*=\s*active/i.test(n.component ?? '');
const solidFill = (n) => (n?.fills ?? []).find((f) => f.type === 'SOLID');
export const menuClass = (node) => `vx-menu-${rowId(node.id)}`;

// Clicking a link moves the drawn Active look onto that item and off the previous one.
export function paintActive(s, node) {
  const on = visibleKids(node).find(isActiveItem);
  if (!on) return;
  const idle = visibleKids(node).find((n) => !isActiveItem(n));
  const onText = solidFill(textsOf(on)[0]);
  const idleText = idle ? solidFill(textsOf(idle)[0]) : null;
  const stroke = on.stroke?.paints?.find((p) => p.type === 'SOLID');
  const bottom = on.stroke?.weights?.bottom;
  if (idleText) addCustomCss(s, `color: ${cssColor(idleText)} !important;`, ' a');
  if (onText) addCustomCss(s, `color: ${cssColor(onText)} !important;`, ' .is-active a');
  if (stroke && bottom) addCustomCss(s, `border-bottom: ${px(bottom)} solid ${cssColor(stroke)}; box-sizing: border-box;`, ' .is-active');
}

export function activePatch(node, item) {
  const on = visibleKids(node).some(isActiveItem);
  if (!on) return {};
  const settings = {
    _interactions: [
      { id: rowId(item.id, 'clear'), trigger: 'click', action: 'removeAttribute', target: 'custom', targetSelector: `.${menuClass(node)} .is-active`, actionAttributeKey: 'class', actionAttributeValue: 'is-active' },
      { id: rowId(item.id, 'on'), trigger: 'click', action: 'setAttribute', target: 'self', actionAttributeKey: 'class', actionAttributeValue: 'is-active' },
    ],
  };
  if (isActiveItem(item)) settings._cssClasses = 'is-active';
  // The underline is only the `.is-active` rule. The drawn stroke would otherwise stay on this item as an
  // inset shadow after the class moves to the item that was clicked.
  return { settings, skipStroke: isActiveItem(item), dropSettings: isActiveItem(item) ? ['_border', '_boxShadow'] : [] };
}

export default {
  id: 'menu',
  status: 'implemented',
  label: 'Menu (nav > ul > li > text-link)',
  figma: 'a horizontal row of >= 2 link-like items (one short text each, no picture), named like a menu, that fits in its frame',
  bricks: 'row = block `ul`, items = blocks `li`, labels = `text-link` with the URL from the Plan, the block holding the row = `nav`. A drawn Active item is the selected link; a click moves that look',
  limits: 'no hamburger / mobile panel / dropdown (Figma does not draw them); URLs come from the Plan (missing -> "#"). A row whose items run past the frame is `menu-slider`, not this component. The active colour is only the one Figma drew',

  check(node, det) {
    return menuCheck(node, det);
  },

  apply({ node, s }) {
    s._cssClasses = [s._cssClasses, menuClass(node)].filter(Boolean).join(' ');
    paintActive(s, node);
    Object.assign(s, tagSettings('ul'));
    const r = tagReset('ul');
    for (const [k, v] of Object.entries(r.defaults)) s[k] ??= v;
  },

  descendants(node, det, { root }) {
    return { ...menuItemPatches(node, det), ...navPatch(root, node) };
  },
};

// Item and label patches shared with menu-slider. `slide` keeps each item's own width (Splide would otherwise give them one width).
export function menuItemPatches(node, det, { slide = false } = {}) {
  const out = {};
  const picked = visibleKids(node).find(isActiveItem);
  const idleNode = visibleKids(node).find((n) => !isActiveItem(n));
  const idleText = idleNode ? solidFill(textsOf(idleNode)[0]) : null;
  for (const item of visibleKids(node)) {
    const active = activePatch(node, item);
    const width = slide && item.box ? { _width: px(item.box.w), _widthMax: 'none', _flexShrink: 0 } : {};
    const settings = { ...(slide ? width : tagSettings('li')), ...(active?.settings ?? {}) };
    const stroke = active?.skipStroke ? { skipStroke: true } : {};
    out[item.id] = slide
      ? { settings, ...(active?.dropSettings?.length ? { dropSettings: active.dropSettings } : {}), ...stroke }
      : { settings, ...tagReset('li'), ...(active?.dropSettings?.length ? { dropSettings: active.dropSettings } : {}), ...stroke };
    const label = textsOf(item)[0];
    if (label) {
      const labelSettings = { link: linkSetting(det.params?.links?.[label.id]) };
      // The Active item is painted by the class. Its own text colour is the idle colour, so leaving the class takes the blue with it.
      if (item === picked && idleText) labelSettings._typography = { color: colorObj(idleText) };
      out[label.id] = { kind: 'text-link', settings: labelSettings };
    }
  }
  return out;
}

// The block that holds the row is the <nav> when it holds nothing else with text (the scroll arrows of a sub menu are icons, not text).
export function navPatch(root, node) {
  const parent = parentOf(root, node.id);
  if (parent && parent.id !== root.id && visibleKids(parent).every((k) => k.id === node.id || textsOf(k).length === 0)) return { [parent.id]: { settings: tagSettings('nav') } };
  return {};
}
