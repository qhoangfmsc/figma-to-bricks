// tree.json -> Bricks elements.  DETERMINISTIC: same tree + same overrides = same output, no AI.
//
// The Bricks tree mirrors the Figma tree 1:1 (every visible node becomes exactly one element, except
// image-crop nodes which need a wrapper). Every value comes from the tree; nothing is inferred from pixels.
//
// This file is only the orchestrator (walk the tree, pick the element, assign ids, build mapping.json).
// The actual Figma -> Bricks rules live in the neighbouring modules, one concern each:
//   size.mjs · layout.mjs · text.mjs · style.mjs · ../components/ (approved detections: tooltip, button…) (calls utils/*: fill, gradient, stroke, radius, effects, blur, rotation, appearance)
//
// RULES (the whole contract, keep in sync with ../../README.md):
//  element   root FRAME -> section · TEXT -> heading if text style is "H<n>/..." else text-basic · leaf with IMAGE fill -> image
//            vector-only subtree or icon-font text -> svg (uploaded file) · everything else -> block · overrides.nodes[id].element wins
//  size      FIXED -> px · HUG -> auto (+ no shrink) · FILL -> flex:1 1 <figma px> on the parent's main axis, align-self:stretch on the cross axis
//  layout    auto layout -> flex (direction, gap, justify/align, padding, wrap), always written explicitly so theme defaults never leak
//  slider    override element slider-nested: the slider owns the flow (no direction/gap), padding is kept, autoHeight when Figma height is hug
//  stroke    INSIDE stroke never takes space in Figma: CSS border + padding reduced by the stroke when the padding can absorb it, else an inset box-shadow
//  place     child of a non-auto-layout node (or layoutPositioning ABSOLUTE) -> position:absolute + left/top
//  style     fill/stroke/radius/shadow/opacity/clip -> _background/_border/_boxShadow/_opacity/_overflow
//  text      font family/size/weight, line-height px, letter-spacing px, align, case, decoration, color
//  anything with no Bricks equivalent is NOT guessed: it is listed in report.md as a warning.
import { createHash } from 'node:crypto';
import { addCustomCss, pct, px, r4 } from './utils/css.mjs';
import { deepMerge } from './utils/merge.mjs';
import { applySize } from './size.mjs';
import { applyLayout } from './layout.mjs';
import { applyStyle } from './style.mjs';
import { applyText } from './text.mjs';
import { COMPONENTS } from '../components/index.mjs';

export { deepMerge };

// does any visible layer (outside a clipping ancestor) reach beyond the left / right edge of the frame? (positions are relative to the parent)
export function overflowsSideways(frame) {
  const W = frame.box.w;
  const walk = (n, ox) => (n.children ?? []).some((c) => {
    if (c.visible === false || !c.box) return false;
    const x = ox + c.box.x;
    if (x < -0.5 || x + c.box.w > W + 0.5) return true;
    return !c.clip && walk(c, x);
  });
  return walk(frame, 0);
}

export function buildTemplate(root, { overrides = {}, detections = null, flats = {}, readAsset, salt = '' } = {}) {
  const nodeOv = overrides.nodes ?? {};
  // only APPROVED detections change the build (see detect/index.mjs); proposed / rejected nodes stay plain blocks
  const approved = new Map((detections?.components ?? []).filter((c) => c.status === 'approved').map((c) => [c.node, c]));
  const elements = [];
  const mapping = {};
  const warnings = [];
  const usedIds = new Set();
  const rootAbs = { x: root.box.absX, y: root.box.absY };

  const warn = (node, msg) => warnings.push({ node: node.id, name: node.name, msg });

  function brickId(figmaId) {
    for (let i = 0; ; i++) {
      const h = createHash('sha1').update(`${salt}|${figmaId}|${i}`).digest();
      let n = h.readUIntBE(0, 6);
      let s = '';
      for (let k = 0; k < 6; k++) { s += (n % 36).toString(36); n = Math.floor(n / 36); }
      s = 'abcdefghijklmnopqrstuvwxyz'[parseInt(s[0], 36) % 26] + s.slice(1);
      if (!usedIds.has(s)) { usedIds.add(s); return s; }
    }
  }

  // ALT POLICY (owner decision 2026-10-26): never the layer name. alt = overrides.alt, else text the owner tied to the image (semantic caption /
  // alts), else the variant name of a brand logo (designer-declared: component "brand-logo", property "Property 1"), else EMPTY and reported.
  (function annotateAlt(n, inherited) {
    const own = n.type === 'INSTANCE' && /^brand-logo$/i.test(n.name) && typeof n.props?.['Property 1'] === 'string' ? n.props['Property 1'] : inherited;
    if (own) n.__altHint = own;
    for (const c of n.children ?? []) annotateAlt(c, own);
  })(root, null);
  const altFor = (node, ov, patch) => {
    const alt = ov.alt ?? patch?.settings?.altText ?? node.__altHint ?? '';
    if (!alt && ov.alt !== '') warn(node, 'image has no alt text in Figma: alt is empty (designer list)');
    return alt;
  };

  const headingTag = (node) => {
    const m = node.styleRefs?.text?.match(/^H([1-6])(?:\b|\/)/);
    return m ? `h${m[1]}` : null;
  };
  // Figma crops an image with `imageTransform`: scaleMode CROP always, and STRETCH when the transform is not the identity (the Hero run found
  // the portraits and glows drawn that way: ignoring it showed the whole picture stretched into the box). Both become wrapper + positioned image.
  const hasTransform = (T) => !!T && (Math.abs(T[0][0] - 1) > 1e-4 || Math.abs(T[1][1] - 1) > 1e-4 || Math.abs(T[0][2]) > 1e-4 || Math.abs(T[1][2]) > 1e-4);
  const isCropFill = (f) => f?.scaleMode === 'CROP' || (f?.scaleMode === 'STRETCH' && hasTransform(f.imageTransform));
  const isImageLeaf = (node) => !(node.children?.length) && node.fills?.some((f) => f.type === 'IMAGE') && node.type !== 'TEXT';

  // ---------- recursion ----------
  function mapNode(node, parent, parentBricksId, { isRoot = false, isSlide = false } = {}) {
    const ov = nodeOv[node.id] ?? {};
    if (node.visible === false) { mapping[node.id] = { skipped: 'hidden in Figma' }; return; }
    if (ov.skip) { mapping[node.id] = { skipped: `override: ${ov.reason ?? 'skip'}` }; return; }
    if (mergedInto.has(node.id)) { const d = mergedInto.get(node.id); mapping[node.id] = { skipped: `merged into ${d.component} ${d.id}` }; return; }

    const imageLeaf = isImageLeaf(node);
    node.__intrinsic = imageLeaf || !!node.svg || !!plan.get(node.id)?.comp.intrinsic; // no fit-to-content in CSS: keep the Figma box
    const crop = imageLeaf && isCropFill(node.fills.find((f) => f.type === 'IMAGE'));
    const hTag = node.type === 'TEXT' ? headingTag(node) : null;

    const { det, comp } = plan.get(node.id) ?? {};

    const patch = patches.get(node.id); // what an ancestor's component says about this node (e.g. tab title, accordion content)
    const kind = ov.element
      ?? patch?.kind
      ?? comp?.kind?.(node, det)
      ?? (node.svg ? 'svg' : node.type === 'TEXT' ? (hTag ? 'heading' : 'text-basic') : imageLeaf && !crop ? 'image' : isRoot ? 'section' : 'block');

    const s = {}; // Bricks settings
    const css = {}; // css the verify step expects to measure in the browser
    const ctx = { node, parent, s, css, warn, kind, root, flats, inner: comp?.wrap ? {} : undefined }; // inner: settings of the element a wrapping component puts inside the block
    applySize(ctx, { isRoot, isSlide });
    // a page frame that does not clip, with a layer sticking out of its left / right edge: Figma's picture stops at the frame edge, a page would scroll sideways
    if (isRoot && !node.clip && overflowsSideways(node)) s._overflow = 'hidden'; // the Bricks attribute (Style > Layout > Overflow)
    const isSlider = kind === 'slider-nested';
    const ownLayout = node.type !== 'TEXT' && !imageLeaf && !node.svg && !comp?.skipsStyle;
    if (ownLayout) {
      if (isSlider) {
        if (node.sizing.v !== 'FIXED') s.autoHeight = true; // Bricks default is 50vh; Figma height here is hug-content
        if (node.layout) {
          const p = node.layout.padding;
          if (p.top || p.right || p.bottom || p.left) s._padding = { top: px(p.top), right: px(p.right), bottom: px(p.bottom), left: px(p.left) };
        }
      } else applyLayout(ctx, kind);
    }

    // Layer order. Figma stacks children in layer order; CSS paints a positioned element (the absolute glow / background siblings) ABOVE every
    // in-flow element whatever the DOM order. A flow child beside absolute siblings therefore becomes `position: relative` (no layout change),
    // so the DOM order decides again (the Hero run: an absolute glow image covered the whole in-flow content column).
    if (node.place === 'FLOW' && !s._position && parent?.children?.some((c) => c.visible !== false && c.place === 'ABSOLUTE')) s._position = 'relative';

    if (kind === 'section') s.tag = 'section';
    if (node.type === 'TEXT' && !node.svg) applyText(ctx);
    if (kind === 'heading') s.tag = ov.tag ?? hTag ?? 'h2';
    if (ov.tag && kind !== 'heading') s.tag = ov.tag;

    // svg as an uploaded file: Bricks "code" SVGs need a signature and render a placeholder without it
    if (node.svg) s.file = { $asset: node.svg.file, size: 'full' };

    let wrapperSettings = null;
    if (imageLeaf) {
      const fill = node.fills.find((f) => f.type === 'IMAGE');
      if (node.fills.length > 1) warn(node, 'image fill combined with other fills: only the image is built');
      applyStyle(ctx, { skipFill: true });
      const image = { $asset: fill.asset.file, size: 'full' };
      if (crop) {
        const T = fill.imageTransform;
        if (!T || T[0][1] || T[1][0]) { warn(node, 'CROP with rotation/skew is not supported'); }
        const [[sx, , tx], [, sy, ty]] = T ?? [[1, 0, 0], [0, 1, 0]];
        wrapperSettings = s; // the wrapper takes the node's own placement + style
        Object.assign(wrapperSettings, { _position: wrapperSettings._position ?? 'relative', _overflow: 'hidden' });
        const inner = {
          image, altText: altFor(node, ov, patch), loading: 'eager',
          _position: 'absolute', _width: pct(100 / sx), _height: pct(100 / sy), _left: pct((-tx / sx) * 100), _top: pct((-ty / sy) * 100),
          _widthMax: 'none', _objectFit: 'fill',
        };
        return emit(node, 'block', wrapperSettings, css, parentBricksId, ov, { isSlide, after: (id) => emitRaw(`${node.id}#crop`, 'image', inner, id, node.name + ' (crop)') });
      }
      // An image that FILLs the height of a row that hugs its content (Feature: a 1:1 photo beside a 524px list): as an <img> it would drive the row to its own
      // aspect-ratio height (558px), Figma's row is as tall as the other column and the picture fills it. Wrapper takes the placement, the picture covers it.
      if (fill.scaleMode === 'FILL' && node.sizing.v === 'FILL' && parent?.layout?.mode === 'HORIZONTAL' && parent.sizing?.v === 'HUG') {
        wrapperSettings = s;
        Object.assign(wrapperSettings, { _position: wrapperSettings._position ?? 'relative', _overflow: 'hidden' });
        const inner = { image, altText: altFor(node, ov, patch), loading: 'lazy', _position: 'absolute', _top: '0px', _left: '0px', _width: '100%', _height: '100%', _widthMax: 'none', _objectFit: 'cover' };
        return emit(node, 'block', wrapperSettings, css, parentBricksId, ov, { isSlide, after: (id) => emitRaw(`${node.id}#fill`, 'image', inner, id, node.name + ' (fill)') });
      }
      s.image = image;
      s.altText = altFor(node, ov, patch);
      s._objectFit = { FILL: 'cover', FIT: 'contain', STRETCH: 'fill' }[fill.scaleMode] ?? 'cover';
      if (!['FILL', 'FIT', 'STRETCH'].includes(fill.scaleMode)) warn(node, `image scaleMode ${fill.scaleMode} approximated as cover`);
    } else if (!comp?.skipsStyle) {
      applyStyle(ctx, { skipFill: node.type === 'TEXT' }); // a TEXT fill is the text color, not a background
    }

    const applied = comp?.apply?.(ctx, det) ?? null;
    if (patch?.settings) Object.assign(s, deepMerge(s, patch.settings));
    for (const k of patch?.dropSettings ?? []) delete s[k]; // e.g. `_display` of an accordion content block: the theme's open / closed rule must decide it (see components/accordion.mjs)
    for (const [k, v] of Object.entries(patch?.defaults ?? {})) s[k] ??= v; // an ancestor's component gives defaults that never override what the build wrote
    for (const c of patch?.css ?? []) addCustomCss(s, c.decl, c.suffix ?? ''); // css an ancestor's component writes on this element (e.g. the shared tooltip look on the root)
    emit(node, kind, s, css, parentBricksId, ov, { isSlide, parent, isSlider, extra: patch?.extraChildren, component: comp && { id: det.component, detection: det.id, merges: !!comp.mergesChildren, attrs: applied?.attrs }, inner: comp?.wrap ? { name: comp.innerKind, settings: ctx.inner } : undefined, keep: new Set(comp?.keepNodes?.(node, det) ?? []) });
  }

  function emitRaw(key, name, settings, parent, label) {
    const id = brickId(key);
    if (typeof settings._cssCustom === 'string') settings._cssCustom = settings._cssCustom.replaceAll('%root%', `#brxe-${id}`);
    elements.push({ id, name, parent, label, settings });
    mapping[key] = { bricksId: id, element: name, verify: false };
    return id;
  }

  function emit(node, kind, s, css, parentBricksId, ov, { isSlide, isSlider, after, component, extra, inner, keep = new Set() } = {}) {
    let settings = s;
    for (const k of ov.dropSettings ?? []) delete settings[k];
    if (ov.settings) settings = deepMerge(settings, ov.settings);
    if (ov.cssClasses) settings._cssClasses = ov.cssClasses;

    const id = brickId(node.id);
    // %root% is only resolved inside the builder; the frontend needs the real selector
    if (typeof settings._cssCustom === 'string') settings._cssCustom = settings._cssCustom.replaceAll('%root%', `#brxe-${id}`);
    elements.push({ id, name: kind, parent: parentBricksId, label: ov.label ?? node.name, settings });
    mapping[node.id] = {
      bricksId: id, element: kind, verify: ov.verify !== false,
      ...(component && { component: component.id, detection: component.detection }),
      expect: node.__svgBleed
        ? { x: r4(node.box.absX - node.__svgBleed.left - rootAbs.x), y: r4(node.box.absY - node.__svgBleed.top - rootAbs.y), w: node.__svgBleed.w, h: node.__svgBleed.h, css, ...(component?.attrs && { attrs: component.attrs }) }
        : { x: r4(node.box.absX - rootAbs.x), y: r4(node.box.absY - rootAbs.y), w: node.box.w, h: node.box.h, css, ...(component?.attrs && { attrs: component.attrs }) },
    };
    after?.(id);
    if (inner) emitRaw(`${node.id}#inner`, inner.name, inner.settings, id, inner.name); // wrapping component: the block keeps the Figma frame, the real element sits inside
    if (node.children) {
      for (const c of node.children) {
        if (component?.merges && c.visible !== false && !keep.has(c.id)) mapping[c.id] = { skipped: `merged into ${component.id} ${component.detection}` };
        else mapNode(c, node, id, { isSlide: kind === 'slider-nested' });
      }
    }
    // elements Bricks needs that Figma does not draw (e.g. an empty tab pane): created empty, never invented content
    (extra ?? []).forEach((x, i) => emitExtra(`${node.id}#extra${i}`, x, id));
    return id;
  }
  // An element Bricks needs that Figma does not draw. `children` nest ({ name, label, settings, children }). `like` = the Figma node id of a drawn element of the
  // same kind (the open FAQ item's answer): the new element takes its settings (fill, padding, typography...) once every node is emitted, and `text` replaces its text.
  const pendingLike = [];
  function emitExtra(key, x, parent) {
    const id = emitRaw(key, x.name ?? 'block', { ...(x.settings ?? {}) }, parent, x.label ?? x.name ?? 'block');
    if (x.like || x.text !== undefined) pendingLike.push({ id, like: x.like, text: x.text, drop: x.drop });
    (x.children ?? []).forEach((c, j) => emitExtra(`${key}.${j}`, c, id));
    return id;
  }
  const FIXED_HEIGHT = ['_height', '_heightMin', '_heightMax'];
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
  function resolveLike() {
    for (const { id, like, text, drop } of pendingLike) {
      const el = elements.find((e) => e.id === id), src = like && elements.find((e) => e.id === mapping[like]?.bricksId);
      if (!like) { if (el && text !== undefined) el.settings.text = esc(text); continue; } // nothing drawn to copy: Bricks defaults, the text is still the owner's
      if (!el || !src) { if (el) warn({ id: like, name: '?' }, `copy of node ${like} not possible: it is not built, ${el.label} keeps Bricks defaults`); continue; }
      const copy = structuredClone(src.settings);
      for (const k of [...FIXED_HEIGHT, ...(drop ?? [])]) delete copy[k]; // the new content is longer or shorter than the drawn one: its height follows the text
      if (copy._typography?.['white-space']) copy._typography = Object.fromEntries(Object.entries(copy._typography).filter(([k]) => k !== 'white-space')); // a one-line drawn text must not make a longer one overflow
      if (typeof copy._cssCustom === 'string') copy._cssCustom = copy._cssCustom.replaceAll(`#brxe-${src.id}`, `#brxe-${el.id}`); // the copied rules named the source element
      el.settings = { ...copy, ...el.settings };
      if (text !== undefined) el.settings.text = esc(text);
    }
  }

  // approved detections -> what the build will do. A detection whose node cannot become the component stays a block and is warned.
  const plan = new Map(); // node id -> { det, comp }
  const mergedInto = new Map(); // node id -> det that swallows it (e.g. a tooltip popup drawn loose in Figma)
  const patches = new Map(); // node id -> { kind?, settings?, extraChildren? } set by an ancestor's component
  for (const det of approved.values()) {
    const node = findNode(root, det.node);
    if (!node) continue; // detect step reports stale nodes
    const comp = COMPONENTS[det.component];
    const isCrop = isImageLeaf(node) && node.fills.find((f) => f.type === 'IMAGE')?.scaleMode === 'CROP';
    const chk = !comp ? { ok: false, reason: 'unknown component' } : comp.status !== 'implemented' ? { ok: false, reason: `component "${det.component}" is ${comp.status}` } : isCrop ? { ok: false, reason: 'image crop nodes are not supported' } : comp.check(node, det, { root, flats });
    if (!chk.ok) { warn(node, `detection ${det.id} (${det.component}) approved but not applied, kept as block: ${chk.reason}`); continue; }
    plan.set(node.id, { det, comp });
    for (const w of chk.warnings ?? []) warn(node, `${det.component} ${det.id}: ${w}`);
    for (const [id, p] of Object.entries(comp.descendants?.(node, det, { root }) ?? {})) patches.set(id, p);
    for (const id of comp.mergedNodes?.(det, node) ?? []) mergedInto.set(id, det);
  }

  // text that FILLS a parent which itself hugs its content: Figma sizes such a parent from the other children and wraps the text inside it (a
  // 420px, two line paragraph in a 452px hugging card), while CSS sizes a hugging box from the text's one-line width. Marked here, capped in size.mjs.
  (function markHug(n, inHug) { n.__inHug = inHug; const h = inHug || n.sizing?.h === 'HUG'; for (const c of n.children ?? []) markHug(c, h); })(root, false);

  mapNode(root, null, 0, { isRoot: true });
  resolveLike();

  // The Bricks builder (not the frontend) gives every EMPTY element `min-width/min-height: 90px` through a zero-specificity rule
  // (:where(.brx-draggable.brx-empty)), so a 12x12 shape looks 90x90 there. An explicit 0 minimum on empty blocks keeps the builder canvas at the Figma size.
  const hasChild = new Set(elements.map((e) => e.parent));
  for (const e of elements) {
    if (e.name === 'block' && !hasChild.has(e.id)) { e.settings._widthMin ??= '0px'; e.settings._heightMin ??= '0px'; }
  }

  for (const id of Object.keys(nodeOv)) if (!(id in mapping) && !findNode(root, id)) warnings.push({ node: id, name: '?', msg: 'override refers to a node that is not in the tree' });

  return {
    template: { title: overrides.template?.title ?? `${root.name} (figma ${root.id})`, type: overrides.template?.type ?? 'section', content: elements },
    mapping,
    warnings,
  };
}

function findNode(n, id) {
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const f = findNode(c, id); if (f) return f; }
  return null;
}
