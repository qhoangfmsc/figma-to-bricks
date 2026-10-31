// Small tree helpers shared by the component modules.
import { createHash } from 'node:crypto';
import { colorObj, px } from '../render/utils/css.mjs';
export { findNode } from '../../detect/cite.mjs';

export const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
export const CONTAINER = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT']);

// first visible TEXT (not an icon-font glyph, not an svg) inside a node, depth first
export function firstText(n) {
  if (n.visible === false) return null;
  if (n.type === 'TEXT' && !n.svg) return n;
  for (const c of n.children ?? []) { const f = firstText(c); if (f) return f; }
  return null;
}

// a params value can arrive as JSON text from the review console
export function jsonParam(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

// stable 6-char id for repeater items (Bricks repeater rows carry an id)
export const rowId = (...parts) => createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 6).replace(/^[0-9]/, 'a');

// `_direction`, `_rowGap` and `_columnGap` are controls of container / block / div / section only (container.php): the root of accordion-nested / tabs-nested ignores
// them, so a flex root would lay its items in a row (the FAQ items came out side by side) and drop the gap. They are written as the one custom css Bricks 1.9.8
// has no control for.
export const flexDirectionCss = (node) => {
  const l = node.layout ?? {};
  const horizontal = l.mode === 'HORIZONTAL';
  const gap = l.primaryAlign !== 'SPACE_BETWEEN' && l.gap != null ? ` ${horizontal ? 'column' : 'row'}-gap: ${l.gap}px;` : '';
  return [{ decl: `flex-direction: ${horizontal ? 'row' : 'column'};${gap}`, suffix: '' }];
};

export const hidden = (cssClass) => ({ _hidden: { _cssClasses: cssClass } });

// ---- shared by the semantic components ----
export const PLAIN_TAGS = new Set(['div', 'section', 'a', 'article', 'nav', 'ol', 'ul', 'li', 'aside', 'address', 'figure']); // Bricks block `tag` select (container.php)
// settings that make a Bricks block render as <tag>; tags outside the select use Bricks' custom tag (base.php get_tag: tag=custom + customTag)
export const tagSettings = (tag) => (PLAIN_TAGS.has(tag) ? { tag } : { tag: 'custom', customTag: tag });

// Missing URLs are written as '#' (owner decision 2026-10-26): the element is a real link, the URL is still on the designer list.
export const MISSING_URL = '#';
export const linkSetting = (url) => ({ type: 'external', url: url || MISSING_URL });

// the first svg inside a node (the node itself, an icon instance, or a vector child), as a Bricks icon control value
export function svgNode(n) {
  if (n.visible === false) return null;
  if (n.svg) return n;
  for (const c of n.children ?? []) { const f = svgNode(c); if (f) return f; }
  return null;
}
export const svgIcon = (n) => (n.svg ? { library: 'svg', svg: { $asset: n.svg.file, size: 'full' } } : null);

// ---- the look of a box as Bricks control values (fill, border + radius, padding): form fields, slider arrows ----
const sides = (p) => ({ top: px(p.top), right: px(p.right), bottom: px(p.bottom), left: px(p.left) });

export function boxLook(n, warn) {
  const out = {};
  const fill = n.fills?.filter((f) => f.type === 'SOLID').pop();
  if (fill) out.background = colorObj(fill);
  else if (n.fills?.length) warn(n, `fill type ${n.fills.at(-1).type} cannot go into a form control (only a solid color)`);
  const border = {};
  const st = n.stroke;
  if (st && st.paints.at(-1).type === 'SOLID') {
    const w = st.weights ?? { top: st.weight, right: st.weight, bottom: st.weight, left: st.weight };
    Object.assign(border, { width: sides(w), style: st.dashes ? 'dashed' : 'solid', color: colorObj(st.paints.at(-1)) });
  }
  if (n.radius) { const [tl, tr, br, bl] = n.radius; border.radius = { top: px(tl), right: px(tr), bottom: px(br), left: px(bl) }; }
  if (Object.keys(border).length) out.border = border;
  if (n.layout?.padding) out.padding = sides(n.layout.padding);
  return out;
}


// Browsers give ul / ol / dl / dd / figure default margins and paddings (and bullets): a semantic tag must not move the Figma layout.
// `defaults` are only used where the build did not already write that key (e.g. the Figma padding wins); `css` goes to the element's custom css.
export const ZERO = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
const RESET_TAGS = new Set(['ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'nav', 'article', 'address']);
export const tagReset = (tag) => (RESET_TAGS.has(tag)
  ? { defaults: { _margin: { ...ZERO }, _padding: { ...ZERO } }, css: ['ul', 'ol'].includes(tag) ? [{ decl: 'list-style: none;', suffix: '' }] : [] }
  : { defaults: {}, css: [] });
