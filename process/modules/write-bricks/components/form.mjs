// COMPONENT form: a container holding labeled inputs and a submit button, drawn as plain frames in Figma.
// Bricks 1.12.3: `form` element with `fields` (repeater) and submit button settings.
//   source: includes/elements/form.php (fields, showLabels, requiredAsterisk, labelTypography, placeholderTypography, fieldPadding, fieldBorder,
//           fieldBackgroundColor, fieldTypography, submitButton*), assets/css/frontend.min.css (.brxe-form: .form-group padding-bottom 20px,
//           label 12px uppercase 600 letter-spacing .4px: all overridden explicitly, found by comparing with Figma)
// WRAPPING: the block keeps the Figma frame (its size, layout, fill), the `form` element sits inside it, and the frame's children that are NOT
//   fields / submit (a note under the button…) are still built after it. Fields and submit frames are merged into the form element.
// The fields are NOT guessed from names: the AI pass (with citations) or the owner lists them in params.fields, each pointing at the
// input frame drawn in Figma. Look values come from the drawn frames:
//   every field  its own width (% of the form) and height; the shared fill, border, padding and type come from the first field
//                 a textarea keeps that frame's height; a later input that is taller gets its own height
//   labels       typography (case / letter-spacing forced to the Figma value, the theme uppercases), gap label -> input, required asterisk color
//   fields gap   the gap between the field frames (the theme's padding-bottom is replaced)
//   submit       text + typography, fill (solid -> Bricks control, gradient -> CSS), border + radius, padding, width, height
// params: fields [{ node (input frame id), type (text|email|tel|textarea|select|checkbox…, default text), label, placeholder, required, labelNode (text node id) }]
//         fields[].error (the Figma error text of that field, written by process/decide from "Error message / X") · errorStyle (its look + gap)
//         submit (node id of the submit button frame) · settings (optional object, raw Bricks settings deep-merged on top)
// Submit stores the entry: actions includes save-submission (Bricks 1.12.3, only after the site setting
// "Save form submissions in database" is on). The form name is the Figma file, the section and this frame.
// Rows land in {$wpdb->prefix}bricks_form_submissions (submission-database.php). Each field id is unique.
// Checked against includes/elements/form.php and includes/integrations/form/ on 2026-11-04, same note as the
// predecessor forms.md. Source wins where that note differs: the date type is datepicker (time is a checkbox
// on that field, not types date or time); select, radio and checkbox options are one textarea, one line each,
// not an options repeater; rememberme exists; there is no field type step. Actions present and left off:
// email, redirect, mailchimp, sendgrid, login, registration, lost-password, reset-password, custom.
// unlock-password-protection is listed only while password protection is on. Absent: webhook, create-post,
// confirmation-email, update-post. custom is the PHP hook bricks/form/custom_action, not generated.
import { addCustomCss, cssColor, px, r4 } from '../../write-bricks/render/utils/css.mjs';
import { linearGradientCss } from '../../write-bricks/render/utils/gradient.mjs';
import { deepMerge } from '../../write-bricks/render/utils/merge.mjs';
import { typography } from '../../write-bricks/render/text.mjs';
import { boxLook, findNode, firstText, jsonParam, rowId, svgIcon, svgNode, visibleKids } from '../../write-bricks/components/helpers.mjs';
import { lineHeightFor } from '../../write-bricks/render/text.mjs';
import { paintSwitch, switchOption } from './choice-control.mjs';
import { MISSING } from '../../missing-content/choices.mjs';
import { PartKind } from '../../recognize-parts/kinds.mjs';

// form.php type select. `step` is not a type. `date` / `time` are not types: the control is datepicker.
const FIELD_TYPES = new Set(['email', 'text', 'textarea', 'tel', 'number', 'url', 'checkbox', 'select', 'radio', 'file', 'datepicker', 'password', 'rememberme', 'html', 'hidden']);
// init.php get_available_actions(). Since 1.12.2 an action missing from that list is skipped, so save-submission
// only runs while the site setting is on. webhook, create-post, confirmation-email and update-post are not in the list.
const ACTIONS = new Set(['custom', 'email', 'redirect', 'mailchimp', 'sendgrid', 'login', 'registration', 'lost-password', 'reset-password', 'save-submission', 'unlock-password-protection']);
// errorMessage control is hidden for these types (form.php).
const NO_ERROR = new Set(['hidden', 'radio', 'checkbox', 'select', 'file', 'datepicker']);

const contains = (n, id) => n.id === id || (n.children ?? []).some((c) => contains(c, id));
const parentOf = (root, id) => (root.children ?? []).reduce((f, c) => f ?? (c.id === id ? root : parentOf(c, id)), null);

// A select with no options renders nothing (form.php). The lines are the ones Figma drew, or params.options. Never a made-up list.
const optionLines = (field, frame) => {
  const given = jsonParam(field.options);
  if (Array.isArray(given)) {
    const lines = given.map((line) => String(line).trim()).filter(Boolean);
    if (lines.length) return lines.join('\n');
  } else if (typeof given === 'string' && given.trim()) return given.trim();
  const drawn = [];
  (function walk(n) {
    if (!n || n.visible === false) return;
    if (n.type === 'TEXT' && n.id !== field.labelNode && n.text?.characters?.trim()) drawn.push(n.text.characters.trim().replace(/\s+/g, ' '));
    for (const c of n.children ?? []) walk(c);
  })(frame);
  const unique = [...new Set(drawn)];
  if (unique.length > 1) return unique.join('\n');
  return (field.placeholder || unique[0] || '').trim();
};

// "<Figma file> - <section> / <form frame>". A repeated piece is left out. The site lists submissions under this name.
export function submissionName({ designTitle, root, node } = {}) {
  const frame = String(node?.name ?? '').trim();
  const section = String(root?.name ?? '').trim();
  const design = String(designTitle ?? '').trim();
  const head = design || section;
  if (!frame || frame === section || frame === head) return head || frame || 'Form';
  if (head.endsWith(`- ${frame}`) || head.endsWith(`/ ${frame}`)) return head;
  return head ? `${head} / ${frame}` : frame;
}

function applyActionForm({ node, inner: t, root, warn, designTitle, s, fileKey }, det) {
  const fields = (jsonParam(det.params.fields) ?? []).filter((f) => f?.node && f.node !== det.params?.submit);
  if (s && !s._position) s._position = 'relative';
  t.fields = fields.map((f, i) => {
    const state = f.labelNode ? findNode(root, f.labelNode) : null;
    const drawn = state?.text?.characters?.trim().replace(/\s+/g, ' ') || '';
    const painted = paintSwitch(t, root, { id: det.id, node: f.node, params: { ...f, label: drawn, checked: f.checked } }, 'checkbox', fileKey, ` .form-group:nth-child(${i + 1})`);
    const offWord = painted?.offLabel || drawn;
    const onWord = painted?.onLabel || '';
    const html = switchOption(offWord, onWord);
    const submitted = html ? onWord : 'on';
    const row = findNode(root, f.node);
    if (row?.box) {
      const top = row.box.absY - node.box.absY;
      const left = row.box.absX - node.box.absX;
      addCustomCss(t, `position: absolute; top: ${px(top)}; left: ${px(left)}; width: ${px(row.box.w)}; height: ${px(row.box.h)}; margin: 0; padding: 0;`, ` .form-group:nth-child(${i + 1})`);
    }
    return {
      id: rowId(det.id, i),
      type: 'checkbox',
      label: f.label || offWord || 'Switch',
      options: html ? `${submitted}:${html}` : `${submitted}:${drawn}`,
      valueLabelOptions: true,
      ...(f.checked ? { value: submitted } : {}),
    };
  });
  t.fieldMargin = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
  t.actions = ['save-submission'];
  t.submissionFormName = submissionName({ designTitle, root, node });
  t._position = 'absolute';
  t._top = '0px';
  t._left = '0px';
  t._width = '100%';
  t._height = '100%';
  addCustomCss(t, 'position: absolute; inset: 0; margin: 0; padding: 0; pointer-events: none; background: none;');
  addCustomCss(t, 'pointer-events: auto;', ' .form-group');
  const submit = findNode(root, det.params.submit);
  const btnText = submit && firstText(submit);
  if (btnText) {
    t.submitButtonText = btnText.text.characters.trim();
    const bt = typography(btnText);
    bt['letter-spacing'] ??= '0px';
    bt['text-transform'] ??= 'none';
    t.submitButtonTypography = bt;
  }
  if (submit) {
    const look = boxLook(submit, warn);
    if (look.background) t.submitButtonBackgroundColor = look.background;
    if (look.border) t.submitButtonBorder = look.border;
    const top = submit.box.absY - node.box.absY;
    const left = submit.box.absX - node.box.absX;
    addCustomCss(t, `position: absolute; top: ${px(top)}; left: ${px(left)}; width: ${px(submit.box.w)}; margin: 0; pointer-events: auto;`, ' .submit-button-wrapper');
    const decls = [`width: ${px(submit.box.w)}; height: ${px(submit.box.h)}; box-sizing: border-box; cursor: pointer;`];
    if (submit.layout?.padding) {
      const p = submit.layout.padding;
      decls.push(`padding: ${px(p.top)} ${px(p.right)} ${px(p.bottom)} ${px(p.left)};`);
    }
    addCustomCss(t, decls.join(' '), ' button[type=submit]');
  }
}

function fieldRows(fields, frames, innerW, det, node, warn) {
  return fields.map((field, index) => {
    const frame = frames[index];
    const askedType = field.type ?? 'text';
    const type = FIELD_TYPES.has(askedType) ? askedType : 'text';
    if (askedType !== type) warn(node, `field type "${askedType}" is not in Bricks 1.12.3, stored as text`);
    const above = typeof field.label === 'string' ? field.label.trim() : '';
    const inside = typeof field.placeholder === 'string' ? field.placeholder.trim() : '';
    const fieldName = above || inside;
    const row = {
      id: rowId(det.id, index),
      type,
      ...(fieldName && type !== 'checkbox' && type !== 'hidden' && { label: fieldName }),
      ...(type === 'checkbox' && (above || inside) && { options: above || inside }),
      ...(inside && { placeholder: inside }),
      ...(field.required && { required: true }),
      ...(field.error && !NO_ERROR.has(type) && { errorMessage: field.error }),
    };
    if (type === 'select' || type === 'radio') {
      const lines = optionLines(field, frame);
      if (lines) row.options = lines;
      if (!field.options) delete row.placeholder;
    }
    if (type !== 'checkbox' && type !== 'radio' && innerW > 0 && frame.box.w < innerW - 1) {
      row.width = Math.round((frame.box.w / innerW) * 1000) / 10;
    }
    return row;
  });
}

function columnGapOf(root, frames) {
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const a = frames[i];
      const b = frames[j];
      if (parentOf(root, a.id)?.id !== parentOf(root, b.id)?.id) continue;
      if (Math.abs(a.box.y - b.box.y) > 4) continue;
      const [left, right] = a.box.x <= b.box.x ? [a, b] : [b, a];
      const gap = right.box.x - (left.box.x + left.box.w);
      if (gap > 0.5) return gap;
    }
  }
  return null;
}

function fieldGapOf(root, node, frames) {
  let fieldGap = node.layout?.gap ?? 0;
  let holder = parentOf(root, frames[0].id);
  while (holder) {
    if (frames.every((frame) => contains(holder, frame.id)) && holder.layout?.mode === 'VERTICAL' && holder.layout.gap > 0) return holder.layout.gap;
    holder = parentOf(root, holder.id);
  }
  return fieldGap;
}

function writeFieldLook(target, fields, frames, warn) {
  const first = frames[0];
  const look = boxLook(first, warn);
  if (look.background) target.fieldBackgroundColor = look.background;
  if (look.border) target.fieldBorder = look.border;
  if (look.padding) target.fieldPadding = look.padding;
  const inText = firstText(first);
  if (inText) { target.placeholderTypography = typography(inText); target.fieldTypography = typography(inText); }
  addCustomCss(target, `height: ${px(first.box.h)}; box-sizing: border-box; cursor: text;`, ' .form-group input:not([type=checkbox]):not([type=radio]):not([type=submit])');
  addCustomCss(target, 'cursor: text;', ' .form-group textarea');
  addCustomCss(target, 'cursor: pointer;', ' .form-group select, .form-group input[type=checkbox], .form-group input[type=radio]');
  if (inText) addCustomCss(target, `line-height: ${px(lineHeightFor(inText))}; resize: none;`, ' .form-group textarea');
  frames.forEach((frame, index) => {
    const type = fields[index].type;
    if (type === 'checkbox' || type === 'radio') return;
    const nth = ` .form-group:nth-child(${index + 1})`;
    if (type === 'textarea') {
      const own = boxLook(frame, warn);
      const padCss = own.padding ? `padding: ${own.padding.top} ${own.padding.right} ${own.padding.bottom} ${own.padding.left};` : '';
      addCustomCss(target, `height: ${px(frame.box.h)}; min-height: ${px(frame.box.h)}; box-sizing: border-box; ${padCss}`, `${nth} textarea`);
      return;
    }
    if (index > 0 && Math.abs(frame.box.h - first.box.h) > 0.5) addCustomCss(target, `height: ${px(frame.box.h)}; box-sizing: border-box;`, `${nth} input:not([type=checkbox])`);
  });
}

function writeFieldGrid(target, fields, frames, innerW, columnGap) {
  if (columnGap != null) addCustomCss(target, `column-gap: ${px(columnGap)};`);
  const sharesRow = frames.some((frame, index) => fields[index].type !== 'checkbox' && fields[index].type !== 'radio' && innerW > 0 && frame.box.w < innerW - 1);
  if (!sharesRow) return;
  addCustomCss(target, 'display: flex; flex-wrap: wrap; align-items: flex-start;');
  frames.forEach((frame, index) => {
    if (fields[index].type === 'checkbox' || fields[index].type === 'radio') return;
    const full = !(innerW > 0 && frame.box.w < innerW - 1);
    const share = columnGap ?? 0;
    const basis = full ? '100%' : `calc(${r4((frame.box.w / innerW) * 100)}% - ${px(share / 2)})`;
    addCustomCss(target, `width: ${basis}; max-width: ${basis}; flex: 0 0 ${basis};`, ` .form-group:nth-child(${index + 1})`);
  });
}

function writeErrorLook(target, fields, style) {
  if (!style || !fields.some((field) => field.error)) return;
  const rules = ['background-color: transparent;', 'padding: 0;', `margin-top: ${px(style.gap)};`];
  if (style.color) rules.push(`color: ${cssColor({ hex: style.color, alpha: style.alpha ?? 1 })};`);
  if (style.fontFamily) rules.push(`font-family: ${style.fontFamily};`);
  if (style.fontSize) rules.push(`font-size: ${px(style.fontSize)};`);
  if (style.fontWeight) rules.push(`font-weight: ${style.fontWeight};`);
  if (style.lineHeightPx) rules.push(`line-height: ${px(style.lineHeightPx)};`);
  rules.push(`letter-spacing: ${px(style.letterSpacing ?? 0)};`);
  addCustomCss(target, rules.join(' '), ' .form-group .form-group-error-message');
}

function writeLabels(target, root, fields) {
  const labelNode = fields.map((field) => field.labelNode && findNode(root, field.labelNode)).find(Boolean);
  if (!labelNode?.text) return;
  const type = typography(labelNode);
  type['text-transform'] ??= 'none';
  type['letter-spacing'] ??= '0px';
  target.labelTypography = type;
  let holder = parentOf(root, labelNode.id);
  while (holder && !contains(holder, fields[0].node)) holder = parentOf(root, holder.id);
  addCustomCss(target, `margin-bottom: ${px(holder?.layout?.gap ?? 0)};`, ' .form-group > .label');
  const star = (parentOf(root, labelNode.id)?.children ?? []).find((child) => child.type === 'TEXT' && child.text?.characters?.trim() === '*');
  const starFill = star?.fills?.find((fill) => fill.type === 'SOLID');
  if (starFill) addCustomCss(target, `color: ${cssColor(starFill)};`, ' .required:after');
}

function writeCheckbox(target, root, field, warn) {
  const row = findNode(root, field.node);
  const find = (node) => (/check\s?box/i.test(node.name ?? '') && node.box.w <= 40 ? node : (node.children ?? []).map(find).find(Boolean));
  const box = find(row);
  const statement = field.labelNode && findNode(root, field.labelNode);
  if (!box) return;
  const look = boxLook(box, warn);
  const border = look.border;
  // Theme form inputs carry padding. The checkbox mark is only the Figma box.
  addCustomCss(target, `appearance: none; -webkit-appearance: none; cursor: pointer; flex: none; margin: 0; padding: 0 !important; width: ${px(box.box.w)}; height: ${px(box.box.h)}; box-sizing: border-box; background: ${look.background ? cssColor(look.background) : 'transparent'};${border ? ` border: ${border.width.top} ${border.style} ${cssColor(border.color)}; border-radius: ${border.radius?.top ?? '0px'};` : ''}`, ' .form-group input[type=checkbox]');
  // Figma draws the checked box in a variant the file does not carry, so the checked look is derived: the box is filled with the accent of the
  // statement (the color of its underlined link run, else the border color) and a white tick is drawn on it.
  const link = (statement?.text?.runs ?? []).find((run) => /UNDERLINE/.test(run.style?.textDecoration ?? '') && run.style?.fills?.some((fill) => fill.type === 'SOLID'));
  const accent = link?.style?.fills?.find((fill) => fill.type === 'SOLID')?.hex ?? (border?.color ? cssColor(border.color) : '#0759ce');
  const tick = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5 10.5l3.2 3.2L15 6.8' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
  addCustomCss(target, `background: ${accent} ${tick} center / 100% 100% no-repeat; border-color: ${accent};`, ' .form-group input[type=checkbox]:checked');
  const gap = statement ? statement.box.x - (box.box.x + box.box.w) : 12;
  addCustomCss(target, 'list-style: none; margin: 0; padding: 0;', ' .options-wrapper');
  addCustomCss(target, `display: flex; align-items: center; gap: ${px(gap)}; margin: 0; padding: 0;`, ' .options-wrapper li');
  addCustomCss(target, 'margin: 0; padding: 0; flex: 1;', ' .options-wrapper li label');
}

function writeFormRecord(ctx, det) {
  const { node, inner: t, root, warn, designTitle } = ctx;
  const fields = (jsonParam(det.params.fields) ?? []).filter((field) => field?.node && field.node !== det.params?.submit);
  const frames = fields.map((field) => findNode(root, field.node));
  const pad = node.layout?.padding;
  const innerW = node.box.w - (pad?.left ?? 0) - (pad?.right ?? 0);
  t.fields = fieldRows(fields, frames, innerW, det, node, warn);
  const asked = jsonParam(det.params?.actions);
  const kept = (Array.isArray(asked) ? asked : []).filter((action) => ACTIONS.has(action));
  const dropped = (Array.isArray(asked) ? asked : []).filter((action) => !ACTIONS.has(action));
  if (dropped.length) warn(node, `form action(s) not in Bricks 1.12.3, dropped: ${dropped.join(', ')}`);
  if (!kept.includes('save-submission')) kept.unshift('save-submission');
  t.actions = kept;
  const given = typeof det.params?.formName === 'string' ? det.params.formName.trim() : '';
  t.submissionFormName = given || submissionName({ designTitle, root, node });
  const bare = (value) => String(value ?? '').replace(/[.*…\s]+$/g, '').trim();
  if (fields.some((field) => {
    const above = typeof field.label === 'string' ? field.label.trim() : '';
    const inside = typeof field.placeholder === 'string' ? field.placeholder.trim() : '';
    return above && field.type !== 'checkbox' && bare(above) !== bare(inside);
  })) t.showLabels = true;
  if (fields.some((field) => field.required && !/\*/.test(field.placeholder ?? field.label ?? ''))) t.requiredAsterisk = true;
  writeFieldLook(t, fields, frames, warn);
  const columnGap = columnGapOf(root, frames);
  writeFieldGrid(t, fields, frames, innerW, columnGap);
  writeErrorLook(t, fields, det.params?.errorStyle);
  t.fieldMargin = { top: '0px', right: '0px', bottom: px(fieldGapOf(root, node, frames)), left: '0px' };
  writeLabels(t, root, fields);
  const boxField = fields.find((field) => field.type === 'checkbox');
  if (boxField) writeCheckbox(t, root, boxField, warn);
  t.__submitText = det.params?.submitText;
  writeSubmit(t, node, det.params?.submit ? findNode(root, det.params.submit) : null, warn);
  const extra = jsonParam(det.params?.settings);
  if (extra && typeof extra === 'object') Object.assign(t, deepMerge(t, extra));
}

function writeSubmit(target, node, submit, warn) {
  if (!submit) {
    const given = typeof target.__submitText === 'string' ? target.__submitText.trim() : '';
    target.submitButtonText = given || MISSING;
    delete target.__submitText;
    return;
  }
  delete target.__submitText;
  const look = boxLook(submit, warn);
  const label = firstText(submit);
  if (label) {
    target.submitButtonText = label.text.characters.trim();
    const type = typography(label);
    type['letter-spacing'] ??= '0px';
    type['text-transform'] ??= 'none';
    target.submitButtonTypography = type;
  }
  if (look.background) target.submitButtonBackgroundColor = look.background;
  if (look.border) target.submitButtonBorder = look.border;
  const gradient = submit.fills?.filter((fill) => fill.type === 'GRADIENT_LINEAR').pop();
  const pad = node.layout?.padding;
  const contentW = node.box.w - (pad?.left ?? 0) - (pad?.right ?? 0);
  const fillsRow = contentW > 0 && submit.box.w >= contentW - 1;
  const rules = [`width: ${fillsRow ? '100%' : px(submit.box.w)}; max-width: 100%; height: ${px(submit.box.h)}; box-sizing: border-box;`];
  addCustomCss(target, fillsRow ? 'width: 100%; max-width: 100%;' : 'max-width: 100%;', ' .submit-button-wrapper');
  if (submit.layout?.padding) {
    const buttonPad = submit.layout.padding;
    rules.push(`padding: ${px(buttonPad.top)} ${px(buttonPad.right)} ${px(buttonPad.bottom)} ${px(buttonPad.left)};`);
  }
  if (gradient) rules.push(`background-image: ${linearGradientCss(gradient, submit.box.w, submit.box.h)};`);
  const icon = svgNode(submit);
  if (icon) {
    target.submitButtonIcon = svgIcon(icon);
    target.submitButtonIconPosition = 'right';
    rules.push(`display: inline-flex; align-items: center; justify-content: center; gap: ${px(submit.layout?.gap ?? 0)};`);
  }
  const shadows = (submit.effects ?? []).filter((effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW');
  if (shadows.length) rules.push(`box-shadow: ${shadows.map((effect) => `${effect.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${px(effect.spread ?? 0)} ${cssColor(effect)}`).join(', ')};`);
  const labelShadow = (label?.effects ?? []).filter((effect) => effect.type === 'DROP_SHADOW');
  if (labelShadow.length) rules.push(`text-shadow: ${labelShadow.map((effect) => `${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${cssColor(effect)}`).join(', ')};`);
  addCustomCss(target, rules.join(' '), ' button[type=submit]');
}

export default {
  id: PartKind.FORM,
  status: 'implemented',
  label: 'Form',
  figma: 'a container with labeled input frames and a submit button frame (listed in params.fields / params.submit with citations)',
  bricks: 'a block (the Figma frame) holding a `form` element: fields repeater + field / label / submit look from the drawn frames; other children kept after it',
  limits: 'submit saves the entry (Save submission). That action is hidden until Bricks → Settings → General → Save form submissions in database is on. No email recipient is invented. An error message exists only for the fields the designer drew an error frame for (params.fields[].error, from "Error message / X"); a select lists the options that were drawn or passed in, and nothing else; the shared fill and border are the first field',
  mergesChildren: true,
  wrap: true,
  innerKind: 'form',
  kind: () => 'block',

  // children that hold no field, label or submit (a note under the button) stay built
  keepNodes(node, det) {
    if (det.params?.kind === 'action') return visibleKids(node).map((c) => c.id);
    const ids = [...(jsonParam(det.params?.fields) ?? []).flatMap((f) => [f.node, f.labelNode]), det.params?.submit].filter(Boolean);
    return visibleKids(node).filter((c) => !ids.some((id) => contains(c, id))).map((c) => c.id);
  },

  descendants(node, det, { root } = {}) {
    if (det.params?.kind !== 'action' || !root) return {};
    const out = {};
    for (const field of jsonParam(det.params?.fields) ?? []) {
      if (field.role !== 'switch') continue;
      const row = findNode(root, field.node);
      if (!row?.box) continue;
      out[field.node] = {
        skipChildren: true,
        settings: { _width: px(row.box.w), _height: px(row.box.h), _widthMin: '0px', _heightMin: '0px' },
        css: [{ decl: 'pointer-events: none;' }],
      };
    }
    const submit = findNode(root, det.params?.submit);
    if (submit?.box) {
      out[submit.id] = {
        settings: { _opacity: '0', _width: px(submit.box.w), _height: px(submit.box.h) },
        css: [{ decl: 'pointer-events: none;' }],
      };
    }
    return out;
  },

  check(node, det, { root }) {
    const fields = (jsonParam(det.params?.fields) ?? []).filter((f) => f?.node && f.node !== det.params?.submit);
    if (!Array.isArray(fields) || !fields.length) return { ok: false, reason: 'params.fields is empty: list the input frames [{ node, type, label, placeholder }] (the AI pass proposes them with citations)' };
    for (const [i, f] of fields.entries()) if (!f.node || !findNode(root, f.node)) return { ok: false, reason: `params.fields[${i}].node ${f.node} is not in the tree` };
    if (det.params?.submit && !findNode(root, det.params.submit)) return { ok: false, reason: 'params.submit must be the node id of the submit button frame' };
    return { ok: true, warnings: [`${fields.length} field(s): submit saves the entry under the Figma name. Bricks only shows Save submission after the site setting is on`] };
  },

  apply(ctx, det) {
    if (det.params?.kind === 'action') {
      applyActionForm(ctx, det);
      return;
    }
    writeFormRecord(ctx, det);
  },
};
