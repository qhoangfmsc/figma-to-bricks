// Every generate, including one that only has a desktop frame. The built elements stay the components
// from that frame and keep the values already on them. Below the desktop width a fixed row does not
// fit: flex items are built with flex-shrink 0, so they overflow a phone instead of wrapping.
// This pass only adds breakpoint keys for widths that have no pasted frame. The desktop values stay.
// A pasted tablet or phone frame is left as that frame drew it.

// Tailwind's default min-widths (sm, md, lg, xl, 2xl). A row flips to a column at one of these
// lines, for the whole band. It does not flip at the pixel the children happen to add up to,
// so 1032 and 1200 stay the same layout.
const STEPS = [1536, 1280, 1024, 768, 640];
// Tailwind's default container widths. A content column uses the band it is in, and never grows past
// the width Figma drew. The Figma frame itself is not in these queries.
const CONTAINER_BANDS = [
  { min: 1536, max: Infinity, size: 1536 },
  { min: 1280, max: 1535, size: 1280 },
  { min: 1024, max: 1279, size: 1024 },
  { min: 768, max: 1023, size: 768 },
  { min: 640, max: 767, size: 640 },
];
const snapBelow = (needed, frameWidth) => {
  const need = Math.ceil(needed);
  const frame = Math.floor(Number(frameWidth) || 0);
  const steps = STEPS.filter((w) => frame <= 1 || w < frame);
  if (frame > 1) steps.push(frame);
  steps.sort((a, b) => a - b);
  const holds = steps.find((w) => w >= need);
  if (holds == null) return frame > 1 ? frame - 1 : need;
  return holds - 1;
};

const BREAKS = [
  { key: 'tablet_portrait', limit: 720 },
  { key: 'mobile_landscape', limit: 400 },
  { key: 'mobile_portrait', limit: 300 },
];

// The widths a page can be opened at. A pasted frame of that band is measured at its own width.
// A band with no frame is measured here: text and the page have to stay inside it.
export const FRAME_SCREENS = [
  { key: 'tablet_portrait', width: 991 },
  { key: 'mobile_landscape', width: 767 },
  { key: 'mobile_portrait', width: 320 },
];
export function screensToProve(variants = []) {
  const have = new Set((variants ?? []).map((v) => v.key));
  return FRAME_SCREENS.filter((b) => !have.has(b.key));
}

const pxNum = (v) => (typeof v === 'string' && v.endsWith('px') ? parseFloat(v) : null);
// Four decimals: a 111px inset in a 376px card stays the same fraction when the card shrinks.
const pctOf = (part, whole) => `${Math.round((part / whole) * 1e6) / 1e4}%`;
// A filled item stores its drawn width on flex-basis and leaves _width auto. Both are the same card.
const itemWidth = (s) => pxNum(s?._width) ?? pxNum(s?._widthMax) ?? pxNum(s?._flexBasis);
const classesOf = (s) => `${s?._cssClasses ?? ''} ${s?._hidden?._cssClasses ?? ''}`;
const isTabBar = (e) => /\btab-menu\b/.test(classesOf(e.settings));
const isTabTitle = (e) => /\btab-title\b/.test(classesOf(e.settings));
const isMenu = (e) => e.settings?.tag === 'ul' || e.settings?.tag === 'nav';
const componentRoot = (e) => e.name === 'tabs-nested' || e.name === 'accordion-nested' || e.name === 'form' || e.name === 'slider-nested' || /\bread-more-/.test(classesOf(e.settings));

// A content picture is the div that holds one image at the box Figma drew (figma_rules §6).
// The image inside is already 100% of that div. An absolute backdrop is a background, not this box.
// A card that also holds text is the row, not the picture.
function pictureHit(content, id, depth = 0) {
  if (depth > 4) return { image: false, text: false };
  let image = false;
  let text = false;
  for (const child of content) {
    if (child.parent !== id) continue;
    if (child.name === 'image') image = true;
    else if (child.name === 'text-basic' || child.name === 'heading' || child.name === 'text-link' || child.name === 'button') text = true;
    else if (child.name === 'div' || child.name === 'block') {
      const inner = pictureHit(content, child.id, depth + 1);
      image = image || inner.image;
      text = text || inner.text;
    }
  }
  return { image, text };
}
function pictureBox(s) {
  const w = itemWidth(s);
  const h = pxNum(s?._height);
  return w != null && h != null ? { w, h } : null;
}
function isPictureFrame(el, content) {
  const s = el?.settings;
  if (!s || s._position === 'absolute') return false;
  // Fill stores the drawn width on flex-basis and leaves _width auto. That box is still the frame.
  if (!pictureBox(s)) return false;
  if (el.name === 'image') return true;
  const hit = pictureHit(content, el.id);
  return hit.image && !hit.text;
}
function rowHoldsPicture(row, content) {
  const seen = new Set();
  const walk = (id) => {
    for (const child of content) {
      if (child.parent !== id || seen.has(child.id)) continue;
      seen.add(child.id);
      if (isPictureFrame(child, content) || walk(child.id)) return true;
    }
    return false;
  };
  return walk(row.id);
}
// The wrapper keeps both axes. It becomes 100% only when its own px width is wider than that
// screen, and then the height follows the same ratio (figma_rules §7.5). One axis at 100%
// with the old px height repaints the crop.
function protectPictures(template, keys) {
  const content = template.content ?? [];
  const screens = new Map(FRAME_SCREENS.map((screen) => [screen.key, screen.width]));
  for (const el of content) {
    if (!isPictureFrame(el, content)) continue;
    const s = el.settings ??= {};
    const box = pictureBox(s);
    if (!box) continue;
    const { w, h } = box;
    // The image is 100% of this div and out of flow, so it cannot hold the div open.
    // The div owns the Figma box. flex-shrink 1 on a column eats that height down to 0.
    // flex-grow 1 widens only the width, and object-fit fill then stretches the file.
    if (pxNum(s._width) == null) s._width = `${w}px`;
    s._flexShrink = 0;
    s._flexGrow = 0;
    s._aspectRatio ??= `${Math.round(w)} / ${Math.round(h)}`;
    for (const child of content) {
      if (child.parent !== el.id || child.name !== 'image') continue;
      const cs = child.settings ??= {};
      if (cs._objectFit == null || cs._objectFit === 'fill') cs._objectFit = 'cover';
    }
    for (const key of keys) {
      const screen = screens.get(key);
      if (screen == null) continue;
      s[`_flexShrink:${key}`] = 0;
      s[`_flexGrow:${key}`] = 0;
      if (w <= screen) {
        if (s[`_width:${key}`] === '100%') delete s[`_width:${key}`];
        if (s[`_height:${key}`] === 'auto') delete s[`_height:${key}`];
        continue;
      }
      s[`_width:${key}`] = '100%';
      s[`_widthMax:${key}`] ??= `${Math.round(w)}px`;
      s[`_height:${key}`] = 'auto';
      s[`_aspectRatio:${key}`] ??= `${Math.round(w)} / ${Math.round(h)}`;
    }
  }
}

const appendCss = (s, id, marker, rule) => {
  if (String(s._cssCustom ?? '').includes(marker)) return;
  s._cssCustom = [s._cssCustom, rule].filter(Boolean).join(' ');
};
const isTabPane = (e) => /\btab-pane\b/.test(classesOf(e.settings));

// Column makes flex-basis the height. A card keeps the width Figma drew, on _width or on flex-basis.
const pinStackedCard = (child, breaks = BREAKS) => {
  const cs = child.settings ??= {};
  const w = itemWidth(cs);
  if (w == null || w <= 160) return;
  for (const bp of breaks) {
    cs[`_width:${bp.key}`] ??= `${w}px`;
    if (cs._flexGrow) cs[`_flexGrow:${bp.key}`] ??= 0;
    if (pxNum(cs._flexBasis) != null) cs[`_flexBasis:${bp.key}`] ??= 'auto';
  }
};
const stackRow = (s, breaks = BREAKS) => {
  for (const bp of breaks) {
    s[`_direction:${bp.key}`] ??= 'column';
    // A hug row whose cards are width 100% has no width of its own, so the cards collapse to 0.
    if (s._width == null || s._width === 'auto') s[`_width:${bp.key}`] ??= '100%';
  }
};
// figma_rules §4: a multi-column row stacks when each column is under half that screen, so the
// text does not overflow. The early point is tablet. A picture beside one text block is the
// later point they allow (mobile_landscape): the row stays a row while the two still fit.
const SCREEN_OF = { tablet_portrait: 991, mobile_landscape: 767, mobile_portrait: 478 };
function columnAt(row, wide, breaks, content) {
  if (isMenu(row)) return breaks;
  const s = row.settings ?? {};
  const gap = pxNum(s._columnGap) ?? pxNum(s._gap) ?? 0;
  const widths = wide.map((child) => itemWidth(child.settings)).filter((w) => w != null);
  const sum = widths.reduce((n, w) => n + w, 0) + gap * Math.max(0, widths.length - 1);
  const pair = rowHoldsPicture(row, content) && widths.length <= 2;
  return breaks.filter((bp) => {
    const screen = SCREEN_OF[bp.key];
    if (screen == null) return false;
    if (pair && sum <= screen) return false;
    if (sum > screen) return true;
    return widths.length >= 2 && widths.every((w) => w < screen / 2);
  });
}

// A desktop-only frame has no tablet or phone drawing. Large spacing and headings step down the way
// Tailwind does (a smaller step at each breakpoint) so the 1440 values do not overflow a phone.
// The desktop value is left as Figma drew it. A pasted narrower frame never reaches this.
const SPACE_STEP = {
  tablet_portrait: [2 / 3, 24],
  mobile_landscape: [1 / 2, 16],
  mobile_portrait: [1 / 3, 16],
};
const TYPE_STEP = { tablet_portrait: 0.85, mobile_landscape: 0.75, mobile_portrait: 2 / 3 };
const stepSpace = (n, factor, floor) => `${Math.max(floor, Math.round((n * factor) / 4) * 4)}px`;
const scaleSides = (box, factor, floor) => {
  if (!box || typeof box !== 'object') return null;
  const next = {};
  let changed = false;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const n = pxNum(box[side]);
    if (n == null) { if (box[side] != null) next[side] = box[side]; continue; }
    if (n < 32) { next[side] = box[side]; continue; }
    next[side] = stepSpace(n, factor, floor);
    if (next[side] !== box[side]) changed = true;
  }
  return changed ? next : null;
};
const scaleType = (ty, factor) => {
  const size = pxNum(ty?.['font-size']);
  if (size == null || size < 24) return null;
  const next = Math.max(16, Math.round((size * factor) / 2) * 2);
  if (next === size) return null;
  const out = { 'font-size': `${next}px` };
  const lh = pxNum(ty['line-height']);
  if (lh != null) out['line-height'] = `${Math.max(next, Math.round(lh * (next / size)))}px`;
  if (ty['white-space'] === 'nowrap') out['white-space'] = 'normal';
  // pre keeps a designed line from wrapping, so a phone grows past the screen.
  if (ty['white-space'] === 'pre') out['white-space'] = 'pre-wrap';
  return out;
};

// The desktop values stay the cap. Below the Figma frame the column follows the screen, including the
// range between the breakpoints, so a 1200px window does not keep a 1440px row.
// The frame width itself is never rewritten: width 100% there turns a 1200px column into the padded
// content box (1141px), the 384px cards wrap, and flex-grow stretches them to 558.5px.
export function fitFluid(template, { frameWidth, coveredUntil = 0, keep = [] } = {}) {
  // A pasted frame already drew this breakpoint. Stacking it again turns a tablet row of
  // 175px cards into a column of the desktop 250px cards.
  const open = BREAKS.filter((bp) => !new Set(keep).has(bp.key));
  const underFrame = (body) => {
    const cap = Number(frameWidth);
    if (!Number.isFinite(cap) || cap <= 1) return null;
    return `@media (max-width: ${Math.floor(cap) - 1}px) { ${body} }`;
  };
  // Widths a pasted frame already draws are left alone. The query covers only the undesigned band.
  const band = (max) => {
    const cap = Math.floor(max);
    const floor = Math.floor(Number(coveredUntil) || 0);
    if (!(cap >= 1) || cap <= floor) return null;
    const query = floor > 0 ? `(max-width: ${cap}px) and (min-width: ${floor + 1}px)` : `(max-width: ${cap}px)`;
    return `@media ${query}`;
  };
  const content = template.content ?? [];
  const kids = new Map();
  for (const e of content) {
    if (!kids.has(e.parent)) kids.set(e.parent, []);
    kids.get(e.parent).push(e);
  }
  const byId = new Map(content.map((e) => [e.id, e]));
  // A hug column stores no width of its own. The form drawn inside it is still 481px, and the row is 644 + 128 + 481.
  const spanOf = (el, seen = new Set()) => {
    if (!el || seen.has(el.id)) return 0;
    seen.add(el.id);
    const s = el.settings ?? {};
    if (s._position === 'absolute') return 0;
    const own = itemWidth(s) ?? 0;
    let inner = 0;
    for (const c of kids.get(el.id) ?? []) inner = Math.max(inner, spanOf(c, seen));
    return Math.max(own, inner);
  };
  const insideScroll = (el) => {
    let cur = byId.get(el.parent);
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.settings?._overflow === 'auto') return true;
      cur = byId.get(cur.parent);
    }
    return false;
  };
  const sidePad = (el) => {
    let n = 0;
    let cur = el;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const p = cur.settings?._padding;
      n += (pxNum(p?.left) ?? 0) + (pxNum(p?.right) ?? 0);
      cur = byId.get(cur.parent);
    }
    return n;
  };
  // Any row whose pieces do not fit the window becomes a column there. A hug child counts as the
  // width drawn inside it. A row already drawn under 480px is a small frame and stays as drawn.
  // A pasted phone frame that draws three or more cards of one width past 478px is a horizontal
  // list: the row stays a row and scrolls. Two cards still stack. The next file with that row does too.
  const shrinkAt = new Map();
  const scrollRows = new Set();
  // Full drawn width of a row that can shrink. Below that width, nowrap wins over wrap so the
  // last card stays on the line. The column rule, when it exists, starts at the 160px floor.
  const holdAt = new Map();
  for (const e of content) {
    const s = e.settings ??= {};
    if (s._direction !== 'row' || isTabBar(e) || e.name === 'slider-nested' || s._position === 'absolute') continue;
    // The clip frame already scrolls this row. Stacking it would drop the items into a column.
    if (s._overflow === 'auto' || byId.get(e.parent)?.settings?._overflow === 'auto') continue;
    const rowWidth = pxNum(s._width) ?? (s._widthMax === 'none' ? null : pxNum(s._widthMax));
    if (rowWidth != null && rowWidth < 480) continue;
    const children = (kids.get(e.id) ?? []).filter((c) => c.settings?._position !== 'absolute');
    const gap = pxNum(s._columnGap) ?? pxNum(s._gap) ?? 0;
    const flowing = children.filter((c) => spanOf(c) > 0);
    if (flowing.length < 2) continue;
    // A FILL card keeps the Figma width on flex-basis and flex-shrink 1, so it can give up a few
    // pixels and stay on one line. Stacking at the full basis turns a 1032px window into a column
    // while each card still has room. 160px is the same floor a stacked card is still a card.
    // flex-shrink 0 cannot give that width up, so that row still stacks at the full sum.
    const canShrink = (c) => {
      const v = c.settings?._flexShrink;
      return v != null && Number(v) !== 0;
    };
    const shrinkable = flowing.every(canShrink);
    const extras = gap * Math.max(0, flowing.length - 1) + sidePad(e);
    const full = flowing.reduce((n, c) => n + spanOf(c), 0) + extras;
    const sum = (shrinkable ? flowing.reduce((n, c) => n + Math.min(spanOf(c), 160), 0) : full - extras) + extras;
    if (sum <= 320) continue;
    if (shrinkable && full > sum) holdAt.set(e.id, snapBelow(full, frameWidth));
    // The phone breakpoint is max-width 478. A row wider than that does not fit the pasted
    // phone frame, so that frame stacks it. A row that fits the frame keeps the direction it drew.
    // Three or more cards of one width are the list the phone drew past the frame: scroll, do not stack.
    const atPhone = (c) => pxNum(c.settings?.['_width:mobile_portrait']) ?? spanOf(c);
    const cards = flowing
      .filter((c) => c.settings?.['_display:mobile_portrait'] !== 'none')
      .map((c) => ({ c, w: atPhone(c) }))
      .filter((card) => card.w >= 160);
    const widest = Math.max(0, ...cards.map((card) => card.w));
    const narrowest = cards.length ? Math.min(...cards.map((card) => card.w)) : 0;
    const cardSum = cards.reduce((n, card) => n + card.w, 0) + gap * Math.max(0, cards.length - 1);
    // A card that can shrink stays in the wrap rules below. Only a fixed card past the phone scrolls.
    const gallery = !shrinkable && keep.includes('mobile_portrait') && cards.length >= 3 && widest > 0 && (widest - narrowest) / widest <= 0.2 && cardSum > 478;
    if (gallery) {
      scrollRows.add(e.id);
      s['_direction:mobile_portrait'] = 'row';
      s['_flexWrap:mobile_portrait'] = 'nowrap';
      s['_width:mobile_portrait'] = '100%';
      s['_widthMax:mobile_portrait'] = '100%';
      s['_overflow:mobile_portrait'] = 'auto';
      for (const card of cards) card.c.settings['_flexShrink:mobile_portrait'] = 0;
      continue;
    }
    if (keep.includes('mobile_portrait') && !keep.includes('mobile_landscape') && full > 478) s['_direction:mobile_portrait'] ??= 'column';
    const stackAt = snapBelow(sum, frameWidth);
    const query = band(stackAt);
    if (!query) continue;
    // body #id beats the breakpoint row Bricks prints later, so this stack still wins inside that band.
    appendCss(s, e.id, 'fluid-stack', `${query} { body #brxe-${e.id} { flex-direction: column; width: 100%; max-width: 100%; } }`);
    for (const child of children) {
      if (spanOf(child) < 80) continue;
      shrinkAt.set(child.id, stackAt);
      appendCss(child.settings, child.id, 'fluid-stack-child', `${query} { #brxe-${child.id} { max-width: 100%; flex-shrink: 1; min-width: 0; } }`);
    }
  }
  for (const e of content) {
    const s = e.settings ??= {};
    if (s._position === 'absolute') {
      // A panel drawn 15px inside a 1031px bar is 1001px. Below the frame the bar is already
      // width 100%, and the panel would stick out. The inset stays; the panel follows the bar.
      // A pasted breakpoint is outside this query, so that frame keeps the box it drew.
      const parentW = pxNum(byId.get(e.parent)?.settings?._width);
      const width = pxNum(s._width);
      const left = pxNum(s._left);
      const leftPx = left ?? 0;
      const right = parentW == null || width == null ? -1 : parentW - leftPx - width;
      const fills = parentW != null && width != null && width >= 160 && width <= parentW + 1
        && leftPx >= 0 && right >= -1
        && (left != null || width >= parentW - 1)
        && (width >= parentW * 0.8 || right <= 2);
      const cap = Number(frameWidth);
      const query = fills && Number.isFinite(cap) ? band(Math.floor(cap) - 1) : null;
      if (query) {
        const inset = Math.round((leftPx + Math.max(0, right)) * 100) / 100;
        const body = inset > 0
          ? `width: calc(100% - ${inset}px); max-width: ${Math.floor(width)}px;`
          : `width: 100%; max-width: ${Math.floor(width)}px;`;
        appendCss(s, e.id, 'fluid-inset', `${query} { #brxe-${e.id} { ${body} } }`);
      }
      continue;
    }
    // A card inside a scroll list keeps the width it drew. max-width 100% would squash it into the window.
    // The scrollport itself fills its parent. A px cap would leave Mobile L short of the column that S and M fill.
    if (insideScroll(e) || (s._attributes ?? []).some((a) => a?.name === 'data-f2b-scroll')) continue;
    const width = pxNum(s._width);
    // A content picture keeps both axes of its Figma box. Width 100% under the frame, with the
    // old height left in place, stretches the crop. The query starts only once the window is
    // narrower than the box, and the height follows the same ratio.
    if (isPictureFrame(e, content)) {
      const boxW = itemWidth(s);
      const height = pxNum(s._height);
      if (boxW != null && height != null) {
        const query = band(Math.floor(boxW) - 1);
        if (query) appendCss(s, e.id, 'picture-ratio', `${query} { #brxe-${e.id} { width: 100%; max-width: ${Math.round(boxW)}px; height: auto; aspect-ratio: ${Math.round(boxW)} / ${Math.round(height)}; } }`);
      }
      continue;
    }
    // size.mjs sets max-width none when the fixed box is wider than the parent's content room.
    // Every other wide px width also stays on the desktop key. The shrink lives under the frame,
    // so a verify at that frame still measures the Figma pixels.
    // A column beside another column shrinks at the row's stack point, not at the whole frame:
    // width 100% from 1904px would take the row and push the form out while the window still fits both.
    if (width != null && width >= 640 && s._widthMax !== 'none') {
      const at = shrinkAt.get(e.id);
      const cap = Number(frameWidth);
      const body = `#brxe-${e.id} { width: 100%; max-width: ${width}px; min-width: 0; }`;
      const query = at != null ? band(at) : null;
      const rule = at != null ? (query && `${query} { ${body} }`) : underFrame(body);
      if (rule && !(at != null && Number.isFinite(cap) && at > Math.floor(cap) - 1)) appendCss(s, e.id, 'fluid-width', rule);
    }
    // A 481px form keeps that width on desktop. max-width none would also keep it on a 320px window.
    if (width != null && width >= 160 && s._widthMax === 'none') {
      const at = snapBelow(width, frameWidth);
      const query = band(at);
      if (query) appendCss(s, e.id, 'fluid-cap', `${query} { #brxe-${e.id} { max-width: 100%; } }`);
    }
    if (isTabBar(e)) {
      s._widthMax = '100%';
      appendCss(s, e.id, 'overflow-x: auto', `#brxe-${e.id} { max-width: 100%; overflow-x: auto; flex-wrap: nowrap; }`);
    }
  }
  const plain = (s) => (typeof s.text === 'string' ? s.text.replace(/<[^>]+>/g, '') : '');
  for (const e of content) {
    const s = e.settings ??= {};
    // A one-line heading is nowrap so it matches Figma at 1440. The section clips overflow, so on a
    // narrower window the end of the title is cut off. Below desktop it wraps inside the section.
    if (s._typography?.['white-space'] !== 'nowrap') continue;
    const parent = byId.get(e.parent);
    if (isTabTitle(e) || (parent && isTabTitle(parent))) continue;
    if (plain(s).trim().length <= 24) continue;
    s['_typography:tablet_portrait'] = { ...(s['_typography:tablet_portrait'] ?? {}), 'white-space': 'normal' };
    const sharesRow = parent?.settings?._direction === 'row' && (kids.get(parent.id) ?? []).filter((c) => c.settings?._position !== 'absolute').length > 1;
    // In a row the line uses the space left beside the icon. Width 100% would push that icon off the card.
    if (sharesRow) {
      s['_flexGrow:tablet_portrait'] ??= 1;
      s['_flexShrink:tablet_portrait'] ??= 1;
      s['_widthMin:tablet_portrait'] ??= '0px';
    } else s['_width:tablet_portrait'] ??= '100%';
    // That tablet key also matches the phone. A pasted phone frame keeps the one line it drew.
    if (keep.includes('mobile_portrait') && !keep.includes('mobile_landscape')) {
      if (!('_typography:mobile_portrait' in s)) s['_typography:mobile_portrait'] = structuredClone(s._typography);
      if (!sharesRow && !('_width:mobile_portrait' in s) && s._width != null) s['_width:mobile_portrait'] = s._width;
    }
  }
  for (const e of content) {
    const s = e.settings ??= {};
    if (s._direction !== 'row' || isTabBar(e) || e.name === 'slider-nested') continue;
    if (s._overflow === 'auto' || byId.get(e.parent)?.settings?._overflow === 'auto') continue;
    const children = (kids.get(e.id) ?? []).filter((c) => c.settings?._position !== 'absolute');
    const widths = children.map((c) => itemWidth(c.settings)).filter((w) => w >= 80);
    const rowWidth = pxNum(s._width) ?? pxNum(s._widthMax);
    const wide = children.filter((c) => (itemWidth(c.settings) ?? 0) > 160);
    // Both tab panes are a row of the same cards. One pane writes the card width on _width, the other on
    // flex-basis, and only the first one used to stack. Column makes flex-basis the height, so the card
    // keeps its drawn width instead of growing taller.
    if ((wide.length >= 2 || isMenu(e)) && !(rowWidth != null && rowWidth < 480)) {
      const stacked = columnAt(e, wide, open, content);
      if (stacked.length) {
        stackRow(s, stacked);
        for (const child of wide) pinStackedCard(child, stacked);
      }
    }
    // A scrolling card list keeps one line. Wrap would drop each card under the one before it.
    if (scrollRows.has(e.id)) continue;
    if (rowWidth != null && rowWidth < 480) continue;
    if (widths.length < 2 || widths.reduce((sum, w) => sum + w, 0) < 480) continue;
    // A row that holds a fixed picture stacks. Wrap would drop the picture onto its own line and,
    // once a later pass has set one axis to 100%, stretch it. nowrap also beats the theme rule
    // that forces wrap on every block below 767px.
    if (rowHoldsPicture(e, content)) {
      s._flexWrap ??= 'nowrap';
      continue;
    }
    // Wrap and shrink only below the frame. At the frame, nowrap keeps a 384px card from growing.
    // A row that can shrink then pins nowrap back on, up to its drawn width: wrap would drop the
    // last card onto its own line while the window can still hold the row (1032px vs four 250px cards).
    const wrap = underFrame(`#brxe-${e.id} { flex-wrap: wrap; }`);
    if (wrap) appendCss(s, e.id, 'fluid-wrap', wrap);
    const hold = holdAt.get(e.id);
    const holdQuery = hold ? band(hold) : null;
    if (holdQuery) appendCss(s, e.id, 'fluid-hold', `${holdQuery} { #brxe-${e.id} { flex-wrap: nowrap; } }`);
    for (const child of children) {
      const shrink = underFrame(`#brxe-${child.id} { flex-shrink: 1; max-width: 100%; }`);
      if (shrink) appendCss(child.settings, child.id, 'fluid-shrink', shrink);
    }
  }
  // Panes of one tabs-nested are the same data shown two ways. If one pane stacks, its sibling panes stack
  // too, even when their cards stored no width the first pass could see. A pane drawn under 480px stays as drawn.
  for (const root of content) {
    if (root.name !== 'tabs-nested') continue;
    const panes = [];
    const walk = (id, depth) => {
      for (const c of kids.get(id) ?? []) {
        if (isTabPane(c)) panes.push(c);
        else if (depth < 3) walk(c.id, depth + 1);
      }
    };
    walk(root.id, 0);
    if (!panes.some((p) => p.settings?.['_direction:tablet_portrait'] === 'column')) continue;
    for (const pane of panes) {
      const s = pane.settings ??= {};
      if (s._direction !== 'row') continue;
      const rowWidth = pxNum(s._width) ?? pxNum(s._widthMax);
      if (rowWidth != null && rowWidth < 480) continue;
      const children = (kids.get(pane.id) ?? []).filter((c) => c.settings?._position !== 'absolute');
      if (children.length < 2) continue;
      stackRow(s, open);
      for (const child of children) pinStackedCard(child, open);
    }
  }
  for (const e of content) {
    if (e.parent !== 0 && e.parent !== '0') continue;
    const s = e.settings ??= {};
    const left = pxNum(s._padding?.left);
    const right = pxNum(s._padding?.right);
    if (left == null || right == null || left < 48 || right < 48) continue;
    // The desktop-only steps already set breakpoint padding. A second fluid rule would override them
    // depending on stylesheet order, so the next generate would not match the last one.
    if (s['_padding:tablet_portrait'] || s['_padding:mobile_portrait']) continue;
    const inner = Math.max(0, ...(kids.get(e.id) ?? []).map((c) => {
      const max = c.settings?._widthMax;
      if (max === 'none') return 0;
      return pxNum(max) ?? pxNum(c.settings?._width) ?? 0;
    }));
    if (inner < 480) continue;
    const side = Math.max(left, right);
    // A pasted phone frame leaves the desktop frame in place above that frame. This clamp only covers that gap.
    appendCss(s, e.id, '100vw', `#brxe-${e.id} { padding-left: max(16px, min(${side}px, calc((100vw - ${inner}px) / 2))); padding-right: max(16px, min(${side}px, calc((100vw - ${inner}px) / 2))); }`);
  }
  const frameCap = Math.floor(Number(frameWidth) || 0);
  const floor = Math.floor(Number(coveredUntil) || 0);
  // A full-bleed picture is a percentage of the frame plus a px min-width, so it matches Figma there.
  // Off that frame the px min-width stays huge on a phone and short once the section grows. The picture
  // then fills the section. The Figma width and min-width on the element are left as drawn.
  if (frameCap > 1) {
    for (const e of content) {
      const s = e.settings ??= {};
      if (s._position !== 'absolute') continue;
      if (typeof s._width !== 'string' || !s._width.endsWith('%')) continue;
      if (!((pxNum(s._widthMin) ?? 0) >= 480)) continue;
      const body = `body #brxe-${e.id} { height: 100%; min-height: 100%; min-width: 100%; aspect-ratio: auto; }`;
      const under = floor > 0
        ? `@media (max-width: ${frameCap - 1}px) and (min-width: ${floor + 1}px) { ${body} }`
        : `@media (max-width: ${frameCap - 1}px) { ${body} }`;
      appendCss(s, e.id, 'fluid-cover', under);
      appendCss(s, e.id, 'fluid-cover-wide', `@media (min-width: ${frameCap + 1}px) { ${body} }`);
    }
  }
  // The in-flow column under the section is the container. Each band caps it. A column marked
  // max-width none is the 1200px case that must stay its Figma width at the frame, so it is skipped.
  if (frameCap > 1) {
    const roots = new Set(content.filter((e) => e.parent === 0 || e.parent === '0').map((e) => e.id));
    for (const e of content) {
      const s = e.settings ??= {};
      if (s._position === 'absolute' || !roots.has(e.parent)) continue;
      const drawn = pxNum(s._width);
      if (drawn == null || drawn < 480 || s._widthMax === 'none') continue;
      for (const band of CONTAINER_BANDS) {
        let min = band.min;
        let max = band.max === Infinity ? frameCap - 1 : Math.min(band.max, frameCap - 1);
        if (floor > 0) min = Math.max(min, floor + 1);
        if (!(max >= min)) continue;
        const cap = Math.min(drawn, band.size);
        const query = `(max-width: ${max}px) and (min-width: ${min}px)`;
        appendCss(s, e.id, `container-${band.size}`, `@media ${query} { #brxe-${e.id} { width: 100%; max-width: ${cap}px; margin-left: auto; margin-right: auto; } }`);
      }
    }
  }
  protectPictures(template, open.map((bp) => bp.key));
  return template;
}

// Five ranks cover every width: widescreen, then desktop, then tablet (768–991), then mobile.
// Bricks has no breakpoint at 768. A pasted phone frame is max-width 478, so it also fills the
// landscape rank through 767. Tablet starts at 768. A pasted landscape frame is left alone.
export function holdMobileBand(template, { keep = [] } = {}) {
  if (!keep.includes('mobile_portrait') || keep.includes('mobile_landscape')) return template;
  const content = template.content ?? [];
  // The phone frame owns every width through 767. A stack query keeps its 479 floor, so the
  // pasted frame is not restyled and the open band above it still matches. Raising that floor
  // to 768 made a max-width 639 query match nothing.
  const widen = (css) => {
    const kept = [];
    const out = String(css)
      .replaceAll('@media (max-width: 478px)', '@media (max-width: 767px)')
      .replaceAll('@media (min-width: 479px) and (max-width: 991px)', '@media (min-width: 768px) and (max-width: 991px)')
      .replaceAll(/@media \(max-width: (\d+)px\) and \(min-width: 479px\) \{((?:[^{}]|\{[^{}]*\})*)\}/g, (all, max, body) => {
        const cap = Number(max);
        // The 479 floor is the pasted phone frame. A stack keeps it, so 375 stays the row Figma drew
        // and 479–639 is the step down. Raising that floor to 768 made the query match nothing.
        if (/flex-direction:\s*column/.test(body)) {
          kept.push(all);
          return `\u0000STACK${kept.length - 1}\u0000`;
        }
        if (cap < 768) return `@media (max-width: ${cap}px) {${body}}`;
        return `@media (max-width: ${cap}px) and (min-width: 768px) {${body}}`;
      })
      .replaceAll('(min-width: 479px)', '(min-width: 768px)');
    return out.replaceAll(/\u0000STACK(\d+)\u0000/g, (_, i) => kept[Number(i)]);
  };
  for (const e of content) {
    const s = e.settings;
    if (!s) continue;
    // The landscape step matches the phone too. A phone frame that kept the base type has no portrait key,
    // so the 0.75 step (18px over a 24px heading) was what the phone showed.
    if (!('_typography:mobile_portrait' in s) && s._typography && (s['_typography:mobile_landscape'] || s['_typography:tablet_portrait'])) {
      s['_typography:mobile_portrait'] = structuredClone(s._typography);
    }
    // Tablet is max-width 991, so a 100% width there also matches the phone. A pasted phone frame keeps the width it drew.
    const stretched = s['_width:tablet_portrait'] === '100%' || s['_width:mobile_landscape'] === '100%';
    if (!('_width:mobile_portrait' in s) && s._width != null && stretched) s['_width:mobile_portrait'] = s._width;
    const mobile = Object.keys(s).filter((k) => k.endsWith(':mobile_portrait'));
    const owned = new Set(mobile.map((k) => k.slice(0, -':mobile_portrait'.length)));
    for (const k of mobile) s[k.replace(':mobile_portrait', ':mobile_landscape')] = structuredClone(s[k]);
    // The stack pass pins the desktop card onto this open band. The phone frame already drew the element.
    if (mobile.length && s['_display:mobile_portrait'] === 'grid' && !owned.has('_direction')) delete s['_direction:mobile_landscape'];
    if (mobile.length && !owned.has('_width') && pxNum(s['_width:mobile_landscape']) != null) delete s['_width:mobile_landscape'];
    if (s._cssCustom) s._cssCustom = widen(s._cssCustom);
  }
  return template;
}

export function fitSoloTemplate(template, { keep = [] } = {}) {
  const frozen = new Set(keep);
  const breaks = BREAKS.filter((bp) => !frozen.has(bp.key));
  // Every pasted breakpoint already has its own frame. Nothing is left to step down.
  if (!breaks.length) return template;
  const desktopOnly = breaks.length === BREAKS.length;
  const content = template.content ?? [];
  const byId = new Map(content.map((e) => [e.id, e]));
  const kids = new Map();
  for (const e of content) {
    if (!kids.has(e.parent)) kids.set(e.parent, []);
    kids.get(e.parent).push(e);
  }
  const inSlider = (e) => {
    let p = byId.get(e.parent);
    while (p) {
      if (p.name === 'slider-nested') return true;
      p = byId.get(p.parent);
    }
    return false;
  };
  const formParents = new Set(content.filter((e) => e.name === 'form').map((e) => e.parent));
  const fill = (s, force, width) => {
    for (const bp of breaks) {
      if (!force && !(width != null && width > bp.limit)) continue;
      s[`_width:${bp.key}`] ??= '100%';
    }
  };

  for (const e of content) {
    const s = e.settings ??= {};
    if (s._position === 'absolute' || isTabTitle(e)) {
      // A content frame placed by hand (the benefits block at left 332px, width 1232px) is exact on
      // the desktop frame and falls off a phone. Below 991px it joins the column. A pinned icon or
      // a picture with no text stays where Figma put it. The desktop coordinates are not changed.
      if (s._position === 'absolute') {
        const placed = pxNum(s._width);
        const hasText = (el) => el.name === 'text-basic' || el.name === 'heading' || el.name === 'text-link' || el.name === 'button' || (kids.get(el.id) ?? []).some(hasText);
        const joinsFlow = desktopOnly && placed != null && placed >= 480 && hasText(e);
        if (joinsFlow) {
          appendCss(s, e.id, 'left: auto; right: auto', `@media (max-width: 991px) { #brxe-${e.id} { position: relative; left: auto; right: auto; top: auto; bottom: auto; width: 100%; height: auto; } }`);
          let parent = byId.get(e.parent);
          while (parent) {
            const ps = parent.settings ??= {};
            if (pxNum(ps._height) != null && ps._position !== 'absolute') {
              for (const bp of breaks) ps[`_height:${bp.key}`] ??= 'auto';
              // A picture drawn a few percent past its card is inside the desktop frame. On a phone
              // the card is the screen, so that bleed would scroll the page sideways.
              appendCss(ps, parent.id, 'overflow-x: hidden', `@media (max-width: 991px) { #brxe-${parent.id} { overflow-x: hidden; } }`);
            }
            parent = byId.get(parent.parent);
          }
        } else {
          // No phone frame was pasted. A pinned group keeps its fraction of the card, or a 111px
          // inset stays put while the card becomes the screen and the group leaves it.
          const host = byId.get(e.parent);
          const pw = pxNum(host?.settings?._width);
          const ph = pxNum(host?.settings?._height);
          const left = pxNum(s._left);
          const width = pxNum(s._width);
          // A 24px icon already fits. A group whose right edge passes 240px does not, once the card shrinks.
          const reaches = ((left ?? 0) + (width ?? 0)) > 240 || (width ?? 0) >= 160;
          if (reaches && pw > 0) {
            for (const bp of breaks) {
              if (left != null) s[`_left:${bp.key}`] ??= pctOf(left, pw);
              if (width != null && width >= 160) s[`_width:${bp.key}`] ??= pctOf(width, pw);
              if (ph > 0) {
                const top = pxNum(s._top);
                const height = pxNum(s._height);
                if (top != null) s[`_top:${bp.key}`] ??= pctOf(top, ph);
                if (height != null && height >= 160) s[`_height:${bp.key}`] ??= pctOf(height, ph);
              }
            }
          }
        }
      }
      continue;
    }
    const width = pxNum(s._width);
    const rowHost = byId.get(e.parent);
    const rowMates = (kids.get(e.parent) ?? []).filter((c) => c.id !== e.id && c.settings?._position !== 'absolute');
    const iconBeside = rowMates.some((c) => { const w = pxNum(c.settings?._width); return w != null && w > 0 && w < 80; });
    // A 326px line beside a 14px icon. Width 100% is the whole row, so the line starts after the icon and leaves the card.
    // A row of cards is not this: those cards stay their own width and stack.
    const besideIcon = rowHost?.settings?._direction === 'row' && iconBeside && width != null && width >= 160 && !rowMates.some((c) => (pxNum(c.settings?._width) ?? 0) >= 160);
    // A slide's own width belongs to Splide. Content inside the slide still has the desktop
    // pixel width, which is wider than the slide once perPage drops. A picture frame keeps
    // both axes in protectPictures, so this pass does not turn one of them into 100%.
    if (!isPictureFrame(e, content) && inSlider(e)) fill(s, width != null && width > 200, width);
    else if (!isPictureFrame(e, content) && !besideIcon) fill(s, componentRoot(e), width);
    if (besideIcon && !isPictureFrame(e, content)) {
      for (const bp of breaks) {
        s[`_width:${bp.key}`] ??= 'auto';
        s[`_flexGrow:${bp.key}`] ??= 1;
        s[`_flexShrink:${bp.key}`] ??= 1;
        s[`_widthMin:${bp.key}`] ??= '0px';
      }
      if (rowHost.settings._width == null || rowHost.settings._width === 'auto') {
        for (const bp of breaks) rowHost.settings[`_width:${bp.key}`] ??= '100%';
      }
    }

    const grows = e.name === 'accordion-nested' || e.name === 'tabs-nested' || e.name === 'form' || formParents.has(e.id);
    if (grows && pxNum(s._height) != null) {
      for (const bp of breaks) s[`_height:${bp.key}`] ??= 'auto';
    }

    const children = kids.get(e.id) ?? [];
    const wideKids = children.filter((c) => (itemWidth(c.settings) ?? 0) > 160);
    if (s._direction === 'row' && !isTabBar(e) && e.name !== 'slider-nested' && (wideKids.length >= 2 || isMenu(e))) {
      const stacked = columnAt(e, wideKids, breaks, content);
      if (stacked.length) stackRow(s, stacked);
    }

    if (e.name === 'slider-nested' && s.optionsType !== 'custom') {
      const per = Number(s.perPage) || 1;
      if (per > 1) {
        for (const bp of breaks) {
          const pages = bp.key === 'mobile_portrait' ? 1 : Math.min(2, per);
          s[`perPage:${bp.key}`] ??= pages;
        }
        // mobile_landscape's perPage also matches the phone. A pasted phone frame keeps the count it was built with.
        if (frozen.has('mobile_portrait')) s['perPage:mobile_portrait'] ??= per;
      }
    }

    if (isTabBar(e)) {
      const rule = `@media (max-width: 991px) { #brxe-${e.id} { overflow-x: auto; flex-wrap: nowrap; } }`;
      if (!String(s._cssCustom ?? '').includes(`#brxe-${e.id} { overflow-x: auto`)) s._cssCustom = [s._cssCustom, rule].filter(Boolean).join(' ');
    }

    const parent = byId.get(e.parent);
    const tabLabel = isTabTitle(e) || (parent && isTabTitle(parent));
    // A hug box is allowed to be wider than its parent on the desktop frame (max-width none).
    // Below that frame it stays inside the parent, or the phone page scrolls sideways.
    if ((s._width === 'auto' || s._width == null) && s._widthMax === 'none' && s._position !== 'absolute') {
      for (const bp of breaks) s[`_widthMax:${bp.key}`] ??= '100%';
    }
    for (const [key, [factor, floor]] of Object.entries(SPACE_STEP)) {
      if (frozen.has(key)) continue;
      for (const prop of ['_padding', '_margin']) {
        const scaled = scaleSides(s[prop], factor, floor);
        if (!scaled) continue;
        // A side of 200px or more is the inset that centers a column in a wide frame.
        // A third of it is still most of a phone, so the small screens use a 24px gutter.
        for (const side of ['left', 'right']) {
          if ((pxNum(s[prop]?.[side]) ?? 0) >= 200 && (pxNum(scaled[side]) ?? 0) > 24) scaled[side] = '24px';
        }
        s[`${prop}:${key}`] ??= scaled;
      }
    }
    if (!tabLabel) {
      for (const [key, factor] of Object.entries(TYPE_STEP)) {
        if (frozen.has(key)) continue;
        const scaled = scaleType(s._typography, factor);
        if (!scaled) continue;
        s[`_typography:${key}`] ??= scaled;
        // Width 100% wraps a heading that is the column. In a row it takes the whole line and the icon beside it leaves the card.
        const sharesRow = parent?.settings?._direction === 'row' && (kids.get(parent.id) ?? []).length > 1;
        if (!sharesRow && (s._width === 'auto' || (pxNum(s._width) ?? 0) >= 240)) s[`_width:${key}`] ??= '100%';
      }
      // A short line is still pre. The size step skips it, and the phone would keep the unwrapped line.
      if (s._typography?.['white-space'] === 'pre') {
        for (const bp of breaks) {
          const key = `_typography:${bp.key}`;
          if (!s[key]?.['white-space']) s[key] = { ...(s[key] ?? {}), 'white-space': 'pre-wrap' };
        }
      }
    }
  }
  protectPictures(template, breaks.map((bp) => bp.key));
  return template;
}

// A desktop px width that is still a px width at this screen, and is wider than the screen.
// Percentage widths and a box pulled into the column (width 100% in the breakpoint css) are inside.
// Our step-down runs first and keeps a pasted frame. A breakpoint that still has no frame, and a
// box that is still a px width wider than that screen, takes the production width rule: 100% of
// the parent, capped at the px Figma drew. The desktop key is not rewritten.
const classesOfEl = (e) => `${e.settings?._cssClasses ?? ''} ${e.settings?._hidden?._cssClasses ?? ''}`;
export function fitAnvRemainder(template, { keep = [] } = {}) {
  const frozen = new Set(keep);
  const open = FRAME_SCREENS.filter((screen) => !frozen.has(screen.key));
  const content = template.content ?? [];
  const byId = new Map(content.map((e) => [e.id, e]));
  const inTabBar = (el) => {
    let parent = byId.get(el.parent);
    while (parent) {
      if (/\btab-menu\b/.test(classesOfEl(parent))) return true;
      parent = byId.get(parent.parent);
    }
    return false;
  };
  for (const screen of open) {
    for (const el of content) {
      if (el.settings?._position === 'absolute' || /\btab-title\b/.test(classesOfEl(el)) || inTabBar(el)) continue;
      const settings = el.settings ??= {};
      if ((settings._attributes ?? []).some((a) => a?.name === 'data-f2b-scroll')) continue;
      const desktop = pxNum(settings._width);
      // Our step already switched this screen to 100%. The cap stops that 100% from growing past the px Figma drew.
      if (settings[`_width:${screen.key}`] === '100%' && desktop != null && desktop > screen.width && settings[`_widthMax:${screen.key}`] == null && settings._widthMax !== '100%') {
        settings[`_widthMax:${screen.key}`] = `${Math.round(desktop)}px`;
      }
    }
    for (const id of pxPastScreen(template, screen.width)) {
      const el = byId.get(id);
      if (!el || el.settings?._position === 'absolute') continue;
      if (/\btab-title\b/.test(classesOfEl(el)) || inTabBar(el)) continue;
      const settings = el.settings ??= {};
      if ((settings._attributes ?? []).some((a) => a?.name === 'data-f2b-scroll')) continue;
      const raw = settings[`_width:${screen.key}`] ?? settings._width;
      const width = pxNum(raw);
      if (width == null || width <= screen.width) continue;
      settings[`_width:${screen.key}`] = '100%';
      settings[`_widthMax:${screen.key}`] ??= `${Math.round(width)}px`;
      const parent = byId.get(el.parent);
      const parentSettings = parent?.settings;
      if (!parentSettings || parentSettings._direction !== 'row' || parentSettings[`_direction:${screen.key}`]) continue;
      const mates = content.filter((child) => child.parent === parent.id && child.settings?._position !== 'absolute');
      if (mates.length >= 2 && !/\btab-menu\b/.test(classesOfEl(parent))) parentSettings[`_direction:${screen.key}`] = 'column';
    }
  }
  protectPictures(template, open.map((screen) => screen.key));
  return template;
}

// A desktop px width that is still a px width at this screen, and is wider than the screen.
// Percentage widths and a box pulled into the column (width 100% in the breakpoint css) are inside.
export function pxPastScreen(template, width) {
  const bp = width <= 478 ? 'mobile_portrait' : width <= 767 ? 'mobile_landscape' : 'tablet_portrait';
  const out = [];
  for (const e of template.content ?? []) {
    const s = e.settings ?? {};
    if (String(s._cssCustom ?? '').includes('width: 100%')) continue;
    const raw = s[`_width:${bp}`] ?? s._width;
    if (typeof raw === 'string' && raw.endsWith('%')) continue;
    const w = pxNum(raw);
    if (w == null) continue;
    const max = s[`_widthMax:${bp}`] ?? s._widthMax;
    if (max === '100%') continue;
    const leftRaw = s[`_left:${bp}`] ?? s._left;
    const left = typeof leftRaw === 'string' && leftRaw.endsWith('%') ? 0 : (pxNum(leftRaw) ?? 0);
    if (w > width || left + w > width + 1) out.push(e.id);
  }
  return out;
}
