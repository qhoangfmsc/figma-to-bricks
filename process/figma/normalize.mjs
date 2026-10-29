// RAW Figma node JSON  ->  normalized tree (tree.json).
//
// Rules:
//  * LOSSLESS for everything that has a visual meaning: values are copied as Figma gives them (only unit
//    conversions: 0..1 colors -> hex, absolute -> parent-relative coordinates).
//  * Nothing is silently dropped: every raw key is classified in schema/handling.json; a key that is not there, or a visual one the build does not
//    reproduce and that the node really uses, ends up in node.unhandled and is printed in tree.md / report.md.
import { safeId } from '../shared/workspace.mjs';
import { enumFlag, nodeFlag, textFlag } from '../schema/handling.mjs';
import { relayoutInstances } from './relayout.mjs';

const num = (v, d = 0) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : d);

// what happens to every raw key (read / ignored with a reason / reported) is decided in schema/handling.json, see schema/handling.mjs

export function color(c, extraOpacity = 1) {
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return { hex: `#${h(c.r)}${h(c.g)}${h(c.b)}`, alpha: num((c.a ?? 1) * extraOpacity) };
}

function paint(p) {
  const alpha = p.opacity ?? 1;
  if (p.type === 'SOLID') return { type: 'SOLID', ...color(p.color, alpha), ...(p.blendMode && p.blendMode !== 'NORMAL' && { blendMode: p.blendMode }) };
  if (p.type === 'IMAGE') {
    return {
      type: 'IMAGE', imageRef: p.imageRef, scaleMode: p.scaleMode, alpha,
      ...(p.imageTransform && { imageTransform: p.imageTransform }),
      ...(p.scalingFactor && { scalingFactor: p.scalingFactor }),
      ...(p.rotation && { rotation: p.rotation }),
      ...(p.filters && Object.keys(p.filters).length && { filters: p.filters }),
    };
  }
  if (p.type?.startsWith('GRADIENT')) {
    return {
      type: p.type, alpha, handles: p.gradientHandlePositions,
      stops: (p.gradientStops ?? []).map((s) => ({ position: num(s.position), ...color(s.color) })),
    };
  }
  return { type: p.type, alpha, raw: true };
}

const visibleList = (l) => (l ?? []).filter((x) => x.visible !== false);

function effect(e) {
  if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
    return { type: e.type, ...color(e.color), x: num(e.offset?.x), y: num(e.offset?.y), blur: num(e.radius), spread: num(e.spread) };
  }
  return { type: e.type, radius: num(e.radius) }; // LAYER_BLUR / BACKGROUND_BLUR
}

function sizing(raw, parent) {
  let h = raw.layoutSizingHorizontal;
  let v = raw.layoutSizingVertical;
  if (h && v) return { h, v };

  const parentDir = parent?.layoutMode; // HORIZONTAL | VERTICAL | undefined
  const own = { h: 'FIXED', v: 'FIXED' };

  if (raw.layoutMode === 'HORIZONTAL' || raw.layoutMode === 'VERTICAL') {
    const prim = raw.primaryAxisSizingMode === 'AUTO' ? 'HUG' : 'FIXED';
    const cnt = raw.counterAxisSizingMode === 'AUTO' ? 'HUG' : 'FIXED';
    if (raw.layoutMode === 'HORIZONTAL') Object.assign(own, { h: prim, v: cnt });
    else Object.assign(own, { h: cnt, v: prim });
  } else if (raw.type === 'TEXT') {
    const r = raw.style?.textAutoResize;
    if (r === 'WIDTH_AND_HEIGHT') Object.assign(own, { h: 'HUG', v: 'HUG' });
    else if (r === 'HEIGHT') Object.assign(own, { v: 'HUG' });
  }

  if (parentDir === 'HORIZONTAL' || parentDir === 'VERTICAL') {
    const primary = parentDir === 'HORIZONTAL' ? 'h' : 'v';
    const counter = parentDir === 'HORIZONTAL' ? 'v' : 'h';
    if (raw.layoutGrow === 1) own[primary] = 'FILL';
    if (raw.layoutAlign === 'STRETCH') own[counter] = 'FILL';
  }
  return { h: h ?? own.h, v: v ?? own.v };
}

function textRuns(raw) {
  const ov = raw.characterStyleOverrides;
  if (!ov?.length || !ov.some((k) => k !== 0)) return undefined;
  const chars = [...raw.characters];
  const runs = [];
  let cur = null;
  chars.forEach((ch, i) => {
    const key = ov[i] ?? 0;
    if (cur && cur.key === key) cur.text += ch;
    else runs.push((cur = { key, text: ch }));
  });
  return runs.map(({ key, text }) => {
    const o = key ? raw.styleOverrideTable?.[key] : null;
    const style = o && normTextStyle(o);
    // One override over the WHOLE text whose size / weight / line height is bound to a variable: the table keeps the value of the text style (Body-text-sm: 12px)
    // while the node's own style is the value resolved for the frame's variable mode (mobile: 8px, and Figma's render bounds of the text are 8px high).
    // Partial runs (a bold word) are real overrides and stay.
    if (style && runs.length === 1 && o.boundVariables && raw.style) {
      const bound = o.boundVariables, base = normTextStyle(raw.style);
      for (const [variable, keys] of Object.entries({ fontSize: ['fontSize'], fontWeight: ['fontWeight'], fontFamily: ['fontFamily'], lineHeight: ['lineHeightPx', 'lineHeightUnit', 'lineHeightPercentFontSize'] })) {
        if (bound[variable]) for (const k of keys) if (base[k] !== undefined) style[k] = base[k];
      }
    }
    return { text, ...(style && { style }) };
  });
}

function normTextStyle(s) {
  const out = {};
  for (const k of ['fontFamily', 'fontStyle', 'italic', 'fontWeight', 'fontSize', 'textCase', 'textDecoration', 'letterSpacing', 'lineHeightPx', 'lineHeightUnit', 'lineHeightPercentFontSize']) {
    if (s[k] !== undefined) out[k] = typeof s[k] === 'number' ? num(s[k]) : s[k];
  }
  if (s.fills) out.fills = visibleList(s.fills).map(paint);
  return out;
}

export function normalizeNode(raw, ctx, parent = null, parentAbs = null) {
  const abs = raw.absoluteBoundingBox ?? { x: 0, y: 0, width: raw.size?.x ?? 0, height: raw.size?.y ?? 0 };
  const rel = parentAbs ? { x: num(abs.x - parentAbs.x), y: num(abs.y - parentAbs.y) } : { x: 0, y: 0 };
  const LAYOUTS = ['HORIZONTAL', 'VERTICAL', 'GRID'];
  const isAuto = LAYOUTS.includes(raw.layoutMode);
  const isGrid = raw.layoutMode === 'GRID';
  const parentAuto = LAYOUTS.includes(parent?.layoutMode);

  const node = { id: raw.id, type: raw.type, name: raw.name };
  if (raw.visible === false) node.visible = false;

  node.box = { x: rel.x, y: rel.y, w: num(abs.width), h: num(abs.height), absX: num(abs.x), absY: num(abs.y) };
  if (raw.rotation) {
    node.rotation = raw.rotation;
    // the unrotated box + 2x2 matrix, exactly as Figma stores them (needs geometry=paths, see api.mjs); matrix kept unrounded
    const t = raw.relativeTransform;
    if (raw.size && t) node.rotate = { w: num(raw.size.x), h: num(raw.size.y), x: num(t[0][2]), y: num(t[1][2]), m: [t[0][0], t[1][0], t[0][1], t[1][1]] };
  }
  node.sizing = sizing(raw, parent);
  for (const k of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']) if (raw[k] != null) (node.limits ??= {})[k] = num(raw[k]);

  if (isAuto) {
    node.layout = {
      mode: raw.layoutMode,
      wrap: raw.layoutWrap === 'WRAP',
      gap: num(raw.itemSpacing),
      ...(raw.counterAxisSpacing != null && { counterGap: num(raw.counterAxisSpacing) }),
      padding: { top: num(raw.paddingTop), right: num(raw.paddingRight), bottom: num(raw.paddingBottom), left: num(raw.paddingLeft) },
      primaryAlign: raw.primaryAxisAlignItems ?? 'MIN',
      counterAlign: raw.counterAxisAlignItems ?? 'MIN',
      ...(raw.counterAxisAlignContent && raw.counterAxisAlignContent !== 'AUTO' && { counterAlignContent: raw.counterAxisAlignContent }),
      // Figma GRID: track lists are CSS strings already ('repeat(2,minmax(0,1fr))', 'repeat(2,fit-content(100%))')
      ...(isGrid && { columnGap: num(raw.gridColumnGap), rowGap: num(raw.gridRowGap), columns: raw.gridColumnsSizing, rows: raw.gridRowsSizing, columnCount: raw.gridColumnCount, rowCount: raw.gridRowCount }),
    };
  }
  if (parent?.layoutMode === 'GRID' && raw.gridColumnAnchorIndex != null) {
    node.gridCell = { col: raw.gridColumnAnchorIndex, row: raw.gridRowAnchorIndex, colSpan: raw.gridColumnSpan ?? 1, rowSpan: raw.gridRowSpan ?? 1 };
    for (const k of ['gridChildHorizontalAlign', 'gridChildVerticalAlign']) if (raw[k] && raw[k] !== 'AUTO') (node.gridCell.align ??= {})[k] = raw[k];
  }

  // how this node is placed inside its parent
  if (parentAuto) node.place = raw.layoutPositioning === 'ABSOLUTE' ? 'ABSOLUTE' : 'FLOW';
  else if (parent) node.place = 'ABSOLUTE';
  if (raw.constraints && (node.place === 'ABSOLUTE')) node.constraints = raw.constraints;
  if (raw.layoutAlign && raw.layoutAlign !== 'INHERIT') node.selfAlign = raw.layoutAlign;
  if (raw.layoutGrow) node.grow = raw.layoutGrow;

  // paint / stroke / shape
  const fills = visibleList(raw.fills).map(paint);
  if (fills.length) node.fills = fills;
  const strokes = visibleList(raw.strokes).map(paint);
  if (strokes.length) {
    node.stroke = {
      paints: strokes,
      weight: num(raw.strokeWeight),
      ...(raw.individualStrokeWeights && {
        weights: { top: num(raw.individualStrokeWeights.top), right: num(raw.individualStrokeWeights.right), bottom: num(raw.individualStrokeWeights.bottom), left: num(raw.individualStrokeWeights.left) },
      }),
      align: raw.strokeAlign ?? 'INSIDE',
      inLayout: !!raw.strokesIncludedInLayout,
      ...(raw.strokeDashes?.length && { dashes: raw.strokeDashes }),
    };
  }
  if (raw.rectangleCornerRadii) node.radius = raw.rectangleCornerRadii.map((v) => num(v)); // [tl, tr, br, bl]
  else if (raw.cornerRadius) node.radius = [num(raw.cornerRadius), num(raw.cornerRadius), num(raw.cornerRadius), num(raw.cornerRadius)];
  if (raw.cornerSmoothing) node.cornerSmoothing = raw.cornerSmoothing;
  const effects = visibleList(raw.effects).map(effect);
  if (effects.length) node.effects = effects;
  if (raw.opacity != null && raw.opacity !== 1) node.opacity = num(raw.opacity);
  if (raw.clipsContent) node.clip = true;
  if (raw.blendMode && !['PASS_THROUGH', 'NORMAL'].includes(raw.blendMode)) node.blendMode = raw.blendMode;
  if (raw.isMask) node.isMask = true;

  // text
  if (raw.type === 'TEXT') {
    const s = raw.style ?? {};
    node.text = {
      characters: raw.characters ?? '',
      fontFamily: s.fontFamily, fontStyle: s.fontStyle, fontWeight: s.fontWeight, italic: !!s.italic,
      fontSize: num(s.fontSize),
      lineHeightPx: num(s.lineHeightPx), lineHeightUnit: s.lineHeightUnit,
      ...(s.lineHeightUnit === 'FONT_SIZE_%' && { lineHeightPercentFontSize: num(s.lineHeightPercentFontSize ?? s.lineHeightPercent) }),
      letterSpacing: num(s.letterSpacing),
      align: s.textAlignHorizontal ?? 'LEFT', valign: s.textAlignVertical ?? 'TOP',
      case: s.textCase ?? 'ORIGINAL', decoration: s.textDecoration ?? 'NONE',
      autoResize: s.textAutoResize ?? 'NONE',
      ...(s.paragraphSpacing && { paragraphSpacing: num(s.paragraphSpacing) }),
      ...(s.paragraphIndent && { paragraphIndent: num(s.paragraphIndent) }),
      ...(s.textTruncation && { truncation: s.textTruncation, maxLines: s.maxLines }),
    };
    // bullet / numbered list formatting of the text layer: one entry per line (paragraph), with its level
    if ((raw.lineTypes ?? []).some((k) => k && k !== 'NONE')) node.text.listLines = raw.lineTypes.map((type, i) => ({ type, level: raw.lineIndentations?.[i] ?? 0 }));
    const runs = textRuns(raw);
    if (runs) node.text.runs = runs;
    for (const k of Object.keys(s)) {
      const flag = textFlag(k, s[k]) ?? enumFlag(k, s[k]);
      if (flag) (node.unhandled ??= []).push(`style.${flag}`);
    }
  }

  // references (names only, to keep styles/components traceable)
  if (raw.componentId) {
    const def = ctx.components?.[raw.componentId];
    node.component = def?.name ?? raw.componentId; // the variant, e.g. "Size=xl, State=Default"
    const set = def?.componentSetId && ctx.componentSets?.[def.componentSetId]?.name;
    if (set) node.componentSet = set; // the component the designer named, e.g. "Buttons/Button"
  }
  // what the designer declared on an instance: variant choices, booleans (e.g. "Tooltips icon" = true), texts, swaps
  if (raw.componentProperties && Object.keys(raw.componentProperties).length) {
    node.props = Object.fromEntries(Object.entries(raw.componentProperties).map(([k, p]) => [k.replace(/#\d+:\d+$/, ''), p.value]));
  }
  // prototype: trigger -> action (hover / click / navigate to a variant ...). Not rendered by Figma exports, but it is the designer's statement of behavior
  if (raw.interactions?.length) {
    node.interactions = raw.interactions.flatMap((i) => (i.actions?.length ? i.actions : [{}]).map((a) => ({ trigger: i.trigger?.type, action: a.type, navigation: a.navigation, dest: a.destinationId, url: a.url, duration: a.transition?.duration, easing: a.transition?.easing?.type })));
  }
  if (raw.styles) {
    node.styleRefs = Object.fromEntries(Object.entries(raw.styles).map(([k, id]) => [k, ctx.styleNames?.[id] ?? id]));
  }
  if (raw.boundVariables && Object.keys(raw.boundVariables).length) node.variables = raw.boundVariables;

  // assets
  const svg = ctx.manifest.svgs?.[safeId(raw.id)];
  if (svg) node.svg = { file: svg.file, bytes: svg.bytes, ...(svg.width && { width: svg.width, height: svg.height }) };
  for (const f of node.fills ?? []) {
    if (f.type === 'IMAGE') {
      const a = ctx.manifest.images?.[f.imageRef];
      if (!a) (node.unhandled ??= []).push(`missing image asset ${f.imageRef}`);
      else f.asset = { file: a.file, width: a.width, height: a.height, sha256: a.sha256 };
    }
  }

  for (const k of Object.keys(raw)) {
    const flag = nodeFlag(k, raw[k]) ?? enumFlag(k, raw[k]);
    if (flag) (node.unhandled ??= []).push(flag);
  }

  // SVG roots are leaves for us: the whole subtree is the exported SVG
  if (!svg && raw.children?.length) {
    node.children = raw.children.map((c) => normalizeNode(c, ctx, raw, abs));
  } else if (svg && raw.children?.length) {
    node.svgOfChildren = raw.children.length;
  }

  return node;
}

export function normalizeRoot(rawResponse, nodeId, manifest) {
  const entry = rawResponse.nodes[nodeId];
  if (!entry) throw new Error(`raw.json has no node ${nodeId}`);
  const ctx = {
    manifest,
    components: entry.components,
    componentSets: entry.componentSets,
    styleNames: Object.fromEntries(Object.entries(entry.styles ?? {}).map(([id, s]) => [id, s.name])),
  };
  const tree = normalizeNode(entry.document, ctx);
  relayoutInstances(tree); // boxes inside instances are stored as laid out for the main component, see relayout.mjs
  return tree;
}
