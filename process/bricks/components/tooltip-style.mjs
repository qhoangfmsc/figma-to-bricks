// COMPONENT tooltip-style: the tooltip BUBBLE drawn once in Figma ("Tooltip" instance) is the look of every tooltip on the page.
// Bricks 1.9.8 has no tooltip element: the data-balloon tooltips are styled by the theme CSS and the variables
// --bricks-tooltip-bg / --bricks-tooltip-text (assets/css/libs/tooltips.min.css). This component writes the Figma look as CSS on the template
// root (descendant selectors), so it applies to every tooltip trigger inside the template. The bubble node itself is NOT built.
// Used values (all from the node): fill, corner radius, padding, text color / font / size / weight / line-height, drop shadow, max-width.
// Not reproduced (reported): the caret is a rotated square in Figma, the theme draws a 4px border triangle in the bubble color.
// params: none.  The detection's node is the bubble.
import { lineHeightPx } from '../policy.mjs';
import { cssColor, px } from '../render/utils/css.mjs';
import { firstText } from './helpers.mjs';

export default {
  id: 'tooltip-style',
  status: 'implemented',
  label: 'Tooltip look',
  figma: 'a tooltip bubble drawn on its own (fill, radius, padding, one text, shadow)',
  bricks: 'CSS on the template root: --bricks-tooltip-bg / --bricks-tooltip-text and `[data-balloon]:after` (radius, padding, font, shadow, max-width)',
  limits: 'the caret shape follows the theme (4px triangle), not the rotated square of Figma; position is the Bricks default (top)',

  mergedNodes: (det, node) => [node.id],

  check(node) {
    const fill = node.fills?.find((f) => f.type === 'SOLID');
    const t = firstText(node);
    if (!fill || !t) return { ok: false, reason: 'the bubble needs a solid fill and a text' };
    return { ok: true, warnings: ['tooltip caret: Figma draws a rotated square, the theme draws a triangle in the bubble color (approximation)'] };
  },

  descendants(node, det, { root }) {
    const fill = node.fills.find((f) => f.type === 'SOLID');
    const t = firstText(node);
    const ty = t.text;
    const tf = t.fills?.find((f) => f.type === 'SOLID');
    const shadow = (node.effects ?? []).find((e) => e.type === 'DROP_SHADOW');
    const p = node.layout?.padding;
    const after = [
      node.radius ? `border-radius: ${node.radius.map(px).join(' ')};` : '',
      p ? `padding: ${px(p.top)} ${px(p.right)} ${px(p.bottom)} ${px(p.left)};` : '',
      `font-family: ${ty.fontFamily}; font-size: ${px(ty.fontSize)}; font-weight: ${ty.fontWeight}; line-height: ${px(lineHeightPx(ty.lineHeightPx))};`,
      shadow ? `box-shadow: ${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${cssColor(shadow)};` : '',
      node.limits?.maxWidth ? `max-width: ${px(node.limits.maxWidth)}; width: max-content; white-space: normal;` : '',
      'text-align: left;',
    ].filter(Boolean).join(' ');
    return {
      [root.id]: { css: [
        { decl: `--bricks-tooltip-bg: ${cssColor(fill)};${tf ? ` --bricks-tooltip-text: ${cssColor(tf)};` : ''}`, suffix: '' },
        { decl: after, suffix: ' [data-balloon]:after' },
      ] },
    };
  },
};
