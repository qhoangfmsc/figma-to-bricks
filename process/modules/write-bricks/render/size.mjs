// Figma sizing and placement, one function per mode.
// FIXED is a px box. HUG is auto. FILL is flex on the parent's main axis and stretch on the cross axis.
// ABSOLUTE is left/top from the tree, then the Figma constraint (LEFT, RIGHT, CENTER, SCALE).
import { addClassCss, addCustomCss, pct, px, r4 } from '../../write-bricks/render/utils/css.mjs';
import { svgBleed } from '../../write-bricks/render/utils/svg-bleed.mjs';
import { coverOnArtboard, isArtStack, isBackdrop, overflowsParent, pinToParent } from '../../write-bricks/render/utils/art.mjs';

const AXIS = {
  h: { dim: '_width', css: 'width', box: (node) => node.box.w },
  v: { dim: '_height', css: 'height', box: (node) => node.box.h },
};
const GRID_ALIGN = { MIN: 'start', CENTER: 'center', MAX: 'end', STRETCH: 'stretch' };
const SLIDE_WIDTH_KEYS = ['_width', '_widthMax', '_widthMin', '_flexGrow', '_flexShrink', '_flexBasis'];

const hasChildren = (node) => (node.children ?? []).some((child) => child.visible !== false);
const tracksScreen = (parent, root) => parent === root || parent?.__screen === true;

function offsetFromCenter(start, size, parentSize) {
  const offset = start + size / 2 - parentSize / 2;
  if (!offset) return '50%';
  return `calc(50% ${offset < 0 ? '-' : '+'} ${px(Math.abs(offset))})`;
}

function anchorAxis(node, parentSize, start, size, constraint, axis) {
  const settings = {};
  if (constraint === 'CENTER') settings[axis === 'h' ? '_left' : '_top'] = offsetFromCenter(start, size, parentSize);
  else if (constraint === 'RIGHT' || constraint === 'BOTTOM') {
    settings[axis === 'h' ? '_left' : '_top'] = null;
    settings[axis === 'h' ? '_right' : '_bottom'] = px(parentSize - start - size);
  } else if (constraint === 'LEFT_RIGHT' || constraint === 'TOP_BOTTOM') {
    settings[axis === 'h' ? '_right' : '_bottom'] = px(parentSize - start - size);
    settings[axis === 'h' ? '_width' : '_height'] = 'auto';
  } else if (constraint === 'SCALE' && parentSize > 0) {
    settings[axis === 'h' ? '_left' : '_top'] = pct((start / parentSize) * 100);
    settings[axis === 'h' ? '_width' : '_height'] = pct((size / parentSize) * 100);
  }
  return settings;
}

function writeAnchor(settings, fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) delete settings[key];
    else settings[key] = value;
  }
}

// A child of the artboard follows its horizontal constraint. A LEFT child that sits in the
// middle of the artboard was centered by hand, so it stays centered when the viewport changes.
function anchorToArtboard(node, parent, settings) {
  if (node.rotation) return;
  const box = node.box;
  const constraint = node.constraints?.horizontal ?? 'LEFT';
  const centeredByHand = constraint === 'LEFT' && Math.abs(box.x - (parent.box.w - box.w) / 2) <= 1;
  if (constraint === 'CENTER' || centeredByHand) {
    writeAnchor(settings, anchorAxis(node, parent.box.w, box.x, box.w, 'CENTER', 'h'));
    addCustomCss(settings, 'transform: translateX(-50%);');
    return;
  }
  writeAnchor(settings, anchorAxis(node, parent.box.w, box.x, box.w, constraint, 'h'));
}

// An absolute layer inside an auto-layout frame keeps that frame's constraints on both axes.
function anchorInFrame(node, parent, settings) {
  if (node.rotation || !(parent.box?.w > 0) || !(parent.box?.h > 0)) return;
  const box = node.box;
  const horizontal = node.constraints?.horizontal ?? 'LEFT';
  const vertical = node.constraints?.vertical ?? 'TOP';
  writeAnchor(settings, {
    ...anchorAxis(node, parent.box.w, box.x, box.w, horizontal, 'h'),
    ...anchorAxis(node, parent.box.h, box.y, box.h, vertical, 'v'),
  });
  const shiftX = horizontal === 'CENTER';
  const shiftY = vertical === 'CENTER';
  if (shiftX || shiftY) addCustomCss(settings, `transform: translate(${shiftX ? '-50%' : '0'}, ${shiftY ? '-50%' : '0'});`);
}

function placeAbsolute(node, parent, root, settings, expect) {
  const box = node.box;
  const bleed = node.__svgBleed;
  const left = bleed ? box.x - bleed.left : box.x;
  const top = bleed ? box.y - bleed.top : box.y;
  const width = bleed ? bleed.w : box.w;
  const height = bleed ? bleed.h : box.h;
  Object.assign(settings, {
    _position: 'absolute',
    _left: px(left),
    _top: px(top),
    _width: px(width),
    _height: px(height),
  });
  Object.assign(expect, { width: px(width), height: px(height) });
  if (bleed) settings._widthMax = 'none';
  else if (parent?.box && box.w > parent.box.w + 0.01) settings._widthMax = 'none';
  if (bleed) {
    if (parent && parent === root) anchorToArtboard({ ...node, box: { ...box, x: left, w: width } }, parent, settings);
    return;
  }
  const onScreen = parent && tracksScreen(parent, root);
  if (onScreen) anchorToArtboard(node, parent, settings);
  else if (parent?.layout) anchorInFrame(node, parent, settings);
  if (onScreen && isBackdrop(node, parent)) {
    if (node.rotation) node.__fluid = true;
    else coverOnArtboard(node, parent, settings);
  }
}

function resolvedMode(node, parent, axis, grid) {
  let mode = node.sizing[axis];
  if (node.__intrinsic && mode === 'HUG') mode = 'FIXED';
  const empty = node.type !== 'TEXT' && !hasChildren(node);
  if (mode === 'HUG' && empty) mode = 'FIXED';
  const parentHugs = !grid && parent?.sizing?.[axis] === 'HUG';
  const siblingsCannotSize = (parent?.children ?? []).every((child) => (
    child === node || child.visible === false || child.place === 'ABSOLUTE'
    || (child.sizing?.[axis] === 'FILL' && !hasChildren(child))
  ));
  if (mode === 'FILL' && parentHugs && empty && siblingsCannotSize) mode = 'FIXED';
  return mode;
}

function writeFixed(node, axis, settings, expect, boxValue, primary) {
  const { dim, css } = AXIS[axis];
  const bleed = node.__svgBleed;
  if (bleed) {
    const full = axis === 'h' ? bleed.w : bleed.h;
    settings[dim] = px(full);
    expect[css] = px(full);
    const inset = axis === 'h'
      ? { left: px(-bleed.left), right: px(-bleed.right) }
      : { top: px(-bleed.top), bottom: px(-bleed.bottom) };
    settings._margin = { ...(settings._margin ?? {}), ...inset };
    if (axis === 'h') settings._widthMax = 'none';
  } else {
    settings[dim] = px(boxValue);
    expect[css] = px(boxValue);
  }
  if (axis === primary) settings._flexShrink = 0;
}

function writeHug(axis, settings, primary) {
  settings[AXIS[axis].dim] = 'auto';
  if (axis === primary) settings._flexShrink = 0;
  if (axis === 'h') settings._widthMax = 'none';
}

function childHangsOutside(node) {
  const box = node.box;
  if (!box) return false;
  return (node.children ?? []).some((child) => {
    if (child.visible === false || child.place !== 'ABSOLUTE' || !child.box) return false;
    const left = child.box.x - box.x;
    const top = child.box.y - box.y;
    return left < -0.5 || top < -0.5 || left + child.box.w > box.w + 0.5 || top + child.box.h > box.h + 0.5;
  });
}

function writeFill(node, parent, axis, settings, expect, boxValue, primary, grid, mode) {
  const { dim, css } = AXIS[axis];
  settings[dim] = 'auto';
  if (axis === primary) {
    Object.assign(settings, { _flexGrow: 1, _flexShrink: 1, _flexBasis: px(boxValue) });
    if (axis === 'h') settings._widthMin = '0px';
  } else if (grid) {
    if (axis === 'v') addCustomCss(settings, 'align-self: stretch;');
  } else if (mode === 'HORIZONTAL' && !childHangsOutside(node)) {
    // Bricks writes width 100% with the stretch control, which would drop a fixed width on this item.
    // An absolute child drawn outside this frame is positioned against the frame box, so the frame keeps that box.
    settings._alignSelf = 'stretch';
    addCustomCss(settings, 'align-self: stretch;');
    if (settings._width && settings._width !== '100%') addClassCss(settings, `width: ${settings._width};`);
  } else if (parent?.sizing?.[axis] === 'HUG') {
    settings[dim] = px(boxValue);
    if (axis === 'h') settings._widthMax = 'none';
  } else {
    const cap = axis === 'h' ? node.limits?.maxWidth : null;
    const align = parent?.layout?.counterAlign;
    if (cap != null && align && align !== 'MIN') {
      settings[dim] = '100%';
      settings._alignSelf = align === 'CENTER' ? 'center' : 'flex-end';
    } else {
      settings._alignSelf = 'stretch';
      if (axis === 'h') settings._width = '100%';
    }
  }
  if (axis === 'h' && node.type === 'TEXT' && node.__inHug) settings._widthMax ??= px(boxValue);
  expect[css] = px(boxValue);
}

function sizeFlowAxis(node, parent, axis, settings, expect, primary, grid, mode) {
  const boxValue = strokeBox(node, axis, settings);
  const sizing = resolvedMode(node, parent, axis, grid);
  if (sizing === 'FIXED') writeFixed(node, axis, settings, expect, boxValue, primary);
  else if (sizing === 'HUG') writeHug(axis, settings, primary);
  else if (sizing === 'FILL') writeFill(node, parent, axis, settings, expect, boxValue, primary, grid, mode);
}

// A zero-thickness frame whose children are strokes uses the exported svg size. The frame itself stays in place.
function strokeBox(node, axis, settings) {
  const drawn = AXIS[axis].box(node);
  if (!node.svg?.width || drawn >= 0.5) return drawn;
  const full = axis === 'h' ? node.svg.width : node.svg.height;
  const bleed = px(-(full - drawn) / 2);
  const inset = axis === 'h' ? { left: bleed, right: bleed } : { top: bleed, bottom: bleed };
  settings._margin = { ...(settings._margin ?? {}), ...inset };
  return full;
}

function writeGridCell(node, settings, warn) {
  const cell = node.gridCell;
  if (!cell) return;
  addCustomCss(settings, `grid-column: ${cell.col + 1} / span ${cell.colSpan}; grid-row: ${cell.row + 1} / span ${cell.rowSpan};`);
  if (!cell.align) return;
  const bits = [];
  const horizontal = GRID_ALIGN[cell.align.gridChildHorizontalAlign];
  const vertical = GRID_ALIGN[cell.align.gridChildVerticalAlign];
  if (horizontal) bits.push(`justify-self: ${horizontal}`);
  if (vertical) bits.push(`align-self: ${vertical}`);
  if (bits.length) addCustomCss(settings, `${bits.join('; ')};`);
  const unknown = Object.entries(cell.align).filter(([, value]) => !GRID_ALIGN[value]);
  if (unknown.length) warn(node, `grid cell alignment ${JSON.stringify(Object.fromEntries(unknown))} is not applied`);
}

function contentRoom(parent) {
  if (!parent?.box) return Infinity;
  const pad = parent.layout?.padding;
  return parent.box.w - (pad?.left ?? 0) - (pad?.right ?? 0);
}

export function applySize({ node, parent, root, s, css, warn }, { isRoot, isSlide }) {
  if (isRoot) {
    s._width = '100%';
    if (node.sizing.v === 'FIXED') { s._height = px(node.box.h); css.height = px(node.box.h); }
    for (const [from, to] of [['minHeight', '_heightMin'], ['maxHeight', '_heightMax']]) {
      if (node.limits?.[from] != null) s[to] = px(node.limits[from]);
    }
    return;
  }

  const bleed = svgBleed(node);
  if (bleed) node.__svgBleed = bleed;

  if (parent?.__fluid && node.type !== 'TEXT') {
    node.__fluid = true;
    if (!node.rotation) pinToParent(node, parent, s);
    else s._position = 'absolute';
    Object.assign(css, { width: px(node.box.w), height: px(node.box.h) });
    return;
  }

  if (node.place !== 'ABSOLUTE' && parent?.clip && parent.box && isArtStack(node) && overflowsParent(node, parent)) {
    const box = node.box;
    const frame = parent.box;
    const onlyWider = box.y >= -0.5 && box.y + box.h <= frame.h + 0.5 && box.x + box.w > frame.w + 0.5;
    if (!(onlyWider && parent.layout?.mode === 'VERTICAL')) pinToParent(node, parent, s);
    else {
      s._width = px(box.w);
      s._height = px(box.h);
      s._widthMin = '0px';
      s._widthMax = 'none';
    }
    Object.assign(css, { width: px(box.w), height: px(box.h) });
    return;
  }

  if (node.place === 'ABSOLUTE') {
    placeAbsolute(node, parent, root, s, css);
    return;
  }

  const mode = parent?.layout?.mode;
  const grid = mode === 'GRID';
  const primary = grid ? null : mode === 'HORIZONTAL' ? 'h' : 'v';
  if (grid) writeGridCell(node, s, warn);
  for (const axis of ['h', 'v']) sizeFlowAxis(node, parent, axis, s, css, primary, grid, mode);

  if (!s._alignSelf && node.selfAlign === 'CENTER') s._alignSelf = 'center';
  else if (!s._alignSelf && node.selfAlign === 'MAX') s._alignSelf = 'flex-end';
  for (const [from, to] of [['minWidth', '_widthMin'], ['maxWidth', '_widthMax'], ['minHeight', '_heightMin'], ['maxHeight', '_heightMax']]) {
    if (node.limits?.[from] != null) s[to] = px(node.limits[from]);
  }
  if (isSlide) for (const key of SLIDE_WIDTH_KEYS) delete s[key];

  const room = contentRoom(parent);
  if (!isSlide && node.sizing.h === 'FIXED') s._widthMax ??= node.box.w > room + 0.01 ? 'none' : '100%';
  else if (!isSlide && node.__intrinsic && node.box.w > room + 0.01) s._widthMax ??= 'none';

  if (isArtStack(node) && hasChildren(node) && !node.rotation) {
    s._aspectRatio = `${r4(node.box.w)} / ${r4(node.box.h)}`;
    // Aspect ratio replaces a fixed height so the frame scales with its width.
    // A child drawn outside the frame is placed against this box, so the box height stays.
    if (typeof s._height === 'string' && s._height.endsWith('px') && !childHangsOutside(node)) s._height = 'auto';
    if (s._position !== 'absolute') s._position ??= 'relative';
    node.__fluid = true;
  }

  if (!isSlide && node.place !== 'ABSOLUTE' && tracksScreen(parent, root) && parent?.box && node.box.w >= parent.box.w - 1) {
    if (isBackdrop(node, parent)) coverOnArtboard(node, parent, s);
    else {
      s._width = '100%';
      node.__screen = true;
    }
  }
}
