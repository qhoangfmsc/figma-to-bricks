// COMPONENT button: a frame/instance whose only visible child is its label.
// Bricks 1.9.8: `button` element (text, tag, link). The frame's own look (fill, stroke, radius, shadow, padding, size) goes on the
// button, the label's typography goes into its `_typography`, and the label node is merged (not built as a child).
//   source: wp-content/themes/bricks/includes/elements/button.php (render: `.bricks-button` + text)
// The theme gives `.bricks-button` defaults (padding .5em 1em, letter-spacing .5px, gap 10px): they are overridden explicitly
// (found by running verify on a real section: the first version left gap at 10px).
// An icon child (one svg, before or after the label) becomes the button's own icon (`icon` svg, `iconPosition`, `iconGap`).
// params: link (url -> the button becomes an <a>; missing -> '#', reported) · tag (optional html tag, default span)
// Not applicable (kept as block, with a warning): more than one icon or other children, no label, mixed-style label.
import { applyText } from '../render/text.mjs';
import { addCustomCss, px } from '../render/utils/css.mjs';
import { addHoverFade } from '../render/utils/interactions.mjs';
import { linkSetting, svgIcon, svgNode, MISSING_URL } from './helpers.mjs';

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
    return { ok: true, warnings: det?.params?.link ? [] : [`no URL in Figma: the button link is written as "${MISSING_URL}" (designer list)`] };
  },

  // runs after size/layout/style of the frame itself; `ctx` is the frame's ctx
  apply(ctx, det) {
    const { node, s, css, warn } = ctx;
    const text = label(node);
    applyText({ node: text, s, css, warn });
    s._typography['letter-spacing'] ??= '0px'; // theme default is .5px
    s._padding ??= { top: '0px', right: '0px', bottom: '0px', left: '0px' }; // theme default is .5em 1em
    if (!node.interactions?.some((i) => i.trigger === 'ON_HOVER')) addHoverFade(s); // owner default; a drawn hover was already handled with the frame's style
    if (det.params?.tag) s.tag = det.params.tag;
    s.link = linkSetting(det.params?.link);
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
