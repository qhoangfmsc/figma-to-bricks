// Figma LAYER_BLUR / BACKGROUND_BLUR.
// LAYER_BLUR blurs the element itself. BACKGROUND_BLUR blurs what is behind it.
// Figma's blur radius is twice the CSS blur() length (checked against a rendered glow).
import { addCustomCss, px } from '../../../write-bricks/render/utils/css.mjs';

export const isBlur = (e) => e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR';

export function applyBlur({ node, s, css }) {
  const layer = (node.effects ?? []).filter((e) => e.type === 'LAYER_BLUR' && e.radius > 0);
  const back = (node.effects ?? []).filter((e) => e.type === 'BACKGROUND_BLUR' && e.radius > 0);
  if (layer.length) {
    const value = `blur(${px(layer[layer.length - 1].radius / 2)})`;
    addCustomCss(s, `filter: ${value};`);
    if (css) css.filter = value;
  }
  if (back.length) {
    const value = `blur(${px(back[back.length - 1].radius / 2)})`;
    addCustomCss(s, `backdrop-filter: ${value};`);
    if (css) css['backdrop-filter'] = value;
  }
}
