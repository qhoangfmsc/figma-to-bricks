// Figma auto layout -> Bricks flex. Always written explicitly so theme defaults never leak.
// Nodes without auto layout get `position:relative` when they have children (children are absolute, see size.mjs).
import { addCustomCss, px, r4 } from './utils/css.mjs';
import { isGradientRing, strokeMode, strokeWidths } from './utils/stroke.mjs';

// Main axis plain 'center' too: content wider than the box overflows on BOTH sides in Figma as well (Registration mobile: the date/time bar sits at x 27.5, which
// 'safe center' turned into 44; the regression guard showed no other section changed).
// Cross axis plain 'center': a child wider / taller than the box overflows on BOTH sides in Figma (Hero run: a 658px glow in a 195px
// column sits at x=-231.5, a 93px row in an 88px content box sits at y=5.5 of 104), which is what CSS `center` does.
const JUSTIFY = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
const ALIGN = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' };

export function applyLayout({ node, s, css, warn }, kind) {
  const l = node.layout;
  if (!l) {
    if (node.children?.some((c) => c.visible !== false) && s._position !== 'absolute') s._position = 'relative';
    return;
  }
  if (l.mode === 'GRID') {
    // Figma GRID -> CSS grid: Bricks 1.9.8 has `_display: grid` but no track controls, so tracks and gaps are custom css. Items are start-aligned
    // (a HUG-height card must not stretch to the tallest card of its row); cells come from each child's grid anchor (size.mjs).
    s._display = 'grid';
    addCustomCss(s, `grid-template-columns: ${l.columns}; grid-template-rows: ${l.rows}; column-gap: ${px(l.columnGap)}; row-gap: ${px(l.rowGap)}; align-items: start !important;`); // !important: Bricks writes `align-items: initial` for every `_display: grid`
    Object.assign(css, { 'column-gap': px(l.columnGap), 'row-gap': px(l.rowGap) });
  } else {
    s._display = 'flex';
    s._direction = l.mode === 'HORIZONTAL' ? 'row' : 'column';
    s._justifyContent = JUSTIFY[l.primaryAlign] ?? 'flex-start';
    s._alignItems = ALIGN[l.counterAlign] ?? 'flex-start';
    s._flexWrap = l.wrap ? 'wrap' : 'nowrap';
    const rowGapKey = l.mode === 'HORIZONTAL' ? '_columnGap' : '_rowGap';
    const crossGapKey = l.mode === 'HORIZONTAL' ? '_rowGap' : '_columnGap';
    if (l.primaryAlign !== 'SPACE_BETWEEN') {
      s[rowGapKey] = px(l.gap);
      css[l.mode === 'HORIZONTAL' ? 'column-gap' : 'row-gap'] = px(l.gap);
    }
    if (l.wrap && l.counterGap != null) s[crossGapKey] = px(l.counterGap);
  }
  // Figma measures padding from the outer edge (an INSIDE stroke is drawn over it unless "strokes included in layout");
  // a CSS border sits inside the box, so it must be taken out of the padding to land on the same content area.
  let p = l.padding;
  const st = node.stroke;
  // (a CENTER / OUTSIDE stroke takes no space either: when stroke.mjs can only draw it as a border, e.g. a 4px left bar with align CENTER, the same applies)
  const asShadows = st && st.align !== 'INSIDE' && !st.dashes && st.paints.length === 1 && (() => { const w = strokeWidths(st); return w.top === w.right && w.right === w.bottom && w.bottom === w.left; })();
  if (st && strokeMode(node) === 'border' && !st.inLayout && !asShadows && !isGradientRing(node) && st.paints[st.paints.length - 1].type === 'SOLID') {
    const w = strokeWidths(st);
    p = Object.fromEntries(['top', 'right', 'bottom', 'left'].map((k) => [k, Math.max(0, r4(l.padding[k] - w[k]))]));
    for (const k of Object.keys(p)) if (l.padding[k] < w[k]) warn(node, `padding-${k} ${l.padding[k]} is smaller than the stroke ${w[k]}: content shifts by ${r4(w[k] - l.padding[k])}px`);
  }
  // a gradient ring that Figma counts in the layout (INSIDE + "include stroke in layout") pushes the content in by its width, like a border would
  if (node.stroke && isGradientRing(node) && node.stroke.inLayout && node.stroke.align === 'INSIDE') { const w = node.stroke.weight; p = { top: p.top + w, right: p.right + w, bottom: p.bottom + w, left: p.left + w }; }
  if (kind === 'section' || p.top || p.right || p.bottom || p.left) {
    s._padding = { top: px(p.top), right: px(p.right), bottom: px(p.bottom), left: px(p.left) };
    Object.assign(css, { 'padding-top': px(p.top), 'padding-right': px(p.right), 'padding-bottom': px(p.bottom), 'padding-left': px(p.left) });
  }
  if (node.children?.some((c) => c.visible !== false && c.place === 'ABSOLUTE') && s._position !== 'absolute') s._position = 'relative';
}
