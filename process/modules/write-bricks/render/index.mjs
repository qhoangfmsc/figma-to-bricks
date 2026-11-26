// tree.json -> Bricks elements.  DETERMINISTIC: same tree + same overrides = same output, no AI.
//
// The Bricks tree mirrors the Figma tree 1:1 (every visible node becomes exactly one element). An image
// sits in a div: the div sets the width and height, and the image is always 100% by 100%. `.brxe-block`
// is flex column and width 100%, which fights that box, so the wrapper is a div.
// Every value comes from the tree; nothing is inferred from pixels.
//
// This file is only the orchestrator (walk the tree, pick the element, assign ids, build mapping.json).
// The actual Figma -> Bricks rules live in the neighbouring modules, one concern each:
//   size.mjs · layout.mjs · text.mjs · style.mjs · ../components/ (approved detections: tooltip, button…) (calls utils/*: fill, gradient, stroke, radius, effects, blur, rotation, appearance)
//
// RULES (the whole contract, keep in sync with ../../README.md):
//  element   root FRAME -> section · TEXT -> heading if text style is "H<n>/..." else text-basic · leaf with IMAGE fill -> div (width and height) > image (always 100% × 100%)
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
import { addCustomCss, pct, px, r4 } from '../../write-bricks/render/utils/css.mjs';
import { markPeekScroll } from '../../write-bricks/render/utils/peek-scroll.mjs';
import { schemaTraps, sealThemeDefaults } from '../../write-bricks/render/utils/schema-traps.mjs';
import { deepMerge } from '../../write-bricks/render/utils/merge.mjs';
import { applySize } from '../../write-bricks/render/size.mjs';
import { applyLayout } from '../../write-bricks/render/layout.mjs';
import { applyStyle } from '../../write-bricks/render/style.mjs';
import { applyText } from '../../write-bricks/render/text.mjs';
import { COMPONENTS } from '../../write-bricks/components/index.mjs';
import priceTable from '../../write-bricks/components/price-table.mjs';
import compareTable from '../../write-bricks/components/compare-table.mjs';
import { siblingStatePatches } from '../../write-bricks/components/states.mjs';
import { closeMarkIds, popupCard } from '../../recognize-parts/rules/shape.mjs';
import { isDomainLookup } from '../../recognize-parts/rules/layout-only.mjs';
import { detectActionForms } from '../../recognize-parts/rules/form.mjs';
import { PartKind, isSignal, isKind, isAnyKind, StateKind, isPaginationHint } from '../../recognize-parts/kinds.mjs';
import { resolvedRole } from '../../write-bricks/components/button.mjs';

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

function acceptedDetections(root, detections) {
  const priceReady = new Set();
  const priceSkipped = [];
  const compareReady = new Set();
  const compareSkipped = [];
  for (const c of detections?.components ?? []) {
    if (c.status !== 'approved' || !isKind(c, PartKind.PRICE_TABLE)) continue;
    const node = findNode(root, c.node);
    if (node && priceTable.check(node, c, { root }).ok) priceReady.add(c.node);
  }
  for (const c of detections?.components ?? []) {
    if (c.status !== 'approved' || !isKind(c, PartKind.COMPARE_TABLE)) continue;
    const node = findNode(root, c.node);
    if (node && compareTable.check(node, c, { root }).ok) compareReady.add(c.node);
  }
  const approved = new Map();
  for (const c of (detections?.components ?? []).filter((c) => c.status === 'approved' && !isSignal(c.component) && !isPaginationHint(c))) {
    if (isKind(c, PartKind.PRICE_TABLE) && !priceReady.has(c.node)) { priceSkipped.push(c); continue; }
    if (isKind(c, PartKind.COMPARE_TABLE) && !compareReady.has(c.node)) { compareSkipped.push(c); continue; }
    if ((isKind(c, PartKind.TAB_SWITCH) || isKind(c, PartKind.TABS)) && priceReady.has(c.node)) continue;
    const prev = approved.get(c.node);
    if (prev && isKind(c, PartKind.SEMANTIC)) continue;
    approved.set(c.node, c);
  }
  for (const found of detectActionForms(root)) {
    if ([...approved.values()].some((d) => isKind(d, PartKind.FORM) && d.node === found.node)) continue;
    approved.set(found.node, { id: `action-${found.node}`, status: 'approved', source: 'rule', ...found });
  }
  const held = new Set();
  for (const c of detections?.components ?? []) {
    if (isSignal(c.component) || isPaginationHint(c) || c.params?.hold) held.add(c.node);
    if (c.status === 'approved') continue;
    if (isKind(c, PartKind.CAROUSEL) && c.params?.pagination) held.add(c.params.pagination);
  }
  return { approved, held, priceSkipped, compareSkipped };
}

function nextBrickId(salt, usedIds, figmaId) {
  for (let i = 0; ; i++) {
    const h = createHash('sha1').update(`${salt}|${figmaId}|${i}`).digest();
    let n = h.readUIntBE(0, 6);
    let s = '';
    for (let k = 0; k < 6; k++) { s += (n % 36).toString(36); n = Math.floor(n / 36); }
    s = 'abcdefghijklmnopqrstuvwxyz'[parseInt(s[0], 36) % 26] + s.slice(1);
    if (!usedIds.has(s)) { usedIds.add(s); return s; }
  }
}

function paintAltHints(node, inherited = null) {
  const own = node.type === 'INSTANCE' && /^brand-logo$/i.test(node.name) && typeof node.props?.['Property 1'] === 'string' ? node.props['Property 1'] : inherited;
  if (own) node.__altHint = own;
  for (const child of node.children ?? []) paintAltHints(child, own);
}

function altTextFor(node, ov, patch, warn) {
  const alt = ov.alt ?? patch?.settings?.altText ?? node.__altHint ?? '';
  if (!alt && ov.alt !== '') warn(node, 'image has no alt text in Figma: alt is empty (designer list)');
  return alt;
}

function headingLevel(node) {
  const match = node.styleRefs?.text?.match(/^H([1-6])(?:\b|\/)/);
  return match ? `h${match[1]}` : null;
}

function imageTransformMoved(transform) {
  return !!transform && (Math.abs(transform[0][0] - 1) > 1e-4 || Math.abs(transform[1][1] - 1) > 1e-4 || Math.abs(transform[0][2]) > 1e-4 || Math.abs(transform[1][2]) > 1e-4);
}

function cropFill(fill) {
  return fill?.scaleMode === 'CROP' || (fill?.scaleMode === 'STRETCH' && imageTransformMoved(fill.imageTransform));
}

function imageLeaf(node) {
  return !(node.children?.length) && node.fills?.some((fill) => fill.type === 'IMAGE') && node.type !== 'TEXT';
}

function closesPopup(root, approved) {
  return [...approved.values()].some((det) => {
    if (!isKind(det, PartKind.BUTTON) || det.params?.popupId) return false;
    const node = findNode(root, det.node);
    const text = (node?.children ?? []).find((child) => child && child.visible !== false && child.type === 'TEXT' && !child.svg);
    return resolvedRole(text?.text?.characters, det.params?.role) === 'action';
  });
}

function writeSliderLayout(node, settings) {
  if (node.sizing.v !== 'FIXED') settings.autoHeight = true; // Bricks default is 50vh; a hugging Figma height is the content
  if (!node.layout) return;
  const pad = node.layout.padding;
  if (pad.top || pad.right || pad.bottom || pad.left) settings._padding = { top: px(pad.top), right: px(pad.right), bottom: px(pad.bottom), left: px(pad.left) };
  // Splide translates `.splide__list`. justify-content on that node shifts the flex line by half the
  // overflow, so a loop reposition misses the clone and the drag jumps. Cross-axis align stays here:
  // slider-nested has no list align control. Slide content align is written on the slide itself.
  if (node.layout.mode === 'GRID') return;
  const align = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' }[node.layout.counterAlign] ?? 'flex-start';
  addCustomCss(settings, `align-items: ${align};`, ' .splide__list');
}

function elementKind({ node, ov, patch, comp, det, leaf, crop, hTag, isRoot }) {
  return ov.element
    ?? patch?.kind
    ?? comp?.kind?.(node, det)
    ?? (node.svg ? 'svg' : node.type === 'TEXT' ? (hTag ? 'heading' : 'text-basic') : leaf && !crop ? 'image' : isRoot ? 'section' : 'block');
}

function writeSlideAlign(settings) {
  // The theme centers the slide. It does not set flex-direction. A row repeated here with no
  // @media beats `_direction:tablet_portrait`, so the column key never starts. Column stays in
  // this rule: a vertical card is a column at every width. A row is the desktop key only.
  const direction = settings._direction || 'row';
  const bits = ['display: flex', `justify-content: ${settings._justifyContent || 'flex-start'}`, `align-items: ${settings._alignItems || 'flex-start'}`];
  if (direction !== 'row') bits.splice(1, 0, `flex-direction: ${direction}`);
  if (settings._columnGap) bits.push(`column-gap: ${settings._columnGap}`);
  if (settings._rowGap) bits.push(`row-gap: ${settings._rowGap}`);
  addCustomCss(settings, `${bits.join('; ')};`);
}

function keepLayerOrder(node, parent, settings) {
  // CSS paints a positioned sibling above every in-flow element. Relative puts the flow child back in layer order.
  if (node.place === 'FLOW' && !settings._position && parent?.children?.some((child) => child.visible !== false && child.place === 'ABSOLUTE')) settings._position = 'relative';
}

function paintImageLeaf({ node, parent, settings, warn, alt, crop }) {
  const fill = [...node.fills].reverse().find((item) => item.type === 'IMAGE');
  if (node.fills.length > 1) warn(node, 'image fill combined with other fills: only the image is built');
  const image = { $asset: fill.asset.file, size: 'full' };
  if (crop) {
    const transform = fill.imageTransform;
    if (!transform || transform[0][1] || transform[1][0]) warn(node, 'CROP with rotation/skew is not supported');
    const [[sx, , tx], [, sy, ty]] = transform ?? [[1, 0, 0], [0, 1, 0]];
    Object.assign(settings, { _position: settings._position ?? 'relative', _overflow: 'hidden' });
    // The image is 100% of the crop frame, so the file's pixel size never becomes the layout size.
    const frame = {
      _position: 'absolute', _width: pct(100 / sx), _height: pct(100 / sy), _left: pct((-tx / sx) * 100), _top: pct((-ty / sy) * 100), _widthMax: 'none',
    };
    const picture = {
      image, altText: alt, loading: 'eager',
      _position: 'absolute', _top: '0px', _left: '0px', _width: '100%', _height: '100%', _widthMax: 'none', _objectFit: 'fill',
    };
    return {
      name: 'div',
      after: (id, emitRaw) => {
        const frameId = emitRaw(`${node.id}#crop`, 'div', frame, id, node.name + ' (crop)');
        emitRaw(`${node.id}#image`, 'image', picture, frameId, node.name);
      },
    };
  }
  // An img that fills a hugging row would stretch that row to the file's aspect ratio. The wrapper keeps the Figma height and the picture covers it.
  if (fill.scaleMode === 'FILL' && node.sizing.v === 'FILL' && parent?.layout?.mode === 'HORIZONTAL' && parent.sizing?.v === 'HUG') {
    Object.assign(settings, { _position: settings._position ?? 'relative', _overflow: 'hidden' });
    const inner = { image, altText: alt, loading: 'lazy', _position: 'absolute', _top: '0px', _left: '0px', _width: '100%', _height: '100%', _widthMax: 'none', _objectFit: 'cover' };
    return { name: 'div', after: (id, emitRaw) => emitRaw(`${node.id}#fill`, 'image', inner, id, node.name + ' (fill)') };
  }
  settings.image = image;
  settings.altText = alt;
  settings._objectFit = { FILL: 'cover', FIT: 'contain', STRETCH: 'fill' }[fill.scaleMode] ?? 'cover';
  if (!['FILL', 'FIT', 'STRETCH'].includes(fill.scaleMode)) warn(node, `image scaleMode ${fill.scaleMode} approximated as cover`);
  return null;
}

const IMAGE_CHILD_KEYS = ['image', 'altText', 'loading', '_objectFit', '_objectPosition', 'link', 'url', 'newTab', 'caption', 'captionCustom', 'showTitle'];

function scrollControl(name) {
  return name === 'data-f2b-scroll' || name === 'data-f2b-scroll-track' || name === 'data-f2b-scroll-thumb' || name === 'onscroll' || name === 'onwheel' || String(name).startsWith('onpointer');
}

function mergeOverride(settings, ov) {
  const scrollAttrs = (settings._attributes ?? []).filter((attr) => scrollControl(attr.name));
  for (const key of ov.dropSettings ?? []) delete settings[key];
  let next = settings;
  if (ov.settings) next = deepMerge(settings, ov.settings);
  // A decorative-icon override replaces the attribute list. The scroll thumb is a control, so its handlers stay.
  if (scrollAttrs.length) {
    const names = new Set(scrollAttrs.map((attr) => attr.name));
    next._attributes = [...(next._attributes ?? []).filter((attr) => !names.has(attr.name)), ...scrollAttrs];
  }
  if (ov.cssClasses) next._cssClasses = ov.cssClasses;
  return next;
}

function keepClose(settings, isClose) {
  if (!isClose) return;
  settings._attributes = [...(settings._attributes ?? []).filter((attr) => attr.name !== 'aria-hidden' && attr.name !== 'data-f2b-close'), { name: 'data-f2b-close', value: '1' }];
  addCustomCss(settings, 'cursor: pointer;');
}

function keepDismiss(settings, isDismiss) {
  if (!isDismiss) return;
  settings._attributes = [...(settings._attributes ?? []).filter((attr) => attr.name !== 'data-f2b-dismiss'), { name: 'data-f2b-dismiss', value: '1' }];
}

function liftImage(node, kind, settings, after, emitRaw) {
  if (kind !== 'image') return { kind, settings, after };
  // The div sets the width and height. The image is always 100% × 100% of that div.
  const child = { _position: 'absolute', _top: '0px', _left: '0px', _width: '100%', _height: '100%', _widthMax: 'none' };
  for (const key of IMAGE_CHILD_KEYS) if (settings[key] !== undefined) { child[key] = settings[key]; delete settings[key]; }
  if (!settings._position) settings._position = 'relative';
  if (!settings._overflow) settings._overflow = 'hidden';
  return {
    kind: 'div',
    settings,
    after: (id) => { emitRaw(`${node.id}#image`, 'image', child, id, node.name); after?.(id); },
  };
}

function collectPlan(root, approved, flats, warn) {
  const plan = new Map();
  const mergedInto = new Map();
  const patches = new Map();
  const late = (name) => name === 'price-table' || name === 'compare-table';
  const ordered = [...approved.values()].sort((a, b) => Number(late(a.component)) - Number(late(b.component)));
  for (const det of ordered) {
    const node = findNode(root, det.node);
    if (!node) continue;
    const comp = COMPONENTS[det.component];
    const isCrop = imageLeaf(node) && node.fills.find((fill) => fill.type === 'IMAGE')?.scaleMode === 'CROP';
    const actionHosts = [...approved.values()].filter((item) => isKind(item, PartKind.FORM) && item.params?.kind === 'action');
    const insideAction = (id) => actionHosts.some((item) => {
      const host = findNode(root, item.node);
      return host && host.id !== id && containsNode(host, id);
    });
    if ((isKind(det, PartKind.SWITCH) || isKind(det, PartKind.CHECKBOX)) && insideAction(det.node)) continue;
    if (isKind(det, PartKind.BUTTON) && actionHosts.some((item) => item.params?.submit === det.node)) continue;
    if (isKind(det, PartKind.SEARCH) && isDomainLookup(node)) {
      warn(node, 'domain lookup stays layout; the action is outside this project');
      continue;
    }
    if (isKind(det, PartKind.SEMANTIC) && det.params?.itemTag === 'li') {
      const kids = (node.children ?? []).filter((child) => child && child.visible !== false);
      const control = (id) => ['button', 'form', 'search', 'switch'].includes(approved.get(id)?.component);
      if (kids.length > 0 && kids.every((child) => control(child.id))) {
        warn(node, 'semantic ul > li skipped: these children are controls');
        continue;
      }
    }
    const chk = !comp ? { ok: false, reason: 'unknown component' } : comp.status !== 'implemented' ? { ok: false, reason: `component "${det.component}" is ${comp.status}` } : isCrop ? { ok: false, reason: 'image crop nodes are not supported' } : comp.check(node, det, { root, flats });
    if (!chk.ok) { warn(node, `detection ${det.id} (${det.component}) approved but not applied, kept as block: ${chk.reason}`); continue; }
    plan.set(node.id, { det, comp });
    for (const message of chk.warnings ?? []) warn(node, `${det.component} ${det.id}: ${message}`);
    for (const [id, patch] of Object.entries(comp.descendants?.(node, det, { root }) ?? {})) patches.set(id, patch);
    for (const id of comp.mergedNodes?.(det, node) ?? []) mergedInto.set(id, det);
  }
  return { plan, mergedInto, patches };
}

function componentScripts(plan) {
  const scripts = [];
  const seen = new Set();
  for (const { comp } of plan.values()) {
    if (typeof comp.pageScript !== 'function' || seen.has(comp.id)) continue;
    seen.add(comp.id);
    const src = comp.pageScript();
    if (src) scripts.push(src);
  }
  return scripts;
}

function paintSiblingStates(root, plan, patches) {
  const owners = [...plan.entries()].filter(([, { det }]) => isAnyKind(det, StateKind)).map(([id]) => id);
  for (const [id, extra] of Object.entries(siblingStatePatches(root, owners))) {
    const prev = patches.get(id) ?? {};
    patches.set(id, {
      ...prev,
      css: [...(prev.css ?? []), ...(extra.css ?? [])],
      dropSettings: [...(prev.dropSettings ?? []), ...(extra.dropSettings ?? [])],
      expectCss: { ...(prev.expectCss ?? {}), ...(extra.expectCss ?? {}) },
    });
  }
}

function markHug(node, inHug) {
  node.__inHug = inHug;
  const hug = inHug || node.sizing?.h === 'HUG';
  for (const child of node.children ?? []) markHug(child, hug);
}

function pinEmptyBlocks(elements) {
  // The builder gives an empty element min 90px. An explicit 0 keeps a 12px shape at the Figma size on the canvas.
  const hasChild = new Set(elements.map((element) => element.parent));
  for (const element of elements) {
    if (element.name === 'block' && !hasChild.has(element.id)) {
      element.settings._widthMin ??= '0px';
      element.settings._heightMin ??= '0px';
    }
  }
}

const COPIED_HEIGHT = ['_height', '_heightMin', '_heightMax'];

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([^\s])\r?\n/g, '$1 <br>').replace(/\r?\n/g, '<br>');
}

function copyDrawnSettings(pending, elements, mapping, warn) {
  for (const { id, like, text, drop } of pending) {
    const element = elements.find((item) => item.id === id);
    const source = like && elements.find((item) => item.id === mapping[like]?.bricksId);
    if (!like) { if (element && text !== undefined) element.settings.text = escapeText(text); continue; }
    if (!element || !source) { if (element) warn({ id: like, name: '?' }, `copy of node ${like} not possible: it is not built, ${element.label} keeps Bricks defaults`); continue; }
    const copy = structuredClone(source.settings);
    for (const key of [...COPIED_HEIGHT, ...(drop ?? [])]) delete copy[key]; // the new text is a different length, so its height follows the text
    if (copy._typography?.['white-space']) copy._typography = Object.fromEntries(Object.entries(copy._typography).filter(([key]) => key !== 'white-space')); // one drawn line must not clip a longer answer
    if (typeof copy._cssCustom === 'string') copy._cssCustom = copy._cssCustom.replaceAll(`#brxe-${source.id}`, `#brxe-${element.id}`).replaceAll(`.brxe-${source.id}`, `.brxe-${element.id}`);
    element.settings = { ...copy, ...element.settings };
    if (text !== undefined) element.settings.text = escapeText(text);
  }
}

function walkChildren(node, { id, kind, onePage, component, keep, extra, wrapChildren, mapping, emitRaw, emitWrap, emitExtra, mapNode }) {
  const extras = extra ?? [];
  const lead = extras.filter((item) => item.place === 'before');
  const tail = extras.filter((item) => item.place !== 'before');
  // Bricks pairs tab panes by DOM order. A pane for an earlier title has to exist before the drawn pane.
  lead.forEach((item, index) => emitExtra(`${node.id}#lead${index}`, item, id));
  if (node.__skipChildren) {
    for (const child of node.children ?? []) if (child) mapping[child.id] = { skipped: 'switch value is the form field' };
  } else if (node.children || wrapChildren) {
    const pageHost = onePage && node.children
      ? emitRaw(`${node.id}#page`, 'block', {
        _display: 'flex',
        _direction: 'column',
        _width: '100%',
        _alignItems: 'flex-start',
        ...(typeof node.layout?.gap === 'number' ? { _rowGap: px(node.layout.gap) } : {}),
      }, id, 'page')
      : id;
    // The drawn children are one pane. Empty panes stay siblings of that pane, inside the pane block.
    const childHost = wrapChildren ? emitWrap(node, pageHost, wrapChildren) : pageHost;
    for (const child of node.children ?? []) {
      if (component?.merges && child.visible !== false && !keep.has(child.id)) mapping[child.id] = { skipped: `merged into ${component.id} ${component.detection}` };
      else mapNode(child, node, childHost, { isSlide: kind === 'slider-nested' && !onePage });
    }
  }
  // An empty pane is an element Bricks needs. It stays empty. The content is not invented.
  tail.forEach((item, index) => emitExtra(`${node.id}#extra${index}`, item, id));
}

function applyNodePatch(settings, css, { node, patch, comp, ctx, det }) {
  if (patch?.skipChildren) node.__skipChildren = true;
  const applied = comp?.apply?.(ctx, det) ?? null;
  if (patch?.settings) Object.assign(settings, deepMerge(settings, patch.settings));
  if (node.__peekScroll) {
    settings._overflow = 'auto';
    settings._flexWrap = 'nowrap';
  }
  if (node.__lockWidth != null) {
    settings._width = px(node.__lockWidth);
    settings._flexShrink = 0;
    settings._widthMax = 'none';
  }
  if (patch?.expectCss) Object.assign(css, patch.expectCss); // the browser value, when a component replaces a gap Figma never drew between two children
  for (const key of patch?.dropSettings ?? []) delete settings[key]; // an accordion pane must not keep _display: the theme open rule decides it
  for (const [key, value] of Object.entries(patch?.defaults ?? {})) settings[key] ??= value; // a component default never replaces a value this node already wrote
  for (const rule of patch?.css ?? []) addCustomCss(settings, rule.decl, rule.suffix ?? '');
  if (patch?.rawCss) settings._cssCustom = [settings._cssCustom, patch.rawCss].filter(Boolean).join('\n');
  if (node.openRoot) {
    settings._cssClasses = [settings._cssClasses, 'read-more-full'].filter(Boolean).join(' ');
    settings._display = 'none'; // the builder applies this control; custom CSS alone stays visible on the canvas
    addCustomCss(settings, 'display: none !important;'); // the open rule is more specific and wins on the site
  }
  return applied;
}

function encloseHost(node, patch, parentBricksId, emitRaw) {
  if (!patch?.enclose) return { hostId: parentBricksId, encloseId: null };
  const box = { ...(patch.enclose.settings ?? {}) };
  for (const rule of patch.enclose.css ?? []) addCustomCss(box, rule.decl, rule.suffix ?? '');
  const encloseId = emitRaw(`${node.id}#values`, patch.enclose.name ?? 'block', box, parentBricksId, patch.enclose.label ?? 'Values');
  return { hostId: encloseId, encloseId };
}

function warnSkippedTables(root, warn, priceSkipped, compareSkipped) {
  for (const item of priceSkipped) {
    const node = findNode(root, item.node);
    if (node) warn(node, `detection ${item.id} (price-table) approved but not applied, kept as block: ${priceTable.check(node, item, { root }).reason}`);
  }
  for (const item of compareSkipped) {
    const node = findNode(root, item.node);
    if (node) warn(node, `detection ${item.id} (compare-table) approved but not applied, kept as block: ${compareTable.check(node, item, { root }).reason}`);
  }
}

export function buildTemplate(root, { overrides = {}, detections = null, flats = {}, readAsset, salt = '', fileKey = '' } = {}) {
  markPeekScroll(root, detections);
  const nodeOv = overrides.nodes ?? {};
  // A proposed detection stays a block. A semantic tag does not replace a widget already on that node.
  const { approved, held, priceSkipped, compareSkipped } = acceptedDetections(root, detections);
  const elements = [];
  const mapping = {};
  const warnings = [];
  const usedIds = new Set();
  const rootAbs = { x: root.box.absX, y: root.box.absY };

  const warn = (node, msg) => warnings.push({ node: node.id, name: node.name, msg });
  warnSkippedTables(root, warn, priceSkipped, compareSkipped);
  const brickId = (figmaId) => nextBrickId(salt, usedIds, figmaId);
  // Alt is never the layer name. Order: override, a caption the owner tied to the image, then a brand-logo variant name.
  paintAltHints(root);
  const altFor = (node, ov, patch) => altTextFor(node, ov, patch, warn);

  const popup = overrides.template?.type === 'popup';
  const stage = popup ? popupCard(root) : null;
  const contentRoot = stage?.card ?? root;
  const closing = new Set(popup ? closeMarkIds(contentRoot) : []);
  const dismiss = !popup && closesPopup(root, approved);

  // ---------- recursion ----------
  function mapNode(node, parent, parentBricksId, { isRoot = false, isSlide = false } = {}) {
    let ov = nodeOv[node.id] ?? {};
    if (node.openOnly) ov = { ...ov, verify: false }; // the pasted full frame is hidden while closed, so the collapsed Figma shot must not be scored against it
    if (node.visible === false) { mapping[node.id] = { skipped: 'hidden in Figma' }; return; }
    if (ov.skip) { mapping[node.id] = { skipped: `override: ${ov.reason ?? 'skip'}` }; return; }
    if (mergedInto.has(node.id)) { const d = mergedInto.get(node.id); mapping[node.id] = { skipped: `merged into ${d.component} ${d.id}` }; return; }
    if (held.has(node.id)) { mapping[node.id] = { skipped: 'waiting for the plan' }; return; }

    const leaf = imageLeaf(node);
    node.__intrinsic = leaf || !!node.svg || !!plan.get(node.id)?.comp.intrinsic; // no fit-to-content in CSS: keep the Figma box
    const crop = leaf && cropFill([...(node.fills ?? [])].reverse().find((fill) => fill.type === 'IMAGE'));
    const hTag = node.type === 'TEXT' ? headingLevel(node) : null;

    const { det, comp } = plan.get(node.id) ?? {};

    const patch = patches.get(node.id);
    const kind = elementKind({ node, ov, patch, comp, det, leaf, crop, hTag, isRoot });

    const s = {}; // Bricks settings
    const css = {}; // css the verify step expects to measure in the browser
    const ctx = { node, parent, s, css, warn, kind, root, flats, readAsset, popup, fileKey, designTitle: overrides.template?.title, inner: comp?.wrap ? {} : undefined, skipStroke: patch?.skipStroke }; // inner: settings of the element a wrapping component puts inside the block. skipStroke: the active menu item's line is the class, not this element's own stroke. designTitle is "<Figma file> - <section>" when the template run wrote it. readAsset lets a component read the svg it was exported as.
    applySize(ctx, { isRoot, isSlide });
    // a page frame that does not clip, with a layer sticking out of its left / right edge: Figma's picture stops at the frame edge, a page would scroll sideways
    if (isRoot && !node.clip && overflowsSideways(node)) s._overflow = 'hidden'; // the Bricks attribute (Style > Layout > Overflow)
    const isSlider = kind === 'slider-nested';
    const ownLayout = node.type !== 'TEXT' && !leaf && kind !== 'svg' && !comp?.skipsStyle;
    if (ownLayout) {
      if (isSlider) writeSliderLayout(node, s);
      else applyLayout(ctx, kind);
    }
    // The theme centers every slide. The id selector writes the Figma alignment again at the same specificity.
    if (isSlide && s._display === 'flex') writeSlideAlign(s);
    keepLayerOrder(node, parent, s);

    if (kind === 'section') s.tag = 'section';
    if (node.type === 'TEXT' && !node.svg) applyText(ctx);
    if (kind === 'heading') s.tag = ov.tag ?? hTag ?? 'h2';
    if (ov.tag && kind !== 'heading') s.tag = ov.tag;

    // svg as an uploaded file: Bricks "code" SVGs need a signature and render a placeholder without it
    if (kind === 'svg' && node.svg) s.file = { $asset: node.svg.file, size: 'full' };
    if (closing.has(node.id)) s._attributes = [...(s._attributes ?? []), { name: 'data-f2b-close', value: '1' }];

    if (leaf) {
      applyStyle(ctx, { skipFill: true });
      const painted = paintImageLeaf({ node, parent, settings: s, warn, alt: altFor(node, ov, patch), crop });
      if (painted) {
        return emit(node, painted.name, s, css, parentBricksId, ov, { isSlide, after: (id) => painted.after(id, emitRaw) });
      }
    } else if (!comp?.skipsStyle) {
      applyStyle(ctx, { skipFill: node.type === 'TEXT' }); // a TEXT fill is the text color, not a background
    }

    const applied = applyNodePatch(s, css, { node, patch, comp, ctx, det });
    const { hostId, encloseId } = encloseHost(node, patch, parentBricksId, emitRaw);
    emit(node, kind, s, css, hostId, ov, { isSlide, parent, isSlider, onePage: kind === 'slider-nested' && !!det?.params?.page, extra: patch?.extraChildren, wrapChildren: patch?.wrapChildren, component: comp && { id: det.component, detection: det.id, merges: !!comp.mergesChildren && !patch?.unmerge, attrs: applied?.attrs }, inner: comp?.wrap ? { name: comp.innerKind, settings: ctx.inner, label: comp.innerLabel } : undefined, keep: new Set(comp?.keepNodes?.(node, det) ?? []) });
    // A bubble sits beside the enclosed node. The svg element does not render children, so the text cannot live inside the icon.
    (patch?.enclose?.tail ?? []).forEach((item, index) => emitExtra(`${node.id}#enclose${index}`, item, encloseId));
  }

  function bindSelectors(settings, id, name) {
    if (typeof settings._cssCustom !== 'string') return;
    settings._cssCustom = settings._cssCustom.replaceAll('%root%', `#brxe-${id}`).replaceAll('%class%', `.brxe-${id}.brxe-${name}`);
  }

  function emitWrap(node, parentId, wrap) {
    const settings = { ...(wrap.settings ?? {}), _width: '100%' };
    for (const rule of wrap.css ?? []) addCustomCss(settings, rule.decl, rule.suffix ?? '');
    return emitRaw(`${node.id}#open`, wrap.name ?? 'block', settings, parentId, wrap.label ?? 'Pane');
  }

  function emitRaw(key, name, settings, parent, label) {
    const id = brickId(key);
    bindSelectors(settings, id, name);
    elements.push({ id, name, parent, label, settings });
    mapping[key] = { bricksId: id, element: name, verify: false };
    return id;
  }

  function emit(node, kind, s, css, parentBricksId, ov, { isSlide, isSlider, onePage = false, after, component, extra, wrapChildren, inner, keep = new Set() } = {}) {
    let settings = mergeOverride(s, ov);
    keepClose(settings, closing.has(node.id));
    keepDismiss(settings, dismiss && node.id === root.id);
    ({ kind, settings, after } = liftImage(node, kind, settings, after, emitRaw));

    const id = brickId(node.id);
    // %root% is only resolved inside the builder; the frontend needs the real selector
    bindSelectors(settings, id, kind);
    elements.push({ id, name: kind, parent: parentBricksId, label: ov.label ?? node.name, settings });
    mapping[node.id] = {
      bricksId: id, element: kind, verify: ov.verify !== false,
      ...(component && { component: component.id, detection: component.detection }),
      expect: node.__svgBleed
        ? { x: r4(node.box.absX - node.__svgBleed.left - rootAbs.x), y: r4(node.box.absY - node.__svgBleed.top - rootAbs.y), w: node.__svgBleed.w, h: node.__svgBleed.h, css, ...(component?.attrs && { attrs: component.attrs }) }
        : { x: r4(node.box.absX - rootAbs.x), y: r4(node.box.absY - rootAbs.y), w: node.box.w, h: node.box.h, css, ...(component?.attrs && { attrs: component.attrs }) },
    };
    after?.(id);
    if (inner) emitRaw(`${node.id}#inner`, inner.name, inner.settings, id, inner.label || inner.name); // wrapping component: the block keeps the Figma frame, the real element sits inside
    walkChildren(node, { id, kind, onePage, component, keep, extra, wrapChildren, mapping, emitRaw, emitWrap, emitExtra, mapNode });
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
  const { plan, mergedInto, patches } = collectPlan(root, approved, flats, warn);
  const scripts = componentScripts(plan);
  paintSiblingStates(root, plan, patches);
  // A hugging parent is sized from its other children. CSS would size it from one line of a FILL text. size.mjs caps that text.
  markHug(root, false);

  if (stage) mapping[root.id] = { skipped: 'popup backdrop' };
  mapNode(contentRoot, null, 0, { isRoot: true });
  copyDrawnSettings(pendingLike, elements, mapping, warn);
  pinEmptyBlocks(elements);

  for (const id of Object.keys(nodeOv)) if (!(id in mapping) && !findNode(root, id)) warnings.push({ node: id, name: '?', msg: 'override refers to a node that is not in the tree' });
  sealThemeDefaults(elements);
  for (const hit of schemaTraps(elements)) warnings.push({ node: hit.id, name: hit.key, msg: hit.msg });

  return {
    template: {
      title: overrides.template?.title ?? `${root.name} (figma ${root.id})`,
      type: overrides.template?.type ?? 'section',
      content: elements,
      ...(stage ? { popup: { width: stage.width, backdrop: stage.backdrop } } : {}),
      ...(scripts.length ? { scripts } : {}),
    },
    mapping,
    warnings,
  };
}

function containsNode(n, id) {
  return n?.id === id || (n?.children ?? []).some((c) => containsNode(c, id));
}

function findNode(n, id) {
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const f = findNode(c, id); if (f) return f; }
  return null;
}
