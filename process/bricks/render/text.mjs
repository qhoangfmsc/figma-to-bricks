// Figma TEXT -> Bricks text-basic / heading: typography settings + the html content.
// Paragraphs are split on \n. With paragraphSpacing / paragraphIndent each paragraph becomes a block span
// (margin-top / text-indent), otherwise paragraphs are joined with <br>. Mixed styles become <span style>.
// A gradient text fill becomes `background-clip:text` (the text node's own box is the gradient box, as in Figma).
import { addCustomCss, colorObj, cssColor, px } from './utils/css.mjs';
import { linearGradientCss } from './utils/gradient.mjs';
import { lineHeightPx } from '../policy.mjs';

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
  if (paras.length > 1 && (t.paragraphSpacing || t.paragraphIndent)) {
    return html.map((h, i) => {
      const c = ['display:block'];
      if (i > 0 && t.paragraphSpacing) c.push(`margin-top:${px(t.paragraphSpacing)}`);
      if (t.paragraphIndent) c.push(`text-indent:${px(t.paragraphIndent)}`);
      return `<span style="${c.join(';')}">${h}</span>`;
    }).join('');
  }
  return html.join('<br>');
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

export function applyText({ node, s, css, warn }) {
  const t = node.text;
  const fill = node.fills?.filter((f) => f.type === 'SOLID').pop();
  const ty = typography(node);
  const grad = node.fills?.filter((f) => f.type === 'GRADIENT_LINEAR').pop();
  if (grad && !fill) {
    addCustomCss(s, `background-image: ${linearGradientCss(grad, node.box.w, node.box.h)}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;`);
  }
  // Figma keeps double spaces inside a text; HTML collapses them, which made "SMARTER,  SCALE" 11px narrower. Such text keeps its spaces.
  const keepsSpaces = /\S {2,}\S/.test(t.characters ?? ''); // inside the text only: Figma's box ignores a leading / trailing space ("WEBINAR " is 95px wide)
  if (t.autoResize === 'WIDTH_AND_HEIGHT') ty['white-space'] = keepsSpaces ? 'pre' : 'nowrap';
  else if (keepsSpaces) ty['white-space'] = 'pre-wrap';
  // A short label that Figma lays out on ONE line stays on one line: the browser measures text 1 to 2px wider than Figma and would wrap the last word into
  // a second line (Gifts mobile: a 192px tag became two lines and the section grew 40px). The number of lines is known from the Figma box height.
  else if (!ty['white-space'] && t.lineHeightPx && Math.round(node.box.h / lineHeightPx(t.lineHeightPx)) === 1 && (t.characters ?? '').length <= 48) ty['white-space'] = 'nowrap';
  s._typography = ty;
  s.text = textContent(t, fill ? cssColor(fill) : null, node.box);
  Object.assign(css, {
    'font-size': ty['font-size'], 'font-weight': ty['font-weight'], 'line-height': ty['line-height'], 'text-align': ty['text-align'],
    ...(fill && { color: cssColor(fill) }), ...(ty['letter-spacing'] && { 'letter-spacing': ty['letter-spacing'] }),
  });
  if (node.sizing.v === 'FIXED' && t.valign !== 'TOP') warn(node, `text vertical align ${t.valign} in a fixed-height box is not applied`);
  if (t.truncation) warn(node, 'text truncation not applied');
  if (node.fills?.filter((f) => f.type === 'SOLID').length > 1) warn(node, 'text with several fills: top one used');
}
