// Figma auto layout -> Bricks flex or grid. Each function writes one attribute from the tree.
import { addCustomCss, px, r4 } from '../../write-bricks/render/utils/css.mjs';
import { isArtStack, overflowsParent } from '../../write-bricks/render/utils/art.mjs';
import { isGradientRing, strokeMode, strokeWidths } from '../../write-bricks/render/utils/stroke.mjs';

const JUSTIFY = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
const ALIGN = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' };
const CONTENT = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between', SPACE_AROUND: 'space-around', SPACE_EVENLY: 'space-evenly' };

const flowChildren = (node) => (node?.children ?? []).filter((child) => child.visible !== false && child.place !== 'ABSOLUTE');

function writeFlex(layout, settings, expect) {
  const horizontal = layout.mode === 'HORIZONTAL';
  settings._display = 'flex';
  settings._direction = horizontal ? 'row' : 'column';
  settings._justifyContent = JUSTIFY[layout.primaryAlign] ?? 'flex-start';
  settings._alignItems = ALIGN[layout.counterAlign] ?? 'flex-start';
  settings._flexWrap = layout.wrap ? 'wrap' : 'nowrap';
  const mainGap = horizontal ? '_columnGap' : '_rowGap';
  const crossGap = horizontal ? '_rowGap' : '_columnGap';
  if (layout.primaryAlign !== 'SPACE_BETWEEN') {
    settings[mainGap] = px(layout.gap);
    expect[horizontal ? 'column-gap' : 'row-gap'] = px(layout.gap);
  }
  if (layout.wrap && layout.counterGap != null) settings[crossGap] = px(layout.counterGap);
  if (layout.counterAlignContent && CONTENT[layout.counterAlignContent]) {
    addCustomCss(settings, `align-content: ${CONTENT[layout.counterAlignContent]};`);
  }
}

function writeGrid(layout, settings, expect) {
  const align = ALIGN[layout.counterAlign] ?? 'flex-start';
  const justify = JUSTIFY[layout.primaryAlign] ?? 'flex-start';
  settings._display = 'grid';
  if (layout.columns) settings._gridTemplateColumns = layout.columns;
  if (layout.rows) settings._gridTemplateRows = layout.rows;
  if (layout.columnGap != null && layout.rowGap != null) {
    settings._gridGap = layout.columnGap === layout.rowGap ? px(layout.columnGap) : `${px(layout.columnGap)} ${px(layout.rowGap)}`;
  }
  settings._alignItemsGrid = align;
  settings._justifyContentGrid = justify;
  addCustomCss(settings, `grid-template-columns: ${layout.columns}; grid-template-rows: ${layout.rows}; column-gap: ${px(layout.columnGap)}; row-gap: ${px(layout.rowGap)}; align-items: ${align} !important; justify-content: ${justify} !important;`);
  Object.assign(expect, { 'column-gap': px(layout.columnGap), 'row-gap': px(layout.rowGap) });
  if (layout.counterAlignContent && CONTENT[layout.counterAlignContent]) settings._alignContentGrid = CONTENT[layout.counterAlignContent];
}

// CSS border sits inside the box. Figma padding is measured from the outer edge, so an inside stroke is removed from the padding.
function paddingAfterStroke(node, padding, warn) {
  const stroke = node.stroke;
  if (!stroke) return padding;
  const widths = strokeWidths(stroke);
  const even = widths.top === widths.right && widths.right === widths.bottom && widths.bottom === widths.left;
  const drawnAsShadow = stroke.align !== 'INSIDE' && !stroke.dashes && stroke.paints.length === 1 && even;
  const drawnAsBorder = strokeMode(node) === 'border' && !stroke.inLayout && !drawnAsShadow && !isGradientRing(node) && stroke.paints.at(-1).type === 'SOLID';
  if (drawnAsBorder) {
    const next = Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side) => [side, Math.max(0, r4(padding[side] - widths[side]))]));
    for (const side of Object.keys(next)) {
      if (padding[side] < widths[side]) warn(node, `padding-${side} ${padding[side]} is smaller than the stroke ${widths[side]}: content shifts by ${r4(widths[side] - padding[side])}px`);
    }
    return next;
  }
  if (isGradientRing(node) && stroke.inLayout && stroke.align === 'INSIDE') {
    const weight = stroke.weight;
    return { top: padding.top + weight, right: padding.right + weight, bottom: padding.bottom + weight, left: padding.left + weight };
  }
  return padding;
}

// A centered child larger than the content box is drawn across the padding. Keeping that padding would clip it.
function dropPaddingAroundCenteredChild(node, layout, padding) {
  const children = flowChildren(node);
  if (children.length !== 1 || layout.mode === 'GRID') return padding;
  const child = children[0];
  const next = { ...padding };
  const drop = (along, align) => {
    if (align !== 'CENTER') return;
    const room = along ? node.box.w - next.left - next.right : node.box.h - next.top - next.bottom;
    const size = along ? child.box.w : child.box.h;
    if (size <= room + 0.01) return;
    if (along) { next.left = 0; next.right = 0; }
    else { next.top = 0; next.bottom = 0; }
  };
  drop(layout.mode === 'HORIZONTAL', layout.primaryAlign);
  drop(layout.mode !== 'HORIZONTAL', layout.counterAlign);
  return next;
}

function writePadding(node, padding, settings, expect, kind) {
  if (kind !== 'section' && !padding.top && !padding.right && !padding.bottom && !padding.left) return;
  settings._padding = { top: px(padding.top), right: px(padding.right), bottom: px(padding.bottom), left: px(padding.left) };
  Object.assign(expect, {
    'padding-top': px(padding.top),
    'padding-right': px(padding.right),
    'padding-bottom': px(padding.bottom),
    'padding-left': px(padding.left),
  });
}

function holdsAbsolute(node) {
  return (node.children ?? []).some((child) => child.visible !== false && child.place === 'ABSOLUTE');
}

function pulledArt(node) {
  return node.clip && (node.children ?? []).some((child) => child.visible !== false && child.place !== 'ABSOLUTE' && isArtStack(child) && overflowsParent(child, node));
}

// Columns of a heading plus the same number of cells share row tracks.
function rowTracks(node) {
  if (node.layout?.mode !== 'HORIZONTAL') return null;
  const columns = flowChildren(node).filter((child) => child.layout?.mode === 'VERTICAL');
  if (columns.length < 3) return null;
  const bands = columns.map((column) => {
    const list = flowChildren(column).find((part) => flowChildren(part).length >= 3);
    return list ? { column, list, cells: flowChildren(list).length } : null;
  });
  if (bands.some((band) => !band)) return null;
  const cells = bands[0].cells;
  if (cells < 3 || bands.some((band) => band.cells !== cells)) return null;
  return { columns: bands.length, cells, bands };
}

function writeRowTracks(node, settings) {
  const tracks = rowTracks(node);
  if (!tracks) return;
  delete settings._display;
  delete settings._direction;
  addCustomCss(settings, `display: grid; grid-template-columns: repeat(${tracks.columns}, minmax(0, 1fr)); grid-template-rows: auto repeat(${tracks.cells}, auto); align-items: stretch;`);
  for (const band of tracks.bands) {
    band.column.__rowTrack = { role: 'column', cells: tracks.cells };
    band.list.__rowTrack = { role: 'list', cells: tracks.cells };
  }
}

function writeSubgrid(node, settings) {
  const track = node.__rowTrack;
  if (!track) return;
  delete settings._display;
  delete settings._direction;
  const span = track.role === 'column' ? track.cells + 1 : track.cells;
  const start = track.role === 'column' ? 1 : 2;
  addCustomCss(settings, `display: grid; grid-template-rows: subgrid; grid-row: ${start} / span ${span}; min-width: 0;`);
}

export function applyLayout({ node, s, css, warn }, kind) {
  const layout = node.layout;
  if (!layout) {
    if (hasVisibleChild(node) && s._position !== 'absolute') s._position = 'relative';
    return;
  }
  if (layout.mode === 'GRID') writeGrid(layout, s, css);
  else writeFlex(layout, s, css);
  const padding = dropPaddingAroundCenteredChild(node, layout, paddingAfterStroke(node, layout.padding, warn));
  writePadding(node, padding, s, css, kind);
  if (holdsAbsolute(node) && s._position !== 'absolute') s._position = 'relative';
  const pulled = pulledArt(node);
  if (node.clip && s._position !== 'absolute') {
    s._position = s._position || 'relative';
    if (s._widthMin == null) s._widthMin = '0px';
  }
  if (pulled && s._position !== 'absolute') s._position = 'relative';
  if (pulled && node.sizing?.v === 'HUG' && node.box?.h) {
    s._height = px(node.box.h);
    css.height = px(node.box.h);
  }
  writeRowTracks(node, s);
  writeSubgrid(node, s);
}

function hasVisibleChild(node) {
  return node.children?.some((child) => child.visible !== false);
}
