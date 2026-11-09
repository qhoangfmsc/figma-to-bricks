// COMPONENT button: a frame/instance whose only visible child is its label.
// Bricks 1.9.8: `button` element (text, tag, link). The frame's own look (fill, stroke, radius, shadow, padding, size) goes on the
// button, the label's typography goes into its `_typography`, and the label node is merged (not built as a child).
//   source: wp-content/themes/bricks/includes/elements/button.php (render: `.bricks-button` + text)
// The theme gives `.bricks-button` defaults (padding .5em 1em, letter-spacing .5px, gap 10px): they are overridden explicitly
// (found by running verify on a real section: the first version left gap at 10px).
// An icon child (one svg, before or after the label) becomes the button's own icon (`icon` svg, `iconPosition`, `iconGap`).
// params: link (url -> the button becomes an <a>; missing -> '#', reported) · tag (optional html tag, default span)
// Not applicable (kept as block, with a warning): more than one icon or other children, no label, mixed-style label.
import { applyText } from '../../write-bricks/render/text.mjs';
import { addCustomCss, px } from '../../write-bricks/render/utils/css.mjs';
import { addHoverFade } from '../../write-bricks/render/utils/interactions.mjs';
import { linkSetting, rowId, svgIcon, svgNode, MISSING_URL } from '../../write-bricks/components/helpers.mjs';
import { layoutOnlyReason } from '../../recognize-parts/rules/layout-only.mjs';

// A button is one of four Bricks controls. The label decides. A URL is never invented.
//   link    an <a>. No address yet → "#", and the plan is asked.
//   close   a <button> that closes the popup (the X, "Đóng", "Hủy").
//   action  a <button> that confirms and closes ("Xác nhận", "Lưu", "Chấp nhận"). Not a page link.
//   search  the submit of a search form. That button is built by the search element, not here.
export function buttonRole(text) {
  const t = String(text ?? '').trim();
  if (/^(đóng|dong|close|hủy|huy|cancel|×|✕|✖|x)$/i.test(t)) return 'close';
  if (/chấp nhận|chap nhan|xác nhận|xac nhan|\blưu\b|\bluu\b|\bsave\b|đồng ý|dong y|\bapply\b|chỉ cookie|chi cookie|cookie cần thiết|cookie can thiet/i.test(t)) return 'action';
  return 'link';
}

export function resolvedRole(text, stored) {
  const fromLabel = buttonRole(text);
  if (fromLabel !== 'link') return fromLabel;
  return stored || 'link';
}

const visibleChildren = (node) => (node.children ?? []).filter((c) => c.visible !== false);
const label = (node) => visibleChildren(node).find((c) => c.type === 'TEXT' && !c.svg);
const iconOf = (node) => visibleChildren(node).find((c) => c !== label(node) && svgNode(c));

export default {
  id: 'button',
  status: 'implemented',
  label: 'Button',
  figma: 'frame / instance whose visible children are its text label and at most one svg icon',
  bricks: '`button` element: text, typography from the label, look from the frame',
  limits: 'one icon max (svg file, Figma colors); the link is `#` when Figma has none; hover / state variants are not in the Figma tree',
  mergesChildren: true,
  kind: () => 'button',

  check(node, det) {
    const kids = visibleChildren(node);
    const icons = kids.filter((c) => c !== label(node) && svgNode(c));
    if (!label(node) || kids.length !== 1 + icons.length || icons.length > 1) return { ok: false, reason: `needs one visible text child and at most one svg icon, found ${kids.map((k) => `${k.type} "${k.name}"`).join(', ') || 'none'}` };
    if (label(node).text?.runs?.length > 1) return { ok: false, reason: 'label has mixed styles, not supported in a button yet' };
    const role = resolvedRole(label(node).text?.characters, det?.params?.role);
    if (role !== 'link' || det?.params?.link || det?.params?.popupId) return { ok: true, warnings: [] };
    return { ok: true, warnings: [`no URL in Figma: the button link is written as "${MISSING_URL}" (designer list)`] };
  },

  // runs after size/layout/style of the frame itself; `ctx` is the frame's ctx
  apply(ctx, det) {
    const { node, s, css, warn } = ctx;
    const text = label(node);
    applyText({ node: text, s, css, warn });
    s._typography['letter-spacing'] ??= '0px'; // theme default is .5px
    s._padding ??= { top: '0px', right: '0px', bottom: '0px', left: '0px' }; // theme default is .5em 1em
    if (!node.interactions?.some((i) => i.trigger === 'ON_HOVER')) addHoverFade(s); // owner default; a drawn hover was already handled with the frame's style
    const role = layoutOnlyReason(node, ctx.root) ? 'layout' : resolvedRole(text?.text?.characters, det.params?.role);
    if (role === 'layout') {
      // Look only. Domain search and a price table are wired in vietnix-center.
    } else if (det.params?.popupId) {
      const id = String(det.params.popupId);
      s.tag = 'button';
      s._interactions = [{ id: rowId(node.id, 'pop'), trigger: 'click', action: 'show', target: 'popup', templateId: id }];
      s._attributes = [...(s._attributes ?? []), { name: 'data-f2b-open', value: id }];
    } else if (role === 'close' || role === 'action') {
      s.tag = 'button';
      // On a popup, confirm and close dismiss that popup. On a section, confirm hides the section
      // (a cookie bar). A page link is never invented for either.
      if (role === 'action' && !ctx.popup) {
        s._interactions = [{ id: rowId(node.id, 'hide'), trigger: 'click', action: 'hide', target: 'custom', targetSelector: '[data-f2b-dismiss]' }];
      } else {
        s._attributes = [...(s._attributes ?? []), { name: 'data-f2b-close', value: '1' }];
      }
    } else {
      if (det.params?.tag) s.tag = det.params.tag;
      s.link = linkSetting(det.params?.link);
    }
    // Theme Styles paint `.bricks-button` that has no `bricks-background-*` class. A button Figma drew with no fill must stay clear.
    if (!(node.fills ?? []).some((f) => f.visible !== false && f.type && f.type !== 'IMAGE')) {
      s._background = { color: { raw: 'transparent' } };
      addCustomCss(s, 'background-color: transparent;');
    }
    if (role !== 'layout') s._cursor = 'pointer';
    const icon = iconOf(node);
    // gap: the Bricks attribute `iconGap` exists only with an icon (control `required: icon`). Without an icon Bricks has no gap control for the button and the theme
    // writes `gap: 10px` on .bricks-button, so the Figma value (e.g. 0) can only be written as css
    if (!icon && node.layout && node.layout.primaryAlign !== 'SPACE_BETWEEN') addCustomCss(s, `column-gap: ${px(node.layout.gap)}; row-gap: ${px(node.layout.gap)};`);
    if (icon) {
      s.icon = svgIcon(svgNode(icon));
      s.iconPosition = visibleChildren(node).indexOf(icon) < visibleChildren(node).indexOf(text) ? 'left' : 'right';
      if (node.layout) s.iconGap = px(node.layout.gap);
    }
    return { merged: [text.id] };
  },
};
