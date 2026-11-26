// Figma TEXT -> Bricks text-basic / heading: typography settings + the html content.
// Paragraphs are split on \n. With paragraphSpacing / paragraphIndent each paragraph becomes a block span
// (margin-top / text-indent), otherwise paragraphs are joined with <br>. Mixed styles become <span style>.
// A gradient text fill becomes `background-clip:text` (the text node's own box is the gradient box, as in Figma).
import { addCustomCss, colorObj, cssColor, px } from '../../write-bricks/render/utils/css.mjs';
import { linearGradientCss, linearGradientControl } from '../../write-bricks/render/utils/gradient.mjs';
import { lineHeightPx } from '../../write-bricks/policy.mjs';

const TEXT_ALIGN = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' };
const TEXT_CASE = { UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' };
const DECO = { UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A run only carries what differs from the node's own style: Figma repeats the full style on every run, and a repeated font-size / line-height
// would stop the span from following the node's typography when a breakpoint changes it (responsive.mjs); the computed values are the same.
function runCss(st, base = {}, baseColor = null, box = null) {
  const c = [];
  if (st.fontFamily && st.fontFamily !== base.fontFamily) c.push(`font-family:${st.fontFamily}`);
  if (st.fontSize && st.fontSize !== base.fontSize) c.push(`font-size:${px(st.fontSize)}`);
  if (st.fontWeight && st.fontWeight !== base.fontWeight) c.push(`font-weight:${st.fontWeight}`);
  if (st.italic && !base.italic) c.push('font-style:italic');
  if (st.letterSpacing != null && st.letterSpacing !== (base.letterSpacing ?? 0)) c.push(`letter-spacing:${px(st.letterSpacing)}`);
  if (st.lineHeightPx && st.lineHeightPx !== base.lineHeightPx) c.push(`line-height:${px(lineHeightPx(st.lineHeightPx))}`);
  if (st.textCase && TEXT_CASE[st.textCase] && st.textCase !== base.case) c.push(`text-transform:${TEXT_CASE[st.textCase]}`);
  if (st.textDecoration && DECO[st.textDecoration] && st.textDecoration !== base.decoration) c.push(`text-decoration:${DECO[st.textDecoration]}`);
  const f = st.fills?.[st.fills.length - 1];
  if (f?.type === 'SOLID' && cssColor(f) !== baseColor) c.push(`color:${cssColor(f)}`);
  // a gradient on a range of characters: the span paints it and clips it to its glyphs (the node's box gives the gradient its size)
  if (f?.type === 'GRADIENT_LINEAR' && f.handles?.length >= 2 && box) c.push(`background-image:${linearGradientCss(f, box.w, box.h)}`, '-webkit-background-clip:text', 'background-clip:text', '-webkit-text-fill-color:transparent');
  return c.join(';');
}

// Figma draws the marker and the indent of a list text itself. Measured on three designs (Banner desktop 18px, Banner mobile 14px, CTA mobile 18px): the text
// starts 1.5em after the box edge and the bullet glyph's ink starts 0.594em after it. The marker is drawn with the Regular "•" of Inter (ink 0.12em after its
// origin), so its origin sits at 0.474em for every weight. Only unordered, first-level lists are built; numbers and nested levels stay a reported limit.
export const LIST_INDENT_EM = 1.5, LIST_BULLET_LEFT_EM = 0.474;
export const listSupported = (t) => !!t.listLines && t.listLines.every((l) => l.type === 'NONE' || (l.type === 'UNORDERED' && l.level === 1));

function textContent(t, baseColor = null, box = null) {
  const pieces = t.runs ?? [{ text: t.characters }];
  const paras = [[]];
  for (const r of pieces) {
    const parts = r.text.split(/\n|\u2028/);
    parts.forEach((part, i) => {
      if (i > 0) paras.push([]);
      if (part) paras.at(-1).push({ text: part, style: r.style });
    });
  }
  const html = paras.map((p) => p.map(({ text, style }) => {
    const body = esc(text);
    const css = style ? runCss(style, t, baseColor, box) : '';
    return css ? `<span style="${css}">${body}</span>` : body;
  }).join(''));
  if (listSupported(t) && t.listLines.length === html.length) {
    // consecutive list lines become one <ul>; the other lines keep the <br> join
    const out = [];
    let ul = null;
    html.forEach((h, i) => {
      if (t.listLines[i].type === 'UNORDERED') { if (!ul) out.push((ul = { items: [] })); ul.items.push(h); } else { ul = null; out.push(h); }
    });
    return out.map((o, i) => (typeof o === 'string' ? (i > 0 && typeof out[i - 1] === 'string' ? breakBefore(out[i - 1], o) : o) : `<ul>${o.items.map((x) => `<li>${x}</li>`).join('')}</ul>`)).join('');
  }
  if (paras.length > 1 && (t.paragraphSpacing || t.paragraphIndent)) {
    return html.map((h, i) => {
      const c = ['display:block'];
      if (i > 0 && t.paragraphSpacing) c.push(`margin-top:${px(t.paragraphSpacing)}`);
      if (t.paragraphIndent) c.push(`text-indent:${px(t.paragraphIndent)}`);
      return `<span style="${c.join(';')}">${h}</span>`;
    }).join('');
  }
  return breakJoin(html);
}

// A hidden <br> must leave a space, or the two words on either side stick together.
function breakBefore(prev, next) {
  return `${/\s$/.test(String(prev)) ? '' : ' '}<br>${next}`;
}

function breakJoin(parts) {
  return parts.reduce((acc, part, i) => (i === 0 ? part : acc + breakBefore(acc, part)), '');
}

// Line height as Figma really laid the text out. For a text whose height is automatic the box height IS the layout result (lines x line box); the
// line box is that height divided by the number of lines, which also covers Figma's own rounding without guessing a rule (a 22.4px line is a 23px box:
// every form field of the Registration section was 1px short with plain rounding). Fixed-height text and anything off by more than 1.5px keep policy rounding.
export function lineHeightFor(node) {
  const t = node.text;
  const raw = t.lineHeightPx;
  const auto = t.autoResize && t.autoResize !== 'NONE' && node.sizing?.v !== 'FIXED';
  if (auto && node.box?.h > 0 && raw > 0) {
    const lines = Math.max(1, Math.round(node.box.h / raw));
    const eff = node.box.h / lines;
    if (Math.abs(eff - raw) <= 1.5) return eff;
  }
  return lineHeightPx(raw);
}

// the Bricks typography object of a TEXT node (also used by components that style a child, e.g. form fields)
export function typography(node) {
  const t = node.text;
  const fill = node.fills?.filter((f) => f.type === 'SOLID').pop();
  const ty = {
    'font-family': t.fontFamily,
    'font-size': px(t.fontSize),
    'font-weight': String(t.fontWeight),
    'line-height': px(lineHeightFor(node)),
    'text-align': TEXT_ALIGN[t.align] ?? 'left',
  };
  if (t.letterSpacing) ty['letter-spacing'] = px(t.letterSpacing);
  if (TEXT_CASE[t.case]) ty['text-transform'] = TEXT_CASE[t.case];
  if (DECO[t.decoration]) ty['text-decoration'] = DECO[t.decoration];
  if (t.italic) ty['font-style'] = 'italic';
  if (fill) ty.color = colorObj(fill);
  return ty;
}

function whiteSpace(node, text) {
  const keepsSpaces = /\S {2,}\S/.test(text.characters ?? '');
  if (text.autoResize === 'WIDTH_AND_HEIGHT') return keepsSpaces ? 'pre' : 'nowrap';
  if (keepsSpaces) return 'pre-wrap';
  const oneLine = text.lineHeightPx && Math.round(node.box.h / lineHeightPx(text.lineHeightPx)) === 1 && (text.characters ?? '').length <= 48;
  return oneLine ? 'nowrap' : undefined;
}

function writeVerticalAlign(node, settings, warn) {
  const align = node.text.valign;
  if (node.sizing?.v !== 'FIXED' || !align || align === 'TOP') return;
  const vertical = align === 'CENTER' ? 'center' : align === 'BOTTOM' ? 'flex-end' : null;
  if (vertical) addCustomCss(settings, `display: flex; flex-direction: column; justify-content: ${vertical};`);
  else warn(node, `text vertical align ${align} in a fixed-height box is not applied`);
}

function writeList(node, settings, warn) {
  const lines = node.text.listLines;
  if (lines && listSupported(node.text)) {
    addCustomCss(settings, 'list-style: none; margin: 0; padding: 0;', ' ul');
    addCustomCss(settings, `position: relative; margin: 0; padding-left: ${LIST_INDENT_EM}em;`, ' li');
    addCustomCss(settings, `content: "\\2022"; position: absolute; top: 0; left: ${LIST_BULLET_LEFT_EM}em; font-weight: 400;`, ' li::before');
    return;
  }
  if (lines) warn(node, `text list formatting (${[...new Set(lines.map((line) => `${line.type} level ${line.level}`))].join(', ')}) not applied: only unordered first-level lists are built, Figma draws the number / nested marker and indent itself`);
}

export function applyText({ node, s, css, warn }) {
  const text = node.text;
  const fill = node.fills?.filter((item) => item.type === 'SOLID').pop();
  const type = typography(node);
  const gradient = node.fills?.filter((item) => item.type === 'GRADIENT_LINEAR').pop();
  if (gradient && !fill) s._gradient = linearGradientControl(gradient, node.box.w, node.box.h, 'text');
  const space = whiteSpace(node, text);
  if (space) type['white-space'] = space;
  s._typography = type;
  s.text = textContent(text, fill ? cssColor(fill) : null, node.box);
  Object.assign(css, {
    'font-size': type['font-size'],
    'font-weight': type['font-weight'],
    'line-height': type['line-height'],
    'text-align': type['text-align'],
    ...(fill && { color: cssColor(fill) }),
    ...(type['letter-spacing'] && { 'letter-spacing': type['letter-spacing'] }),
  });
  writeVerticalAlign(node, s, warn);
  if (text.case === 'SMALL_CAPS') addCustomCss(s, 'font-variant-caps: small-caps;');
  else if (text.case === 'SMALL_CAPS_FORCED') addCustomCss(s, 'font-variant-caps: all-small-caps;');
  writeList(node, s, warn);
  if (text.truncation === 'ENDING' && text.maxLines > 0) addCustomCss(s, `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${text.maxLines}; overflow: hidden;`);
  else if (text.truncation) warn(node, 'text truncation without a max line count not applied');
  if (node.fills?.filter((item) => item.type === 'SOLID').length > 1) warn(node, 'text with several fills: top one used');
}
