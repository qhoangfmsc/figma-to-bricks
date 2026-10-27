// COMPONENT countdown: a row of time units (number over a label) separated by a colon, e.g. "20 : 00 : 00 : 00" over "Ngày Giờ Phút Giây".
// Bricks 1.9.8: `countdown` element (date, timezone, fields repeater, typography per part). The script builds
//   <div .brxe-countdown> <div .field> <span .prefix/> <span .format/> <span .suffix/> </div> … </div>   (a column per field, centered).
//   source: includes/elements/countdown.php, assets/js/bricks.min.js (bricksCountdown), assets/css/frontend.min.css (.brxe-countdown .field)
// The Figma frame is the countdown element; each unit becomes a field: number = `format` (%D %H %M %S, uppercase pads to 2 digits), label =
// `suffix`. The Figma unit box (size, gap) goes on `.field`, the gap between two boxes is the field margin. The separator between units
// has no place in the element: it is drawn by `.field:not(:last-child)::after` at the Figma offset (left / top) with the separator's typography.
// params: fields [{ node, format }] (required: which unit frame is days / hours / minutes / seconds)
//         date ("YYYY-MM-DD HH:mm", the moment the countdown reaches zero) · timezone ("UTC+07:00")  -- Figma only shows placeholder numbers,
//         so these come from the owner / designer; without a date Bricks renders a "No date/fields set" placeholder (warned)
//         separator (optional node id of a separator TEXT; default: the TEXT children between the units)
// Not applicable (stays a block, warned): units that are not "one number text + one label text", different typography or box between units,
//   separators that differ from each other.  After the date Bricks keeps counting down to the "Date reached" action (default: zeros).
import { typography } from '../render/text.mjs';
import { addCustomCss, cssColor, px } from '../render/utils/css.mjs';
import { findNode, rowId, visibleKids } from './helpers.mjs';
import { lineHeightPx } from '../policy.mjs';

const FORMAT = /^%[DHMSdhms]$/;
const DATE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const TZ = /^UTC[+-]\d{2}:\d{2}$/;

const texts = (unit) => visibleKids(unit).filter((c) => c.type === 'TEXT' && !c.svg);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// -> { units: [{ node, number, label, format }], seps: [TEXT] } or { error }
function parts(node, det) {
  const kids = visibleKids(node);
  const fields = det.params?.fields ?? [];
  if (!node.layout || node.layout.mode !== 'HORIZONTAL') return { error: 'the frame must be a horizontal auto layout' };
  if (fields.length < 2) return { error: 'params.fields needs at least 2 units ({ node, format })' };
  const units = [];
  for (const f of fields) {
    const n = findNode(node, f.node);
    if (!n || !kids.includes(n)) return { error: `unit ${f.node} is not a visible child of the frame` };
    if (!FORMAT.test(f.format ?? '')) return { error: `unit ${f.node}: format must be one of %D %H %M %S (got ${JSON.stringify(f.format)})` };
    const t = texts(n);
    if (t.length !== 2 || visibleKids(n).length !== 2) return { error: `unit "${n.name}" (${n.id}) must hold exactly a number text and a label text` };
    units.push({ node: n, number: t[0], label: t[1], format: f.format });
  }
  const sepIds = det.params?.separator ? [det.params.separator] : kids.filter((k) => !units.some((u) => u.node === k)).map((k) => k.id);
  const seps = sepIds.map((id) => findNode(node, id));
  if (seps.some((s) => !s || s.type !== 'TEXT')) return { error: 'between the units only separator TEXT nodes are supported' };
  if (seps.length !== units.length - 1) return { error: `${units.length} units need ${units.length - 1} separators, found ${seps.length}` };
  const u0 = units[0];
  for (const u of units) {
    if (!same(typography(u.number), typography(u0.number)) || !same(typography(u.label), typography(u0.label))) return { error: 'units have different typography' };
    if (u.node.box.w !== u0.node.box.w || u.node.box.h !== u0.node.box.h) return { error: 'units have different sizes' };
  }
  for (const s of seps) if (!same(typography(s), typography(seps[0])) || s.text.characters !== seps[0].text.characters) return { error: 'separators differ from each other' };
  const gaps = units.slice(1).map((u, i) => u.node.box.x - (units[i].node.box.x + units[i].node.box.w));
  if (gaps.some((g) => g !== gaps[0])) return { error: 'the space between units is not constant' };
  return { units, seps, gap: gaps[0] };
}

export default {
  id: 'countdown',
  status: 'implemented',
  label: 'Countdown',
  figma: 'a horizontal row of time units (number above a label) separated by a colon text',
  bricks: '`countdown` element: fields (format + label as suffix), date, timezone, typography of number and label; separator drawn with ::after',
  limits: 'the target date / time zone are not in Figma (params); separator and unit boxes are css on .field; the "Date reached" action is the Bricks default',
  mergesChildren: true,
  kind: () => 'countdown',

  check(node, det) {
    const p = parts(node, det);
    if (p.error) return { ok: false, reason: p.error };
    const w = [];
    const { date, timezone } = det.params;
    if (!date) w.push('no target date: Bricks shows "No date/fields set" until params.date is filled (designer list)');
    else if (!DATE.test(date)) return { ok: false, reason: `params.date must look like "2026-10-29 19:30" (got ${JSON.stringify(date)})` };
    if (timezone && !TZ.test(timezone)) return { ok: false, reason: `params.timezone must look like "UTC+07:00" (got ${JSON.stringify(timezone)})` };
    if (!timezone) w.push('no time zone: Bricks counts in UTC+00:00 (designer list)');
    return { ok: true, warnings: w };
  },

  apply({ node, s, css }, det) {
    const { units, seps, gap } = parts(node, det);
    const u0 = units[0];
    const sep = seps[0];
    const ty = typography(u0.number);
    if (det.params.date) s.date = det.params.date;
    if (det.params.timezone) s.timezone = det.params.timezone;
    s.fields = units.map((u, i) => ({ id: rowId(det.id, i), format: u.format, suffix: u.label.text.characters }));
    s.typography = ty;
    s.typographySuffix = typography(u0.label);
    s.gutter = { top: '0px', right: px(gap), bottom: '0px', left: '0px' };
    for (const k of ['_display', '_direction', '_rowGap', '_columnGap', '_justifyContent', '_alignItems', '_flexWrap']) delete s[k];
    for (const k of ['column-gap', 'row-gap']) delete css[k];
    // the countdown element has no overflow control (Bricks leaves `_overflow` out of its output): the Figma clip goes to css
    if (s._overflow) { addCustomCss(s, `overflow: ${s._overflow};`); delete s._overflow; }
    const u = u0.node;
    const st = sep.text;
    const fill = sep.fills?.filter((f) => f.type === 'SOLID').pop();
    // .field = the Figma unit frame (fixed box, centered column with the Figma gap; content may overflow it like in Figma)
    addCustomCss(s, `position: relative; flex-shrink: 0; width: ${px(u.box.w)}; height: ${px(u.box.h)}; row-gap: ${px(u.layout.gap)};`, ' .field');
    addCustomCss(s, 'margin-right: 0;', ' .field:last-child');
    addCustomCss(s, `width: ${px(u0.number.box.w)};`, ' .format');
    addCustomCss(s, `width: ${px(u0.label.box.w)};`, ' .suffix');
    addCustomCss(s, [
      `content: ${JSON.stringify(st.characters)}; position: absolute; left: ${px(sep.box.x - u.box.x)}; top: ${px(sep.box.y - u.box.y)};`,
      `white-space: nowrap; font-family: ${st.fontFamily}; font-size: ${px(st.fontSize)}; font-weight: ${st.fontWeight}; line-height: ${px(lineHeightPx(st.lineHeightPx))};`,
      fill ? `color: ${cssColor(fill)};` : '',
    ].join(' '), ' .field:not(:last-child)::after');
  },
};
