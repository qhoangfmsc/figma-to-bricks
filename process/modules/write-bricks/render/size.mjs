// Figma sizing + placement -> Bricks width/height/flex/position.
//   FIXED -> px · HUG -> auto (+ no shrink) · FILL -> flex:1 1 <figma px> on the parent's main axis, align-self:stretch on the cross axis
//   place ABSOLUTE (child of a non-auto-layout node) -> position:absolute + left/top/width/height
import { addClassCss, addCustomCss, pct, px, r4 } from '../../write-bricks/render/utils/css.mjs';
import { svgBleed } from '../../write-bricks/render/utils/svg-bleed.mjs';
import { coverOnArtboard, isArtStack, isBackdrop, overflowsParent, pinToParent } from '../../write-bricks/render/utils/art.mjs';

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

// An absolute layer inside an auto-layout frame (a badge, a sticker) follows that frame's constraints.
// The formula is the Figma x at this frame's width, and the same inset once the frame changes width.
// A parent with no auto layout is left on pixel left/top: that parent can become `display: contents` at a
// breakpoint, and a percentage would then be resolved against the grandparent.
function anchorInFrame(node, parent, s) {
  if (node.rotation || !parent.box) return;
  const b = node.box;
  const W = parent.box.w;
  const H = parent.box.h;
  if (!(W > 0) || !(H > 0)) return;
  const h = node.constraints?.horizontal ?? 'LEFT';
  const v = node.constraints?.vertical ?? 'TOP';
  let tx = false;
  let ty = false;
  if (h === 'CENTER') {
    const off = b.x + b.w / 2 - W / 2;
    s._left = off ? `calc(50% ${off < 0 ? '-' : '+'} ${px(Math.abs(off))})` : '50%';
    tx = true;
  } else if (h === 'RIGHT') { delete s._left; s._right = px(W - b.x - b.w); }
  else if (h === 'LEFT_RIGHT') { s._right = px(W - b.x - b.w); s._width = 'auto'; }
  else if (h === 'SCALE') Object.assign(s, { _left: pct((b.x / W) * 100), _width: pct((b.w / W) * 100) });
  if (v === 'CENTER') {
    const off = b.y + b.h / 2 - H / 2;
    s._top = off ? `calc(50% ${off < 0 ? '-' : '+'} ${px(Math.abs(off))})` : '50%';
    ty = true;
  } else if (v === 'BOTTOM') { delete s._top; s._bottom = px(H - b.y - b.h); }
  else if (v === 'TOP_BOTTOM') { s._bottom = px(H - b.y - b.h); s._height = 'auto'; }
  else if (v === 'SCALE') Object.assign(s, { _top: pct((b.y / H) * 100), _height: pct((b.h / H) * 100) });
  if (tx || ty) addCustomCss(s, `transform: translate(${tx ? '-50%' : '0'}, ${ty ? '-50%' : '0'});`);
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
  const bleed = svgBleed(node); // svg exported with its drop shadow around the node box (utils/svg-bleed.mjs)
  if (bleed) node.__svgBleed = bleed;
  // A layer inside an image stack is a percentage of that stack, so the layers stay aligned when the stack scales with the screen.
  if (parent?.__fluid && node.type !== 'TEXT') {
    node.__fluid = true;
    // rotation.mjs writes the unrotated box itself. This branch returns before the absolute placement,
    // so a turned layer would keep left/top in normal flow and the turn would land off the picture.
    if (!node.rotation) pinToParent(node, parent, s);
    else s._position = 'absolute';
    Object.assign(css, { width: px(b.w), height: px(b.h) });
    return;
  }
  // A picture Figma clips, drawn larger than its frame, must not join the flex line: that pixel width is what blows the card open on a narrower screen.
  if (node.place !== 'ABSOLUTE' && parent?.clip && parent.box && isArtStack(node) && overflowsParent(node, parent)) {
    pinToParent(node, parent, s);
    Object.assign(css, { width: px(b.w), height: px(b.h) });
    return;
  }
  if (node.place === 'ABSOLUTE') {
    if (bleed) {
      Object.assign(s, { _position: 'absolute', _left: px(b.x - bleed.left), _top: px(b.y - bleed.top), _width: px(bleed.w), _height: px(bleed.h), _widthMax: 'none' });
      Object.assign(css, { width: px(bleed.w), height: px(bleed.h) });
      if (parent && parent === root) anchorToParent({ ...node, box: { ...b, x: b.x - bleed.left, w: bleed.w } }, parent, s, true);
      return;
    }
    Object.assign(s, { _position: 'absolute', _left: px(b.x), _top: px(b.y), _width: px(b.w), _height: px(b.h) });
    Object.assign(css, { width: px(b.w), height: px(b.h) });
    if (parent?.box && b.w > parent.box.w + 0.01) s._widthMax = 'none'; // wider than its parent in Figma: the theme's `max-width:100%` on images would squeeze it
    // The artboard, and a frame that already spans it, are the screen. Content anchors to that screen; a backdrop scales with it.
    // Any other auto-layout parent keeps the badge on its own corner (anchorInFrame). A parent with no auto layout stays on pixel left/top.
    if (parent && tracksScreen(parent, root)) anchorToParent(node, parent, s, true);
    else if (parent?.layout) anchorInFrame(node, parent, s);
    if (parent && tracksScreen(parent, root) && isBackdrop(node, parent)) {
      if (node.rotation) node.__fluid = true;
      else coverOnArtboard(node, parent, s);
    }
    return;
  }
  const mode = parent?.layout?.mode;
  const grid = mode === 'GRID';
  const primary = grid ? null : mode === 'HORIZONTAL' ? 'h' : 'v'; // a grid cell has no main axis
  if (grid && node.gridCell) addCustomCss(s, `grid-column: ${node.gridCell.col + 1} / span ${node.gridCell.colSpan}; grid-row: ${node.gridCell.row + 1} / span ${node.gridCell.rowSpan};`);
  if (grid && node.gridCell?.align) {
    const place = { MIN: 'start', CENTER: 'center', MAX: 'end', STRETCH: 'stretch' };
    const bits = [];
    const horizontal = place[node.gridCell.align.gridChildHorizontalAlign];
    const vertical = place[node.gridCell.align.gridChildVerticalAlign];
    if (horizontal) bits.push(`justify-self: ${horizontal}`);
    if (vertical) bits.push(`align-self: ${vertical}`);
    if (bits.length) addCustomCss(s, `${bits.join('; ')};`);
    const unknown = Object.entries(node.gridCell.align).filter(([, value]) => !place[value]);
    if (unknown.length) warn(node, `grid cell alignment ${JSON.stringify(Object.fromEntries(unknown))} is not applied`);
  }
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
    if (sz === 'FIXED' && bleed) {
      // the svg is bigger than its layout box: full size, negative margins give the room back so siblings stay where Figma puts them
      const full = axis === 'h' ? bleed.w : bleed.h;
      s[dim] = px(full);
      css[cssDim] = px(full);
      s._margin = { ...(s._margin ?? {}), ...(axis === 'h' ? { left: px(-bleed.left), right: px(-bleed.right) } : { top: px(-bleed.top), bottom: px(-bleed.bottom) }) };
      if (axis === 'h') s._widthMax = 'none';
      if (axis === primary) s._flexShrink = 0;
    } else if (sz === 'FIXED') {
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
        // The Align self control shows the Figma value. `stretch` also writes `width: 100%` (container.php).
        // A class rule of the same specificity, appended after that control, keeps the Figma width. A breakpoint
        // width is a later media query of the same selector, so it still wins below the frame.
        s._alignSelf = 'stretch';
        addCustomCss(s, 'align-self: stretch;');
        if (s._width !== '100%') addClassCss(s, `width: ${s._width || 'auto'};`);
      } else if (parent?.sizing?.[axis] === 'HUG') {
        // The parent hugs this axis, so there is no wider box to fill. Stretch here grows into the grandparent
        // (a 481px form became the whole right column). The Figma box is the size.
        s[dim] = px(boxVal);
        if (axis === 'h') s._widthMax = 'none';
      } else {
        // FILL across a column with a max size (Figma: fill up to the cap, then sit where the parent's counter-axis alignment puts it, e.g. a 260px
        // photo centered in a wider card). `stretch` + max-width would leave it at the start edge.
        const cap = axis === 'h' ? node.limits?.maxWidth : null;
        const align = parent?.layout?.counterAlign;
        if (cap != null && align && align !== 'MIN') { s[dim] = '100%'; s._alignSelf = align === 'CENTER' ? 'center' : 'flex-end'; }
        else {
          s._alignSelf = 'stretch';
          // Fill across a column is the parent width at every window in that band.
          // The drawn px is not a max-width, or a wider phone in the same breakpoint stays short.
          if (axis === 'h') s._width = '100%';
        }
      }
      if (axis === 'h' && node.type === 'TEXT' && node.__inHug) s._widthMax ??= px(boxVal); // see index.mjs markHug
      css[cssDim] = px(boxVal);
    }
  }
  if (!s._alignSelf && node.selfAlign === 'CENTER') s._alignSelf = 'center';
  else if (!s._alignSelf && node.selfAlign === 'MAX') s._alignSelf = 'flex-end';
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
  // A frame that is only pictures keeps its Figma ratio. Height follows the width, so a narrower or wider screen does not leave the layers at one pixel size.
  if (isArtStack(node) && kidsOf(node) && !node.rotation) {
    s._aspectRatio = `${r4(b.w)} / ${r4(b.h)}`;
    if (typeof s._height === 'string' && s._height.endsWith('px')) s._height = 'auto';
    if (s._position !== 'absolute') s._position ??= 'relative';
    node.__fluid = true;
  }
  // A flow child drawn edge to edge follows the screen on every template. Paint at that width is the background.
  // A frame that holds text becomes the screen for its own children, and the text keeps its Figma pixels.
  if (!isSlide && node.place !== 'ABSOLUTE' && tracksScreen(parent, root) && parent?.box && b.w >= parent.box.w - 1) {
    if (isBackdrop(node, parent)) coverOnArtboard(node, parent, s);
    else {
      s._width = '100%';
      node.__screen = true;
    }
  }
}

function tracksScreen(parent, root) {
  return parent === root || parent?.__screen === true;
}

const kidsOf = (node) => (node.children ?? []).some((c) => c.visible !== false);
