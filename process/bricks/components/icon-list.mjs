// COMPONENT icon-list: a vertical list of rows, each = an icon (svg) + a text, drawn as nested frames in Figma (checklists, reason lists).
// Bricks 1.9.8: `list` element (ul > li > .content > .icon + .title). Items live in the `items` repeater (title + icon), the look comes from
//   itemTitle typography (titleTypography), icon margin and the container's gap (flex column, written by the normal layout rule).
//   source: includes/elements/list.php (items, titleTypography, titleMargin, separatorDisable), assets/css/frontend.min.css (.brxe-list)
// The theme draws a separator line after every title and gives .title a 10px right margin: both are switched off explicitly.
// params: items (optional node ids; default = every visible child) · separator (optional node id of a divider line drawn between rows: its stroke
//         becomes a bottom border on each row but the last, gradient strokes via border-image).  Each item needs one text, an icon is optional (svg).
import { typography } from '../render/text.mjs';
import { addCustomCss, cssColor, px } from '../render/utils/css.mjs';
import { linearGradientCss } from '../render/utils/gradient.mjs';
import { findNode, firstText, rowId, svgIcon, svgNode, visibleKids } from './helpers.mjs';

const itemsOf = (node, det) => (det.params?.items?.length ? det.params.items.map((id) => findNode(node, id)).filter(Boolean) : visibleKids(node));

// the frame that directly holds the icon next to the text (its layout gap is the icon-title gap)
function rowOf(item) {
  const kids = visibleKids(item);
  if (kids.some((k) => svgNode(k)) && kids.some((k) => firstText(k))) return item;
  for (const k of kids) { const r = rowOf(k); if (r) return r; }
  return null;
}

export default {
  id: 'icon-list',
  status: 'implemented',
  label: 'Icon list',
  figma: 'a vertical container whose children are rows of one icon + one text',
  bricks: '`list` element: items repeater (title + svg icon), title typography, icon gap, row gap from the auto layout',
  limits: 'one text per row (extra texts are not kept: not applicable); icons are the Figma svg files; the separator line is off',
  mergesChildren: true,
  kind: () => 'list',

  check(node, det) {
    const items = itemsOf(node, det);
    if (items.length < 1) return { ok: false, reason: 'needs at least 1 row' };
    for (const it of items) {
      const t = firstText(it);
      if (!t) return { ok: false, reason: `row "${it.name}" (${it.id}) has no text` };
      if (t.text?.runs?.length > 1) return { ok: false, reason: `row "${it.name}" has a mixed-style text, not supported in a list item` };
    }
    const withIcon = items.filter((i) => svgNode(i)).length;
    return { ok: true, warnings: withIcon && withIcon < items.length ? [`${items.length - withIcon} of ${items.length} rows have no icon`] : [] };
  },

  apply({ node, s, warn }, det) {
    const items = itemsOf(node, det);
    s.items = items.map((it, i) => {
      const icon = svgNode(it);
      return { id: rowId(det.id, i), title: firstText(it).text.characters, ...(icon && { icon: svgIcon(icon) }) };
    });
    s.separatorDisable = true;
    s.titleTypography = typography(firstText(items[0]));
    s.titleMargin = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
    // the Bricks list element has no flex / gap controls: layout is written as css (Figma auto layout: column + gap)
    for (const k of ['_display', '_direction', '_rowGap', '_columnGap', '_justifyContent', '_alignItems', '_flexWrap']) delete s[k];
    addCustomCss(s, `display: flex; flex-direction: column; row-gap: ${px(node.layout?.gap ?? 0)};`);
    const row = rowOf(items[0]);
    if (row?.layout) addCustomCss(s, `margin-right: ${px(row.layout.gap)};`, ' li .icon');
    const sepNode = det.params?.separator && findNode(node, det.params.separator);
    if (sepNode?.stroke) {
      const w = sepNode.stroke.weight ?? 1;
      const paint = sepNode.stroke.paints.at(-1);
      if (paint.type === 'SOLID') addCustomCss(s, `border-bottom: ${px(w)} solid ${cssColor(paint)}; padding-bottom: ${px(node.layout?.gap ?? 0)};`, ' li:not(:last-child)');
      else if (paint.type === 'GRADIENT_LINEAR') addCustomCss(s, `border-bottom: ${px(w)} solid transparent; border-image: ${linearGradientCss(paint, sepNode.box.w || 1, 1)} 1; padding-bottom: ${px(node.layout?.gap ?? 0)};`, ' li:not(:last-child)');
      else warn(sepNode, `separator stroke ${paint.type} is not supported`);
    }
    return { merged: [] };
  },
};
