// Figma sizing + placement -> Bricks width/height/flex/position.
//   FIXED -> px · HUG -> auto (+ no shrink) · FILL -> flex:1 1 <figma px> on the parent's main axis, align-self:stretch on the cross axis
//   place ABSOLUTE (child of a non-auto-layout node) -> position:absolute + left/top/width/height
import { addCustomCss, pct, px } from './utils/css.mjs';

// A child of the artboard follows the viewport the way the Figma horizontal constraint says (CENTER, RIGHT, LEFT_RIGHT, SCALE): the root is as wide as
// the viewport (100%). Left-anchored children keep their pixel x. The Figma horizontal constraint says how (CENTER, RIGHT, LEFT_RIGHT, SCALE); every formula gives the exact Figma
// x / width at the artboard width. A LEFT child that sits exactly in the middle of the artboard (|x - (W - w) / 2| <= 1px: the designer centered a
// column by hand, owner remark 2026-10-27 "hero lệch") is anchored to the middle too, otherwise it drifts off-screen on every other width.
function anchorToParent(node, parent, s, isArtboard) {
  if (node.rotation) return; // a rotated node is placed by rotation.mjs (its own transform)
  const b = node.box;
  const W = parent.box.w;
  const h = node.constraints?.horizontal ?? 'LEFT';
  // the hand-centered LEFT heuristic is only for the artboard (a column the designer centered by hand); in any other parent only the Figma constraint decides
  if (h === 'CENTER' || (isArtboard && h === 'LEFT' && Math.abs(b.x - (W - b.w) / 2) <= 1)) {
    // anchor the element's own middle to the artboard's middle (translate, not a width-based left: `max-width:100%` can make the box narrower than Figma's)
    const off = b.x + b.w / 2 - W / 2;
    s._left = off ? `calc(50% ${off < 0 ? '-' : '+'} ${px(Math.abs(off))})` : '50%';
    addCustomCss(s, 'transform: translateX(-50%);');
  }
  else if (h === 'RIGHT') { delete s._left; s._right = px(W - b.x - b.w); }
  else if (h === 'LEFT_RIGHT') { s._right = px(W - b.x - b.w); s._width = 'auto'; }
  else if (h === 'SCALE') Object.assign(s, { _left: pct((b.x / W) * 100), _width: pct((b.w / W) * 100) });
}

const SLIDE_DROP = ['_width', '_widthMax', '_widthMin', '_flexGrow', '_flexShrink', '_flexBasis']; // slide width belongs to the slider (perPage + gap); height and align-self stay

export function applySize({ node, parent, root, s, css, warn }, { isRoot, isSlide }) {
  const b = node.box;
  if (isRoot) {
    s._width = '100%'; // artboard width is a viewport, not a fixed width
    if (node.sizing.v === 'FIXED') { s._height = px(b.h); css.height = px(b.h); }
    // a hugging artboard with a minimum height (Banner: h HUG, minHeight 540) is as tall as its content only above that minimum
    for (const [k, key] of [['minHeight', '_heightMin'], ['maxHeight', '_heightMax']]) if (node.limits?.[k] != null) s[key] = px(node.limits[k]);
    return;
  }
  if (node.place === 'ABSOLUTE') {
    Object.assign(s, { _position: 'absolute', _left: px(b.x), _top: px(b.y), _width: px(b.w), _height: px(b.h) });
    Object.assign(css, { width: px(b.w), height: px(b.h) });
    if (parent?.box && b.w > parent.box.w + 0.01) s._widthMax = 'none'; // wider than its parent in Figma: the theme's `max-width:100%` on images would squeeze it
    // only the artboard's own children are anchored: in any other parent the containing block can differ from the Figma parent (a wrapper that
    // becomes `display: contents` at a breakpoint), and `left: 50%` then lands in the wrong box (Hero tablet / mobile registration panel)
    if (parent && parent === root) anchorToParent(node, parent, s, true);
    return;
  }
  const mode = parent?.layout?.mode;
  const grid = mode === 'GRID';
  const primary = grid ? null : mode === 'HORIZONTAL' ? 'h' : 'v'; // a grid cell has no main axis
  if (grid && node.gridCell) addCustomCss(s, `grid-column: ${node.gridCell.col + 1} / span ${node.gridCell.colSpan}; grid-row: ${node.gridCell.row + 1} / span ${node.gridCell.rowSpan};`);
  if (grid && node.gridCell?.align) warn(node, `grid cell alignment ${JSON.stringify(node.gridCell.align)} is not applied`);
  for (const axis of ['h', 'v']) {
    const dim = axis === 'h' ? '_width' : '_height';
    const cssDim = axis === 'h' ? 'width' : 'height';
    let sz = node.sizing[axis];
    if (node.__intrinsic && sz === 'HUG') sz = 'FIXED'; // images/svg: use the Figma box
    if (sz === 'HUG' && node.type !== 'TEXT' && !(node.children ?? []).some((c) => c.visible !== false)) sz = 'FIXED'; // nothing inside to hug: the browser would collapse it to its padding, Figma paints its stored box
    // an empty FILL child in a parent that hugs on the same axis with nothing else to size it (a 28px tooltip icon frame in a HUG container): in a browser it
    // contributes 0 and the parent collapses to 0, Figma paints the stored box
    if (sz === 'FILL' && !grid && parent?.sizing?.[axis] === 'HUG' && node.type !== 'TEXT' && !(node.children ?? []).some((c) => c.visible !== false)
      && (parent.children ?? []).every((c) => c === node || c.visible === false || c.place === 'ABSOLUTE' || (c.sizing?.[axis] === 'FILL' && !(c.children ?? []).some((k) => k.visible !== false)))) sz = 'FIXED';
    let boxVal = axis === 'h' ? b.w : b.h;
    // a frame with no extent on this axis whose children are strokes (Figma: Pagination 120×0 with five 4px round-cap lines on its edge): the exported svg is as
    // big as the strokes (124×4) and sits half a stroke before the frame's edge, a 0px svg would show nothing
    if (node.svg?.width && boxVal < 0.5) {
      const full = axis === 'h' ? node.svg.width : node.svg.height;
      const bleed = px(-(full - boxVal) / 2); // both sides: the frame takes no room in the layout, the strokes only overflow it
      s._margin = { ...(s._margin ?? {}), ...(axis === 'h' ? { left: bleed, right: bleed } : { top: bleed, bottom: bleed }) };
      boxVal = full;
    }
    if (sz === 'FIXED') {
      s[dim] = px(boxVal);
      css[cssDim] = px(boxVal);
      if (axis === primary) s._flexShrink = 0;
    } else if (sz === 'HUG') {
      s[dim] = 'auto';
      if (axis === primary) s._flexShrink = 0; // a hugging item is never squeezed below its content in Figma
      if (axis === 'h') s._widthMax = 'none'; // Bricks/theme default max-width:100% would clamp content that overflows its parent
    } else if (sz === 'FILL') {
      s[dim] = 'auto';
      if (axis === primary) {
        // basis = the Figma size (border-box): with basis 0, CSS adds each sibling's padding+border on top of the equal share, Figma does not
        Object.assign(s, { _flexGrow: 1, _flexShrink: 1, _flexBasis: px(boxVal) });
        if (axis === 'h') s._widthMin = '0px';
      } else if (grid) {
        if (axis === 'v') addCustomCss(s, 'align-self: stretch;'); // FILL width in a grid is plain width:auto (cells stretch); only FILL height needs it
      } else if (mode === 'HORIZONTAL') {
        // the Bricks container control `_alignSelf: stretch` also writes `width: 100%` (container.php), which overrides a fixed width in a row;
        // Figma's STRETCH here only means "fill the height", so write plain align-self
        addCustomCss(s, 'align-self: stretch;');
      } else {
        // FILL across a column with a max size (Figma: fill up to the cap, then sit where the parent's counter-axis alignment puts it, e.g. a 260px
        // photo centered in a wider card). `stretch` + max-width would leave it at the start edge.
        const cap = axis === 'h' ? node.limits?.maxWidth : null;
        const align = parent?.layout?.counterAlign;
        if (cap != null && align && align !== 'MIN') { s[dim] = '100%'; s._alignSelf = align === 'CENTER' ? 'center' : 'flex-end'; }
        else s._alignSelf = 'stretch';
      }
      if (axis === 'h' && node.type === 'TEXT' && node.__inHug) s._widthMax ??= px(boxVal); // see index.mjs markHug
      css[cssDim] = px(boxVal);
    }
  }
  for (const [k, key] of [['minWidth', '_widthMin'], ['maxWidth', '_widthMax'], ['minHeight', '_heightMin'], ['maxHeight', '_heightMax']]) {
    if (node.limits?.[k] != null) s[key] = px(node.limits[k]);
  }
  if (isSlide) for (const k of SLIDE_DROP) delete s[k];
  // never wider than the viewport: no effect on desktop, keeps fixed widths from overflowing on small screens
  // exception: a child that is wider than its parent's content box overflows in Figma (fixed 18px icon in a 24px frame with 10px padding),
  // max-width:100% would squeeze it to the 4px of content box
  const pad = parent?.layout?.padding;
  const room = parent?.box ? parent.box.w - (pad?.left ?? 0) - (pad?.right ?? 0) : Infinity;
  if (!isSlide && node.sizing.h === 'FIXED') s._widthMax ??= b.w > room + 0.01 ? 'none' : '100%';
  else if (!isSlide && node.__intrinsic && b.w > room + 0.01) s._widthMax ??= 'none'; // svg / image: the theme clamps `svg` to max-width:100% too
}
