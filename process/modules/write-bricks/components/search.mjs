// A wide field with a placeholder, or a field plus a labeled submit ("Tìm Kiếm").
// Bricks 1.12.3 element `search` (includes/elements/search.php, searchform.php).
// The submit is <button type="submit">. actionURL stays empty unless the plan has an address:
// an empty actionURL posts to the WordPress home URL. A domain-checker address is not invented.
import { addCustomCss, colorObj, px } from '../render/utils/css.mjs';
import { linearGradientCss } from '../render/utils/gradient.mjs';
import { typography } from '../render/text.mjs';
import { boxLook, findNode } from './helpers.mjs';

export default {
  id: 'search',
  status: 'implemented',
  label: 'Search',
  figma: 'a horizontal field at least four times as wide as it is tall, with one text and one small icon (`rules/media.mjs`)',
  bricks: '`search`. Placeholder is the Figma text. Height and width are the field box. The form posts to the WordPress home URL',
  limits: 'The icon drawn in Figma is not copied onto the search button. A field inside a form stays part of that form',
  mergesChildren: true,
  kind: () => 'search',

  check(node, det) {
    if (!det.params?.placeholder) return { ok: false, reason: 'params.placeholder is empty' };
    return { ok: true, warnings: [] };
  },

  apply(ctx, det) {
    const { inner: t, s, root, warn } = ctx;
    const target = t ?? s;
    const text = det.params.labelNode ? findNode(root, det.params.labelNode) : null;
    const field = det.params.fieldNode ? findNode(root, det.params.fieldNode) : ctx.node;
    const button = det.params.buttonNode ? findNode(root, det.params.buttonNode) : null;
    target.searchType = 'input';
    target.placeholder = det.params.placeholder;
    if (det.params.buttonText) target.buttonText = det.params.buttonText;
    const address = det.params.actionURL;
    if (typeof address === 'string' && /^https?:\/\//i.test(address)) target.actionURL = address;
    if (field?.box?.h) target.inputHeight = px(field.box.h);
    if (field?.box?.w) target.inputWidth = px(field.box.w);
    const fill = text?.fills?.find((f) => f.type === 'SOLID' && f.hex);
    if (fill) target.placeholderColor = colorObj({ hex: fill.hex, alpha: fill.alpha ?? 1 });
    if (text?.text) target.inputTypography = typography(text);
    const look = field ? boxLook(field, warn) : {};
    if (look.background) target.inputBackgroundColor = look.background;
    if (look.border) target.inputBorder = look.border;
    if (!button) return;
    const btnText = (button.children ?? []).find((c) => c.type === 'TEXT' && c.visible !== false && c.text);
    if (btnText?.text) target.iconTypography = typography(btnText);
    const solid = (button.fills ?? []).find((f) => f.type === 'SOLID' && f.hex);
    if (solid) target.iconBackgroundColor = colorObj({ hex: solid.hex, alpha: solid.alpha ?? 1 });
    if (button.box?.h) target.iconHeight = px(button.box.h);
    const grad = (button.fills ?? []).filter((f) => f.type === 'GRADIENT_LINEAR').pop();
    const decls = ['border: 0; cursor: pointer;'];
    if (button.layout?.padding) {
      const p = button.layout.padding;
      decls.push(`padding: ${px(p.top)} ${px(p.right)} ${px(p.bottom)} ${px(p.left)};`);
    }
    if (grad?.handles && button.box) decls.push(`background-image: ${linearGradientCss(grad, button.box.w, button.box.h)};`);
    const radius = Array.isArray(button.radius) ? button.radius : null;
    if (radius) decls.push(`border-radius: ${px(radius[0])} ${px(radius[1])} ${px(radius[2])} ${px(radius[3])};`);
    addCustomCss(target, decls.join(' '), ' button');
  },
};
