// COMPONENT form: a container holding labeled inputs and a submit button, drawn as plain frames in Figma.
// Bricks 1.9.8: `form` element with `fields` (repeater) and submit button settings.
//   source: includes/elements/form.php (fields, showLabels, requiredAsterisk, labelTypography, placeholderTypography, fieldPadding, fieldBorder,
//           fieldBackgroundColor, fieldTypography, submitButton*), assets/css/frontend.min.css (.brxe-form: .form-group padding-bottom 20px,
//           label 12px uppercase 600 letter-spacing .4px: all overridden explicitly, found by comparing with Figma)
// WRAPPING: the block keeps the Figma frame (its size, layout, fill), the `form` element sits inside it, and the frame's children that are NOT
//   fields / submit (a note under the button…) are still built after it. Fields and submit frames are merged into the form element.
// The fields are NOT guessed from names: the AI pass (with citations) or the owner lists them in params.fields, each pointing at the
// input frame drawn in Figma. Look values come from the drawn frames:
//   every field  height (input) / textarea height, padding, fill, border + radius, text typography (first field = look of all)
//   labels       typography (case / letter-spacing forced to the Figma value, the theme uppercases), gap label -> input, required asterisk color
//   fields gap   the gap between the field frames (the theme's padding-bottom is replaced)
//   submit       text + typography, fill (solid -> Bricks control, gradient -> CSS), border + radius, padding, width, height
// params: fields [{ node (input frame id), type (text|email|tel|textarea|select|checkbox…, default text), label, placeholder, required, labelNode (text node id) }]
//         fields[].error (the Figma error text of that field, written by process/decide from "Error message / X") · errorStyle (its look + gap)
//         submit (node id of the submit button frame) · settings (optional object, raw Bricks settings deep-merged on top)
// Not in Figma, so not built: what the form DOES (action / recipient / success message): Bricks default (email) stays, listed as missing.
import { addCustomCss, cssColor, px } from '../render/utils/css.mjs';
import { linearGradientCss } from '../render/utils/gradient.mjs';
import { deepMerge } from '../render/utils/merge.mjs';
import { typography } from '../render/text.mjs';
import { boxLook, findNode, firstText, jsonParam, rowId, svgIcon, svgNode, visibleKids } from './helpers.mjs';
import { lineHeightFor } from '../render/text.mjs';

const contains = (n, id) => n.id === id || (n.children ?? []).some((c) => contains(c, id));
const parentOf = (root, id) => (root.children ?? []).reduce((f, c) => f ?? (c.id === id ? root : parentOf(c, id)), null);

export default {
  id: 'form',
  status: 'implemented',
  label: 'Form',
  figma: 'a container with labeled input frames and a submit button frame (listed in params.fields / params.submit with citations)',
  bricks: 'a block (the Figma frame) holding a `form` element: fields repeater + field / label / submit look from the drawn frames; other children kept after it',
  limits: 'form action / recipient / success message are not in Figma (Bricks defaults); an error message exists only for the fields the designer drew an error frame for (params.fields[].error, from "Error message / X"); select / checkbox looks are not read; only the first field is read for the look of all',
  mergesChildren: true,
  wrap: true,
  innerKind: 'form',
  kind: () => 'block',

  // children that hold no field, label or submit (a note under the button) stay built
  keepNodes(node, det) {
    const ids = [...(jsonParam(det.params?.fields) ?? []).flatMap((f) => [f.node, f.labelNode]), det.params?.submit].filter(Boolean);
    return visibleKids(node).filter((c) => !ids.some((id) => contains(c, id))).map((c) => c.id);
  },

  check(node, det, { root }) {
    const fields = jsonParam(det.params?.fields);
    if (!Array.isArray(fields) || !fields.length) return { ok: false, reason: 'params.fields is empty: list the input frames [{ node, type, label, placeholder }] (the AI pass proposes them with citations)' };
    for (const [i, f] of fields.entries()) if (!f.node || !findNode(root, f.node)) return { ok: false, reason: `params.fields[${i}].node ${f.node} is not in the tree` };
    if (!det.params?.submit || !findNode(root, det.params.submit)) return { ok: false, reason: 'params.submit must be the node id of the submit button frame' };
    return { ok: true, warnings: [`${fields.length} field(s): form action / recipient / success message are not in Figma, Bricks defaults stay`] };
  },

  apply({ node, inner: t, root, warn }, det) {
    const fields = jsonParam(det.params.fields);
    t.fields = fields.map((f, i) => ({
      id: rowId(det.id, i),
      type: f.type ?? 'text',
      // a checkbox keeps its statement as the option text (Bricks: `options`), a text field its label above the input
      ...(f.label && f.type !== 'checkbox' && { label: f.label }),
      ...(f.type === 'checkbox' && f.label && { options: f.label }),
      ...(f.placeholder && { placeholder: f.placeholder }),
      ...(f.required && { required: true }),
      // the text the designer drew under the field in its error state (Bricks shows it after a failed check of a required / email field)
      ...(f.error && { errorMessage: f.error }),
    }));
    if (fields.some((f) => f.label && f.type !== 'checkbox')) t.showLabels = true;
    // Bricks writes " *" after a required label / placeholder: only when the Figma texts do not already carry the asterisk themselves
    if (fields.some((f) => f.required && !/\*/.test(f.placeholder ?? f.label ?? ''))) t.requiredAsterisk = true;

    // ---- fields ----
    const frames = fields.map((f) => findNode(root, f.node));
    const first = frames[0];
    const look = boxLook(first, warn);
    if (look.background) t.fieldBackgroundColor = look.background;
    if (look.border) t.fieldBorder = look.border;
    if (look.padding) t.fieldPadding = look.padding;
    const inText = firstText(first);
    if (inText) { t.placeholderTypography = typography(inText); t.fieldTypography = typography(inText); }
    addCustomCss(t, `height: ${px(first.box.h)}; box-sizing: border-box;`, ' .form-group input:not([type=checkbox])');
    if (inText) addCustomCss(t, `line-height: ${px(lineHeightFor(inText))}; resize: none;`, ' .form-group textarea');
    frames.forEach((fr, i) => {
      if (fields[i].type === 'textarea') addCustomCss(t, `height: ${px(fr.box.h)}; min-height: ${px(fr.box.h)}; box-sizing: border-box; ${look.padding ? `padding: ${look.padding.top} ${look.padding.right} ${look.padding.bottom} ${look.padding.left};` : ''}`, ' .form-group textarea');
    });

    // ---- error message look (Bricks default: danger background, 15px padding): the drawn "Error message" text, gap = the gap under the drawn field ----
    const es = det.params?.errorStyle;
    if (es && fields.some((f) => f.error)) {
      const decls = ['background-color: transparent;', 'padding: 0;', `margin-top: ${px(es.gap)};`];
      if (es.color) decls.push(`color: ${cssColor({ hex: es.color, alpha: es.alpha ?? 1 })};`);
      if (es.fontFamily) decls.push(`font-family: ${es.fontFamily};`);
      if (es.fontSize) decls.push(`font-size: ${px(es.fontSize)};`);
      if (es.fontWeight) decls.push(`font-weight: ${es.fontWeight};`);
      if (es.lineHeightPx) decls.push(`line-height: ${px(es.lineHeightPx)};`);
      decls.push(`letter-spacing: ${px(es.letterSpacing ?? 0)};`);
      addCustomCss(t, decls.join(' '), ' .form-group .form-group-error-message');
    }

    // ---- gap between the field frames (the theme uses padding-bottom: 20px) ----
    const fieldGap = node.layout?.gap ?? 0; // the form frame stacks the field frames, the submit and the note with this gap
    addCustomCss(t, `padding: 0 0 ${px(fieldGap)};`, ' .form-group');
    addCustomCss(t, 'padding-bottom: 0;', ' .form-group:last-child');

    // ---- labels ----
    const labelNode = fields.map((f) => f.labelNode && findNode(root, f.labelNode)).find(Boolean);
    if (labelNode?.text) {
      const lt = typography(labelNode);
      lt['text-transform'] ??= 'none'; // the theme uppercases labels
      lt['letter-spacing'] ??= '0px'; // ... and spaces them by .4px
      t.labelTypography = lt;
      // gap label -> input = the gap of the frame that holds both (the "Text input" frame)
      let holder = parentOf(root, labelNode.id);
      while (holder && !contains(holder, fields[0].node)) holder = parentOf(root, holder.id);
      if (holder?.layout && holder.id !== node.id) addCustomCss(t, `margin-bottom: ${px(holder.layout.gap)};`, ' .form-group > .label');
      // required asterisk: the "*" text drawn next to the label
      const star = (parentOf(root, labelNode.id)?.children ?? []).find((c) => c.type === 'TEXT' && c.text?.characters?.trim() === '*');
      const starFill = star?.fills?.find((f) => f.type === 'SOLID');
      if (starFill) addCustomCss(t, `color: ${cssColor(starFill)};`, ' .required:after');
    }

    // ---- checkbox (the consent row): box, border, radius from the drawn checkbox; the statement sits next to it with the Figma gap ----
    const boxField = fields.find((f) => f.type === 'checkbox');
    if (boxField) {
      const row = findNode(root, boxField.node);
      const find = (n) => (/check\s?box/i.test(n.name ?? '') && n.box.w <= 40 ? n : (n.children ?? []).map(find).find(Boolean));
      const cb = find(row);
      const stmt = boxField.labelNode && findNode(root, boxField.labelNode);
      if (cb) {
        const look = boxLook(cb, warn);
        const b = look.border;
        addCustomCss(t, `appearance: none; -webkit-appearance: none; flex: none; margin: 0; width: ${px(cb.box.w)}; height: ${px(cb.box.h)}; box-sizing: border-box; background: ${look.background ? cssColor(look.background) : 'transparent'};${b ? ` border: ${b.width.top} ${b.style} ${cssColor(b.color)}; border-radius: ${b.radius?.top ?? '0px'};` : ''}`, ' .form-group input[type=checkbox]');
        const gap = stmt ? stmt.box.x - (cb.box.x + cb.box.w) : 12;
        // Bricks markup: .form-group > ul.options-wrapper > li > input[type=checkbox] + label
        addCustomCss(t, 'list-style: none; margin: 0; padding: 0;', ' .options-wrapper');
        addCustomCss(t, `display: flex; align-items: center; gap: ${px(gap)}; margin: 0; padding: 0;`, ' .options-wrapper li');
        addCustomCss(t, 'margin: 0; padding: 0; flex: 1;', ' .options-wrapper li label');
      }
    }

    // ---- submit ----
    const submit = findNode(root, det.params.submit);
    const sl = boxLook(submit, warn);
    const btnText = firstText(submit);
    if (btnText) {
      t.submitButtonText = btnText.text.characters.trim();
      const bt = typography(btnText);
      bt['letter-spacing'] ??= '0px';
      bt['text-transform'] ??= 'none';
      t.submitButtonTypography = bt;
    }
    if (sl.background) t.submitButtonBackgroundColor = sl.background;
    if (sl.border) t.submitButtonBorder = sl.border;
    const grad = submit.fills?.filter((f) => f.type === 'GRADIENT_LINEAR').pop();
    const decls = [`width: ${px(submit.box.w)}; height: ${px(submit.box.h)}; box-sizing: border-box;`];
    if (submit.layout?.padding) { const p = submit.layout.padding; decls.push(`padding: ${px(p.top)} ${px(p.right)} ${px(p.bottom)} ${px(p.left)};`); }
    if (grad) decls.push(`background-image: ${linearGradientCss(grad, submit.box.w, submit.box.h)};`);
    const icon = svgNode(submit);
    if (icon) { t.submitButtonIcon = svgIcon(icon); t.submitButtonIconPosition = 'right'; decls.push(`display: inline-flex; align-items: center; justify-content: center; gap: ${px(submit.layout?.gap ?? 0)};`); }
    // all of the Figma shadows (several inner + drop shadows on the CTA) as one box-shadow list
    const shadows = (submit.effects ?? []).filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW');
    if (shadows.length) decls.push(`box-shadow: ${shadows.map((e) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(e.x)} ${px(e.y)} ${px(e.blur)} ${px(e.spread ?? 0)} ${cssColor(e)}`).join(', ')};`);
    const labelShadow = (btnText?.effects ?? []).filter((e) => e.type === 'DROP_SHADOW');
    if (labelShadow.length) decls.push(`text-shadow: ${labelShadow.map((e) => `${px(e.x)} ${px(e.y)} ${px(e.blur)} ${cssColor(e)}`).join(', ')};`);
    addCustomCss(t, decls.join(' '), ' button[type=submit]');

    const extra = jsonParam(det.params?.settings);
    if (extra && typeof extra === 'object') Object.assign(t, deepMerge(t, extra));
  },
};
