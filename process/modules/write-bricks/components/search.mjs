// A wide field with a placeholder, or a field plus a labeled submit.
// Bricks 1.12.3 element `search` (includes/elements/search.php).
// An empty actionURL posts to the WordPress home. A domain-checker address is not invented.
import { PartKind } from '../../recognize-parts/kinds.mjs';
import { addCustomCss, colorObj, px } from '../render/utils/css.mjs';
import { linearGradientCss } from '../render/utils/gradient.mjs';
import { typography } from '../render/text.mjs';
import { boxLook, findNode } from './helpers.mjs';

const solidFill = (node) => (node?.fills ?? []).find((fill) => fill.type === 'SOLID' && fill.hex);
const visibleText = (node) => (node?.children ?? []).find((child) => child.type === 'TEXT' && child.visible !== false && child.text);

function writeField(target, field, text, warn) {
  if (field?.box?.h) target.inputHeight = px(field.box.h);
  if (field?.box?.w) target.inputWidth = px(field.box.w);
  const ink = solidFill(text);
  if (ink) target.placeholderColor = colorObj({ hex: ink.hex, alpha: ink.alpha ?? 1 });
  if (text?.text) target.inputTypography = typography(text);
  const look = field ? boxLook(field, warn) : {};
  if (look.background) target.inputBackgroundColor = look.background;
  if (look.border) target.inputBorder = look.border;
}

function writeSubmit(target, button) {
  const label = visibleText(button);
  if (label?.text) target.iconTypography = typography(label);
  const fill = solidFill(button);
  if (fill) target.iconBackgroundColor = colorObj({ hex: fill.hex, alpha: fill.alpha ?? 1 });
  if (button.box?.h) target.iconHeight = px(button.box.h);
  const gradient = (button.fills ?? []).filter((fill) => fill.type === 'GRADIENT_LINEAR').pop();
  const radius = Array.isArray(button.radius) ? button.radius : null;
  const rules = ['border: 0; cursor: pointer;'];
  if (button.layout?.padding) {
    const pad = button.layout.padding;
    rules.push(`padding: ${px(pad.top)} ${px(pad.right)} ${px(pad.bottom)} ${px(pad.left)};`);
  }
  if (gradient?.handles && button.box) rules.push(`background-image: ${linearGradientCss(gradient, button.box.w, button.box.h)};`);
  if (radius) rules.push(`border-radius: ${px(radius[0])} ${px(radius[1])} ${px(radius[2])} ${px(radius[3])};`);
  addCustomCss(target, rules.join(' '), ' button');
}

export default {
  id: PartKind.SEARCH,
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
    const target = ctx.inner ?? ctx.s;
    const text = det.params.labelNode ? findNode(ctx.root, det.params.labelNode) : null;
    const field = det.params.fieldNode ? findNode(ctx.root, det.params.fieldNode) : ctx.node;
    const button = det.params.buttonNode ? findNode(ctx.root, det.params.buttonNode) : null;
    const address = det.params.actionURL;
    target.searchType = 'input';
    target.placeholder = det.params.placeholder;
    if (det.params.buttonText) target.buttonText = det.params.buttonText;
    if (typeof address === 'string' && /^https?:\/\//i.test(address)) target.actionURL = address;
    writeField(target, field, text, ctx.warn);
    if (button) writeSubmit(target, button);
  },
};
