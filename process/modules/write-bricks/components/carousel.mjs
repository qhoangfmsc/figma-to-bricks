// COMPONENT carousel: a row of slides, the arrow buttons drawn on it, and a pagination row.
// Bricks 1.9.8: `slider-nested` (Splide). Every child of the row becomes a slide (slide widths belong to the slider: perPage + gap).
//   source: includes/elements/slider-nested.php (type, perPage, gap, focus, start, pagination, arrows, prevArrow / nextArrow and their position)
// Two or more drawn slides build type `loop`. One drawn slide builds type `slide`: Splide's loop clones that single card and parks it outside the track, so the builder shows the dot and a blank. Autoplay uses Bricks' 3000ms placeholder. A stopped autoplay is turned off in the Plan.
// perPage and gap come from Figma (how many slides fit in the row, the auto layout gap). Arrow size, border, icon, gradient and place come from the
// drawn buttons. The dash count is the number of items in the slider, not the number of dashes drawn in Figma. Splide only emits one dot per slide
// when `focus` is set (otherwise the count is ceil(slides / perPage)); focus 0 keeps the leftmost slide as the current index, so the active dash
// follows whichever item is in front as the loop moves. The slider always starts at the first item. Dash size and color still come from the drawn dashes.
// params: perPage · pagination (node id) · controls (node ids merged, not slides) · allowSingle (one drawn slide + arrows)
//         prev / next (arrow buttons) · itemCount · items · autoplay (false turns it off) · settings (raw Bricks settings, deep-merged; type stays loop when two or more slides are drawn)
import { PartKind } from '../../recognize-parts/kinds.mjs';
import { deepMerge } from '../../write-bricks/render/utils/merge.mjs';
import { boxLook, findNode, jsonParam, svgIcon, svgNode, visibleKids } from '../../write-bricks/components/helpers.mjs';
import { addCustomCss, addRawCss, colorObj, cssColor, px } from '../../write-bricks/render/utils/css.mjs';
import { linearGradientCss } from '../../write-bricks/render/utils/gradient.mjs';

const controlIds = (det) => [det.params?.pagination, det.params?.prev, det.params?.next, ...(det.params?.controls ?? [])].filter(Boolean);
const slidesOf = (node, det) => {
  const kids = visibleKids(node).filter((c) => !controlIds(det).includes(c.id));
  // The rows are the layout of one drawn page. Splide must see one slide, or it moves a row at a time.
  return det.params?.page ? kids.slice(0, 1) : kids;
};
const perPageOf = (node, slides, det) => {
  if (det.params?.perPage) return Math.max(1, Number(det.params.perPage));
  if (det.params?.allowSingle) return 1;
  const room = node.box.w - (node.layout?.padding?.right ?? 0);
  return Math.max(1, slides.filter((c) => c.box.x + c.box.w <= room + 1).length); // slides entirely visible in the Figma frame
};
const attr = (raw, name) => raw.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1];
const num = (v) => (v == null ? null : Number(v));

// Loop never disables one side, so a faded arrow (the disabled-at-start state) does not win: both sides take the brighter button.
// Each side keeps its own icon and position. `host` is the slider the arrows are placed against.
export function applySyncedArrows(s, host, pair, warn = () => {}) {
  const ready = pair.filter((p) => p.node?.box);
  if (!ready.length) return;
  const shown = (a) => (a.opacity == null ? 1 : a.opacity);
  const chrome = ready.reduce((a, b) => (shown(b.node) > shown(a.node) ? b : a)).node;
  s.arrows = true;
  s.arrowWidth = px(chrome.box.w);
  s.arrowHeight = px(chrome.box.h);
  const look = boxLook({ ...chrome, fills: (chrome.fills ?? []).filter((f) => f.type === 'SOLID') }, warn);
  if (look.background) s.arrowBackground = look.background;
  if (look.border) s.arrowBorder = look.border;
  const chromeIcon = svgNode(chrome);
  const paint = (chromeIcon?.fills ?? []).find((f) => f.type === 'SOLID');
  if (paint) s.arrowColor = colorObj(paint);
  for (const { key, label, node: a } of ready) {
    const ic = svgNode(a);
    if (ic) s[label] = svgIcon(ic);
    // box.x is relative to the arrow's parent (often the navigation row), not the slider
    const top = a.box.absY != null && host.box.absY != null ? a.box.absY - host.box.absY : a.box.y;
    const left = a.box.absX != null && host.box.absX != null ? a.box.absX - host.box.absX : a.box.x;
    s[`${label}Top`] = px(top);
    s[`${label}Left`] = px(left);
    const side = key === 'prev' ? 'prev' : 'next';
    const decls = ['padding: 0;', 'box-sizing: border-box;', 'right: auto;', 'bottom: auto;', 'transform: none;'];
    const grad = (chrome.fills ?? []).find((f) => f.type === 'GRADIENT_LINEAR' && f.handles?.length >= 2);
    if (grad) decls.push(`background-image: ${linearGradientCss(grad, chrome.box.w, chrome.box.h)};`);
    const shadows = (chrome.effects ?? []).filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW');
    if (shadows.length) decls.push(`box-shadow: ${shadows.map((e) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(e.x)} ${px(e.y)} ${px(e.blur)} ${px(e.spread ?? 0)} ${cssColor(e)}`).join(', ')};`);
    if (shown(chrome) < 1) decls.push(`opacity: ${shown(chrome)} !important;`);
    addCustomCss(s, decls.join(' '), ` .splide__arrow--${side}`);
    if (ic?.box) addCustomCss(s, `width: ${px(ic.box.w)}; height: ${px(ic.box.h)};`, ` .splide__arrow--${side} svg`);
  }
  // Splide fades the prev arrow when it considers it disabled. Loop never is, so that fade must not win.
  s.arrowDisabledOpacity = 1;
}

// An arrow drawn outside the slide box is in the section margin. Once the window is narrower than that margin, pin it to the inner edge so it stays on screen.
function pinOutsideArrows(s, host, pair) {
  if (!host?.box?.w || !pair?.length) return;
  let overhang = 0;
  for (const { node: a } of pair) {
    if (!a?.box || host.box.absX == null || a.box.absX == null) continue;
    const left = a.box.absX - host.box.absX;
    if (left < 0) overhang = Math.max(overhang, -left);
    const past = left + a.box.w - host.box.w;
    if (past > 0) overhang = Math.max(overhang, past);
  }
  if (overhang <= 1) return;
  const max = Math.ceil(host.box.w + overhang * 2);
  addRawCss(s, `@media (max-width: ${px(max)}) { %root% .splide__arrow--prev { left: 16px !important; } %root% .splide__arrow--next { left: auto !important; right: 16px !important; } }`);
}

// Dashes of a pagination exported as one svg: filled rectangles, or round strokes. Returns null when the file is not that drawing.
export function paginationMarks(svg) {
  const clips = {};
  for (const m of svg.matchAll(/<clipPath\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/clipPath>/g)) {
    const rect = m[2].match(/<rect\b([^>]*)\/?>/);
    if (rect) clips[m[1]] = num(attr(rect[1], 'rx')) ?? 0;
  }
  const items = [];
  const opacity = [1];
  const radius = [null];
  let defs = 0;
  for (const m of svg.matchAll(/<defs\b[^>]*>|<\/defs>|<g\b([^>]*)>|<\/g>|<path\b([^>]*)\/?>/g)) {
    if (m[0].startsWith('<defs')) { defs++; continue; }
    if (m[0].startsWith('</defs')) { defs--; continue; }
    if (defs) continue;
    if (m[0].startsWith('</g')) { opacity.pop(); radius.pop(); continue; }
    if (m[0].startsWith('<g')) {
      const own = num(attr(m[1], 'opacity'));
      opacity.push((opacity.at(-1) ?? 1) * (own ?? 1));
      const clip = attr(m[1], 'clip-path')?.match(/url\(#([^)]+)\)/)?.[1];
      radius.push(clip && clips[clip] != null ? clips[clip] : radius.at(-1));
      continue;
    }
    const raw = m[2];
    const d = attr(raw, 'd');
    if (!d) continue;
    const box = rectOf(d);
    if (!box) continue;
    const op = (opacity.at(-1) ?? 1) * (num(attr(raw, 'opacity')) ?? 1);
    const stroke = attr(raw, 'stroke');
    const sw = num(attr(raw, 'stroke-width')) ?? 0;
    if (stroke && box.line) {
      const cap = /round/i.test(attr(raw, 'stroke-linecap') ?? '');
      const extra = cap ? sw / 2 : 0;
      items.push({ x: box.x - extra, w: box.w + extra * 2, h: sw, hex: stroke, alpha: op, rx: cap ? sw / 2 : 0 });
    } else if (attr(raw, 'fill') && attr(raw, 'fill') !== 'none') {
      items.push({ x: box.x, w: box.w, h: box.h, hex: attr(raw, 'fill'), alpha: op, rx: radius.at(-1) ?? 0 });
    }
  }
  if (items.length < 2) return null;
  items.sort((a, b) => a.x - b.x);
  const key = (m) => `${m.w}|${m.h}|${m.alpha}|${m.hex}`;
  const counts = {};
  for (const m of items) counts[key(m)] = (counts[key(m)] ?? 0) + 1;
  const idleKey = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const idle = items.find((m) => key(m) === idleKey);
  const active = items.find((m) => key(m) !== idleKey) ?? idle;
  const gap = items.length >= 2 ? items[1].x - (items[0].x + items[0].w) : 0;
  return { items, idle, active, gap };
}

function rectOf(d) {
  const m = d.match(/M\s*(-?[\d.]+)\s+(-?[\d.]+)\s*H\s*(-?[\d.]+)\s*V\s*(-?[\d.]+)\s*H\s*(-?[\d.]+)/i);
  if (m) {
    const xs = [+m[1], +m[3], +m[5]];
    const ys = [+m[2], +m[4]];
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  const line = d.match(/M\s*(-?[\d.]+)\s+(-?[\d.]+)\s*H\s*(-?[\d.]+)/i);
  if (line) return { x: Math.min(+line[1], +line[3]), y: +line[2], w: Math.abs(+line[3] - +line[1]), h: 0, line: true };
  return null;
}

// The mark that repeats is the resting one. Two marks that do not share a look: the longer one is the selected mark.
function dashPair(dots) {
  const fillOf = (d) => JSON.stringify((d.fills ?? []).filter((f) => f.type === 'SOLID').pop() ?? {});
  const idle = dots.find((d) => dots.filter((x) => fillOf(x) === fillOf(d)).length > 1);
  if (idle) return { idle, active: dots.find((d) => fillOf(d) !== fillOf(idle)) ?? idle };
  const longer = (d) => Math.max(d.box?.w ?? 0, d.box?.h ?? 0);
  const ranked = [...dots].sort((a, b) => longer(b) - longer(a));
  return { active: ranked[0], idle: ranked[1] ?? ranked[0] };
}

function cornerRadius(mark) {
  const radius = mark?.radius;
  const value = Array.isArray(radius) ? Number(radius[0]) : Number(radius);
  return Number.isFinite(value) ? value : 0;
}

// The stage is the widest and the tallest slide, including a child that sticks out of its frame, so neither slide scrolls.
function slideSpan(slide) {
  let minX = 0;
  let minY = 0;
  let maxX = slide.box?.w ?? 0;
  let maxY = slide.box?.h ?? 0;
  const walk = (node, ox, oy) => {
    for (const child of node.children ?? []) {
      if (!child || child.visible === false || !child.box) continue;
      const x = ox + child.box.x;
      const y = oy + child.box.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + child.box.w);
      maxY = Math.max(maxY, y + child.box.h);
      walk(child, x, y);
    }
  };
  walk(slide, 0, 0);
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

// A label drawn above the slide frame would be clipped. Shift that slide down so the tallest item still fits with no scrollbar.
function fitSlides(slides) {
  const spans = slides.map(slideSpan);
  slides.forEach((slide, index) => {
    const { minX, minY } = spans[index];
    const dx = Math.min(0, minX);
    const dy = Math.min(0, minY);
    if (!dx && !dy) return;
    for (const child of slide.children ?? []) {
      if (!child?.box) continue;
      child.box = { ...child.box, x: child.box.x - dx, y: child.box.y - dy };
    }
  });
  return {
    w: Math.max(0, ...spans.map((span) => span.w)),
    h: Math.max(0, ...spans.map((span) => span.h)),
  };
}

function contains(node, id) {
  return (node.children ?? []).some((c) => c.id === id || contains(c, id));
}

// The drawn pagination supplies the dash style. The count is the slides, so the drawing is always replaced.
function bricksPagination(node, det, { root, readAsset } = {}) {
  const pag = root && det.params?.pagination && findNode(root, det.params.pagination);
  if (!pag) return { use: false, pag: null };
  const shapes = visibleKids(pag).filter((d) => d.box && d.fills?.some((f) => f.type === 'SOLID'));
  if (shapes.length >= 2) return { use: true, pag, shapes };
  if (!pag.svg) return { use: true, pag };
  let text = null;
  try { text = readAsset?.(pag.svg.file) ?? null; } catch { text = null; }
  const marks = text && paginationMarks(text);
  if (!marks) return { use: true, pag, unparsed: true };
  return { use: true, pag, marks };
}

// Sit the dash row where Figma drew it. A sibling below the slides keeps its space as margin, because the dots are absolute.
function placePagination(s, node, pag) {
  if (pag.box?.absY == null || node.box?.absY == null) return;
  s.paginationTop = px(pag.box.absY - node.box.absY);
  const slideCenter = node.box.absX + node.box.w / 2;
  const pagCenter = pag.box.absX + pag.box.w / 2;
  if (Math.abs(slideCenter - pagCenter) > 2) s.paginationLeft = px(pag.box.absX - node.box.absX);
  const tail = (pag.box.absY + pag.box.h) - (node.box.absY + node.box.h);
  if (tail > 1 && !contains(node, pag.id)) s._margin = { top: '0px', right: '0px', bottom: px(tail), left: '0px' };
}

const radiusOf = (rx) => ({ top: px(rx), right: px(rx), bottom: px(rx), left: px(rx) });

function writeCarouselMotion(s, slides, det) {
  // After the Plan settings, so a saved "slide" type cannot turn the loop off when several cards are drawn.
  // One drawn slide cannot loop: Splide clones it and the builder track shows only the pagination dot.
  // PHP treats isset(autoplay) as on, including false, so off means the key is absent.
  const one = slides.length < 2;
  if (det.params?.autoplay === false) delete s.autoplay;
  else { s.autoplay = true; s.interval ??= 3000; }
  Object.assign(s, { type: one ? 'slide' : 'loop', focus: 0, perMove: 1, start: 0 });
}

function writeCarouselStage(s, node, slides) {
  const fitted = fitSlides(slides);
  const stageW = Math.max(node.box?.w ?? 0, fitted.w);
  const stageH = Math.max(node.box?.h ?? 0, fitted.h);
  // A missing height becomes 50vh and the shorter frame then scrolls. The height control lands on .splide__slide, which exists only after Splide starts.
  if (stageH) s.height = px(stageH);
  if (stageW && node.box?.w && stageW > node.box.w + 0.5) s._width = px(stageW);
  if (!stageH) return;
  s._overflow = 'visible';
  addCustomCss(s, `height: ${px(stageH)}; overflow: visible;`);
  addCustomCss(s, 'overflow: hidden;', ' .splide__track');
  addCustomCss(s, 'display: flex;', ' .splide__list');
  addCustomCss(s, `position: relative; overflow: hidden; width: 100%; flex: 0 0 100%; height: ${px(stageH)};`, ' .splide__list > *');
}

function writePagination(settings, node, det, { root, readAsset, warn }) {
  if (!det.params?.pagination) return;
  const info = bricksPagination(node, det, { root, readAsset });
  if (info.use && info.shapes) {
    settings.pagination = true;
    const { idle, active } = dashPair(info.shapes);
    const pag = info.pag;
    Object.assign(settings, {
      paginationWidth: px(idle.box.w), paginationHeight: px(idle.box.h), paginationColor: boxLook(idle, warn).background,
      paginationWidthActive: px(active.box.w), paginationHeightActive: px(active.box.h), paginationColorActive: boxLook(active, warn).background,
    });
    const idleRadius = cornerRadius(idle);
    const activeRadius = cornerRadius(active);
    if (idleRadius) settings.paginationBorder = { radius: radiusOf(idleRadius) };
    if (activeRadius) settings.paginationBorderActive = { radius: radiusOf(activeRadius) };
    addCustomCss(settings, `border-radius: ${px(idleRadius)} !important;`, ' .splide__pagination__page');
    addCustomCss(settings, `border-radius: ${px(activeRadius)} !important;`, ' .splide__pagination__page.is-active');
    if (pag.layout) settings.paginationSpacing = px(pag.layout.gap);
    placePagination(settings, node, pag);
    return;
  }
  if (info.use && info.marks) {
    settings.pagination = true;
    const { idle, active, gap } = info.marks;
    const color = (mark) => colorObj({ hex: mark.hex, alpha: mark.alpha });
    Object.assign(settings, {
      paginationWidth: px(idle.w), paginationHeight: px(idle.h), paginationColor: color(idle),
      paginationWidthActive: px(active.w), paginationHeightActive: px(active.h), paginationColorActive: color(active),
      paginationBorder: { radius: radiusOf(idle.rx) }, paginationBorderActive: { radius: radiusOf(active.rx) },
      paginationSpacing: { top: '0px', right: px(gap / 2), bottom: '0px', left: px(gap / 2) },
    });
    placePagination(settings, node, info.pag);
    return;
  }
  if (!info.use) return;
  settings.pagination = true;
  placePagination(settings, node, info.pag);
  if (info.unparsed) warn(info.pag, 'pagination dashes could not be read: the strip still has one dash per item, in the Bricks dot style');
  else if (contains(node, det.params.pagination)) warn(info.pag ?? node, 'pagination sits inside the slider and is not a row of shapes: one dash per item, Bricks dot style');
}

export default {
  id: PartKind.CAROUSEL,
  status: 'implemented',
  label: 'Carousel',
  figma: 'a horizontal row of similar cards, one slide with arrow buttons, or one card with a Pagination instance inside the frame',
  bricks: '`slider-nested`: type loop when two or more slides are drawn, type slide for one drawn card, perPage = slides fitting the row, gap = auto layout gap, one dash per item, arrows from the drawn controls',
  limits: 'Two or more slides stay type loop. One drawn slide is type slide, because a loop clone moves that card out of the track. Autoplay starts at 3s (the Plan can turn it off or set the seconds). The dash count follows the items, not the Figma pagination drawing; the active dash follows the item in front. Items past the ones drawn in the frame come only from the Figma link of the full set.',
  kind: () => 'slider-nested',

  mergedNodes(det, node, ctx = {}) {
    const ids = [det.params?.prev, det.params?.next, ...(det.params?.controls ?? [])].filter(Boolean);
    const pagId = det.params?.pagination;
    if (pagId) ids.push(pagId);
    return ids;
  },

  check(node, det, { root }) {
    if (node.layout?.mode !== 'HORIZONTAL' && !det.params?.allowSingle) return { ok: false, reason: 'the slide row must be a horizontal auto layout' };
    const slides = slidesOf(node, det);
    if (slides.length < (det.params?.allowSingle ? 1 : 2)) return { ok: false, reason: `needs at least 2 slides, found ${slides.length}` };
    for (const k of ['pagination', 'prev', 'next']) if (det.params?.[k] && !findNode(root, det.params[k])) return { ok: false, reason: `params.${k} ${det.params[k]} is not in the tree` };
    const per = perPageOf(node, slides, det);
    const loopNote = slides.length < 2
      ? 'one drawn slide stays type slide so Splide does not clone it out of the track'
      : 'loop is always on';
    const warnings = [`${slides.length} slides, ${per} per page; ${loopNote} and autoplay is on (3s unless the Plan says otherwise)`];
    const want = Number(det.params?.itemCount);
    if (want && want !== slides.length && det.params?.items?.kind !== 'figma') warnings.push(`asked for ${want} items, this frame draws ${slides.length}: the dashes follow those ${slides.length}. The rest needs the Figma link of the full set`);
    return { ok: true, warnings };
  },

  apply({ node, s, root, warn, readAsset }, det) {
    const slides = slidesOf(node, det);
    Object.assign(s, { perPage: perPageOf(node, slides, det), gap: node.layout?.gap });
    writePagination(s, node, det, { root, readAsset, warn });
    const pair = [['prev', 'prevArrow'], ['next', 'nextArrow']]
      .filter(([key]) => det.params?.[key])
      .map(([key, label]) => ({ key, label, node: findNode(root, det.params[key]) }));
    applySyncedArrows(s, node, pair, warn);
    const extra = jsonParam(det.params?.settings);
    if (extra && typeof extra === 'object') Object.assign(s, deepMerge(s, extra));
    writeCarouselMotion(s, slides, det);
    writeCarouselStage(s, node, slides);
    pinOutsideArrows(s, node, pair);
    // Splide ships `.splide { visibility: hidden }` until JS adds `is-initialized`. This site delays that script, so the slide and its picture stay blank on first paint.
    addCustomCss(s, 'visibility: visible;');
  },
};
