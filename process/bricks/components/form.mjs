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
import { addCustomCss, cssColor, px } from '../render/utils/css.mjs';
import { linearGradientCss } from '../render/utils/gradient.mjs';
import { deepMerge } from '../render/utils/merge.mjs';
import { typography } from '../render/text.mjs';
import { boxLook, findNode, firstText, jsonParam, rowId, svgIcon, svgNode, visibleKids } from './helpers.mjs';
import { lineHeightFor } from '../render/text.mjs';

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

export default {
  id: 'form',
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
    const ids = [...(jsonParam(det.params?.fields) ?? []).flatMap((f) => [f.node, f.labelNode]), det.params?.submit].filter(Boolean);
    return visibleKids(node).filter((c) => !ids.some((id) => contains(c, id))).map((c) => c.id);
  },

  check(node, det, { root }) {
    const fields = (jsonParam(det.params?.fields) ?? []).filter((f) => f?.node && f.node !== det.params?.submit);
    if (!Array.isArray(fields) || !fields.length) return { ok: false, reason: 'params.fields is empty: list the input frames [{ node, type, label, placeholder }] (the AI pass proposes them with citations)' };
    for (const [i, f] of fields.entries()) if (!f.node || !findNode(root, f.node)) return { ok: false, reason: `params.fields[${i}].node ${f.node} is not in the tree` };
    if (!det.params?.submit || !findNode(root, det.params.submit)) return { ok: false, reason: 'params.submit must be the node id of the submit button frame' };
    return { ok: true, warnings: [`${fields.length} field(s): submit saves the entry under the Figma name. Bricks only shows Save submission after the site setting is on`] };
  },

  apply({ node, inner: t, root, warn, designTitle }, det) {
    const fields = (jsonParam(det.params.fields) ?? []).filter((f) => f?.node && f.node !== det.params?.submit);
    const frames = fields.map((f) => findNode(root, f.node));
    const pad = node.layout?.padding;
    const innerW = node.box.w - (pad?.left ?? 0) - (pad?.right ?? 0);
    t.fields = fields.map((f, i) => {
      const fr = frames[i];
      const askedType = f.type ?? 'text';
      const type = FIELD_TYPES.has(askedType) ? askedType : 'text';
      if (askedType !== type) warn(node, `field type "${askedType}" is not in Bricks 1.12.3, stored as text`);
      const above = typeof f.label === 'string' ? f.label.trim() : '';
      const inside = typeof f.placeholder === 'string' ? f.placeholder.trim() : '';
      // The repeater row is titled by `label` (form.php titleProperty). An empty label shows as "Field".
      // The words drawn in the field are that name. They stay the placeholder; a label above the input is only the one Figma drew separately.
      const fieldName = above || inside;
      const row = {
        id: rowId(det.id, i),
        type,
        ...(fieldName && type !== 'checkbox' && type !== 'hidden' && { label: fieldName }),
        ...(type === 'checkbox' && (above || inside) && { options: above || inside }),
        ...(inside && { placeholder: inside }),
        ...(f.required && { required: true }),
        // the text the designer drew under the field in its error state (Bricks shows it after a failed check of a required / email field)
        ...(f.error && !NO_ERROR.has(type) && { errorMessage: f.error }),
      };
      if (type === 'select' || type === 'radio') {
        const lines = optionLines(f, fr);
        if (lines) row.options = lines;
        // The drawn line is already the option. A second placeholder would add a blank row the file does not show.
        if (!f.options) delete row.placeholder;
      }
      // Bricks width is a percent of the form. A field as wide as the form stays the theme's 100%.
      if (type !== 'checkbox' && type !== 'radio' && innerW > 0 && fr.box.w < innerW - 1) {
        row.width = Math.round((fr.box.w / innerW) * 1000) / 10;
      }
      return row;
    });
    const asked = jsonParam(det.params?.actions);
    const kept = (Array.isArray(asked) ? asked : []).filter((action) => ACTIONS.has(action));
    const dropped = (Array.isArray(asked) ? asked : []).filter((action) => !ACTIONS.has(action));
    if (dropped.length) warn(node, `form action(s) not in Bricks 1.12.3, dropped: ${dropped.join(', ')}`);
    if (!kept.includes('save-submission')) kept.unshift('save-submission');
    t.actions = kept;
    const given = typeof det.params?.formName === 'string' ? det.params.formName.trim() : '';
    t.submissionFormName = given || submissionName({ designTitle, root, node });
    if (fields.some((f) => {
      const above = typeof f.label === 'string' ? f.label.trim() : '';
      const inside = typeof f.placeholder === 'string' ? f.placeholder.trim() : '';
      return above && f.type !== 'checkbox' && above !== inside;
    })) t.showLabels = true;
    // Bricks writes " *" after a required label / placeholder: only when the Figma texts do not already carry the asterisk themselves
    if (fields.some((f) => f.required && !/\*/.test(f.placeholder ?? f.label ?? ''))) t.requiredAsterisk = true;

    // ---- fields ----
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
      const type = fields[i].type;
      if (type === 'checkbox' || type === 'radio') return;
      const nth = ` .form-group:nth-child(${i + 1})`;
      if (type === 'textarea') {
        const own = boxLook(fr, warn);
        const padCss = own.padding ? `padding: ${own.padding.top} ${own.padding.right} ${own.padding.bottom} ${own.padding.left};` : '';
        addCustomCss(t, `height: ${px(fr.box.h)}; min-height: ${px(fr.box.h)}; box-sizing: border-box; ${padCss}`, `${nth} textarea`);
        return;
      }
      // The shared rule is the first input. A taller or shorter field keeps the height Figma drew for it.
      if (i > 0 && Math.abs(fr.box.h - first.box.h) > 0.5) addCustomCss(t, `height: ${px(fr.box.h)}; box-sizing: border-box;`, `${nth} input:not([type=checkbox])`);
    });
    let columnGap = null;
    for (let i = 0; i < frames.length && columnGap == null; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        const a = frames[i];
        const b = frames[j];
        if (parentOf(root, a.id)?.id !== parentOf(root, b.id)?.id) continue;
        if (Math.abs(a.box.y - b.box.y) > 4) continue;
        const [left, right] = a.box.x <= b.box.x ? [a, b] : [b, a];
        const gap = right.box.x - (left.box.x + left.box.w);
        if (gap > 0.5) { columnGap = gap; break; }
      }
    }
    if (columnGap != null) addCustomCss(t, `column-gap: ${px(columnGap)};`);

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

    // ---- gap between the field frames (the theme uses padding-bottom: 20px; fieldMargin is that control) ----
    const fieldGap = node.layout?.gap ?? 0; // the form frame stacks the field frames, the submit and the note with this gap
    t.fieldMargin = { top: '0px', right: '0px', bottom: px(fieldGap), left: '0px' };

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
      // Theme label margin is 5px. The gap is the frame that holds the label and the input, including the form itself.
      addCustomCss(t, `margin-bottom: ${px(holder?.layout?.gap ?? 0)};`, ' .form-group > .label');
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
    const contentW = node.box.w - (pad?.left ?? 0) - (pad?.right ?? 0);
    const buttonFillsRow = contentW > 0 && submit.box.w >= contentW - 1;
    const decls = [`width: ${buttonFillsRow ? '100%' : px(submit.box.w)}; max-width: 100%; height: ${px(submit.box.h)}; box-sizing: border-box;`];
    // The theme wrapper is width:auto inside a row flex, so a button drawn as wide as the fields stays content-sized.
    addCustomCss(t, buttonFillsRow ? 'width: 100%; max-width: 100%;' : 'max-width: 100%;', ' .submit-button-wrapper');
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
