// Shared Bricks output for a checkbox, a radio, and a switch row.
// Bricks 1.12.3 has form field types `checkbox` and `radio` (includes/elements/form.php) and no switch element
// (no toggle-mode file). The switch is a checkbox field whose box is the Figma pill.
// form.php has no control for the input's width, height, or radius, and it always renders a submit button
// (around line 2551). Those two facts are the only custom CSS. Bricks compiles `_cssCustom` into
// post-{id}.min.css when CSS loading is External files. Theme styles are not touched.
// labelTypography is the control that styles the option label (`label`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addCustomCss, cssColor } from '../render/utils/css.mjs';
import { typography } from '../render/text.mjs';
import { findNode, rowId } from './helpers.mjs';

const historyRuns = join(dirname(fileURLToPath(import.meta.url)), '../../../../history/runs');

const ZERO = { top: '0px', right: '0px', bottom: '0px', left: '0px' };

function solidFill(n) {
  return (n?.fills ?? []).find((f) => f.type === 'SOLID' && f.visible !== false);
}

function switchKey(n) {
  if (!n?.box) return '';
  return `${n.name ?? ''}|${Math.round(n.box.w)}x${Math.round(n.box.h)}`;
}

function knobOn(track) {
  if (track?.props?.Pressed === 'True') return true;
  if (track?.props?.Pressed === 'False') return false;
  const knob = (track.children ?? []).find((c) => c && c.visible !== false && c.box && Math.abs(c.box.w - c.box.h) <= 4);
  if (!knob?.box || !track.box) return null;
  return knob.box.x + knob.box.w / 2 > track.box.w / 2;
}

function labelBeside(parent) {
  const text = (parent?.children ?? []).find((c) => c && c.visible !== false && c.type === 'TEXT' && c.text?.characters?.trim());
  return text ? text.text.characters.trim().replace(/\s+/g, ' ') : '';
}

function collectSwitchPaints(root, key, out) {
  const walk = (n, parent) => {
    if (!n || n.visible === false) return;
    if (switchKey(n) === key) {
      const fill = solidFill(n);
      const on = knobOn(n);
      if (fill?.hex && on != null) out.push({ on, track: { hex: fill.hex, alpha: fill.alpha ?? 1 }, label: labelBeside(parent) });
    }
    (n.children ?? []).forEach((c) => walk(c, n));
  };
  if (root) walk(root, null);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The two words are the drawn state values. Checked shows the on word. Nothing is invented when one state was not drawn.
export function switchOption(off, on) {
  if (!off || !on || off === on) return null;
  return `<span class="f2b-off">${escapeHtml(off)}</span><span class="f2b-on">${escapeHtml(on)}</span>`;
}

const siblingPaintsCache = new Map();
function siblingPaints(fileKey, key) {
  const cacheKey = `${fileKey}|${key}`;
  if (siblingPaintsCache.has(cacheKey)) return siblingPaintsCache.get(cacheKey);
  const out = [];
  const dir = fileKey ? join(historyRuns, fileKey) : '';
  if (dir && existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name, 'tree.json');
      if (!existsSync(path)) continue;
      try {
        const tree = JSON.parse(readFileSync(path, 'utf8'));
        collectSwitchPaints(tree.root || tree, key, out);
      } catch { /* a tree that does not parse is not a state */ }
    }
  }
  siblingPaintsCache.set(cacheKey, out);
  return out;
}

// An input cannot hold a child, and ::before on a checkbox is not reliable.
// The knob is a circle painted on the input's own background, at the Figma offset.
function markOf(root, det) {
  const stored = det.params?.markNode ? findNode(root, det.params.markNode) : null;
  if (stored?.box) return stored;
  const host = findNode(root, det.node);
  const w = Number(det.params?.markW);
  const h = Number(det.params?.markH);
  let hit = null;
  const walk = (n) => {
    if (!n || n.visible === false) return;
    if (n !== host && n.box && w > 0 && Math.round(n.box.w) === w && Math.round(n.box.h) === h) hit ??= n;
    (n.children ?? []).forEach(walk);
  };
  if (host) walk(host);
  return hit;
}

export function paintSwitch(t, root, det, fieldType, fileKey, scope = '') {
  const mark = markOf(root, det);
  const label = det.params?.labelNode ? findNode(root, det.params.labelNode) : null;
  if (!mark?.box) return;
  const track = solidFill(mark);
  const knob = (mark.children ?? []).find((c) => c.visible !== false && c.box && Math.abs(c.box.w - c.box.h) <= 4);
  const knobFill = knob ? solidFill(knob) : null;
  const sel = `${scope} input[type="${fieldType}"]`;
  const pill = Array.isArray(mark.radius) && mark.radius.length ? Math.min(...mark.radius) : (typeof mark.radius === 'number' ? mark.radius : mark.box.h / 2);
  addCustomCss(t, `appearance: none; -webkit-appearance: none; width: ${Math.round(mark.box.w)}px; height: ${Math.round(mark.box.h)}px; border: 0; border-radius: ${Math.round(pill)}px; margin: 0; padding: 0; flex: none; box-sizing: border-box; background-repeat: no-repeat;`, sel);
  const paints = [];
  collectSwitchPaints(root, switchKey(mark), paints);
  if (!paints.some((p) => p.on) || !paints.some((p) => !p.on)) paints.push(...siblingPaints(fileKey, switchKey(mark)));
  const off = paints.find((p) => !p.on);
  const on = paints.find((p) => p.on);
  const drawn = track?.hex ? { hex: track.hex, alpha: track.alpha ?? 1 } : null;
  const rest = off?.track || drawn;
  if (rest) addCustomCss(t, `background-color: ${cssColor(rest)};`, sel);
  if (on && rest && cssColor(on.track) !== cssColor(rest)) addCustomCss(t, `background-color: ${cssColor(on.track)};`, `${sel}:checked`);
  addCustomCss(t, 'cursor: pointer;', sel);
  if (knob && knobFill) {
    const cx = Math.round(knob.box.x + knob.box.w / 2);
    const cy = Math.round(knob.box.y + knob.box.h / 2);
    const radius = Math.round(knob.box.w / 2);
    const mirror = Math.round(mark.box.w - cx);
    const at = (x) => `radial-gradient(circle at ${x}px ${cy}px, ${cssColor(knobFill)} ${radius}px, transparent ${radius + 0.5}px)`;
    const drawn = at(cx);
    const other = at(mirror);
    const on = det.params?.checked === true;
    addCustomCss(t, `background-image: ${on ? other : drawn};`, sel);
    addCustomCss(t, `background-image: ${on ? drawn : other};`, `${sel}:checked`);
  }
  const offLabel = off?.label || '';
  const onLabel = on?.label || '';
  if (offLabel && onLabel && offLabel !== onLabel) {
    addCustomCss(t, 'display: none;', `${scope} .options-wrapper li label .f2b-on`);
    addCustomCss(t, 'display: none;', `${sel}:checked + label .f2b-off`);
    addCustomCss(t, 'display: inline;', `${sel}:checked + label .f2b-on`);
  }
  if (!label?.box && !scope) return { offLabel, onLabel };
  if (label?.box) {
    const labelFirst = label.box.x < mark.box.x;
    const gap = labelFirst ? mark.box.x - (label.box.x + label.box.w) : label.box.x - (mark.box.x + mark.box.w);
    addCustomCss(t, 'list-style: none; margin: 0; padding: 0;', `${scope} .options-wrapper`);
    addCustomCss(t, `display: flex; align-items: center; gap: ${Math.max(0, Math.round(gap))}px; flex-direction: ${labelFirst ? 'row-reverse' : 'row'}; margin: 0; padding: 0;`, `${scope} .options-wrapper li`);
    addCustomCss(t, 'margin: 0; padding: 0; cursor: pointer;', `${scope} .options-wrapper li label`);
  }
  return { offLabel, onLabel };
}

export function applyChoice(ctx, det, kind) {
  const { node, inner: t, root, warn } = ctx;
  const label = String(det.params?.label ?? '').trim();
  const on = det.params?.checked === true;
  const text = det.params?.labelNode ? findNode(root, det.params.labelNode) : null;
  const fieldType = kind === 'radio' ? 'radio' : 'checkbox';
  const states = kind === 'switch' ? paintSwitch(t, root, det, fieldType, ctx.fileKey) : null;
  const offWord = states?.offLabel || label;
  const onWord = states?.onLabel || '';
  const html = kind === 'switch' ? switchOption(offWord, onWord) : null;
  const submitted = html ? onWord : 'on';
  t.fields = [{
    id: rowId(det.id, 'choice'),
    type: fieldType,
    options: html ? `${submitted}:${html}` : `${submitted}:${label}`,
    valueLabelOptions: true,
    ...(on ? { value: submitted } : {}),
  }];
  t.showLabels = true;
  if (text?.text) {
    const ty = typography(text);
    if (!ty['text-transform']) ty['text-transform'] = 'none';
    if (!ty['letter-spacing']) ty['letter-spacing'] = '0px';
    t.labelTypography = ty;
  }
  // Theme .form-group padding-bottom is 20px. fieldMargin is the spacing control (selector .form-group:not(:last-child)).
  t.fieldMargin = ZERO;
  // form.php always prints the submit button. There is no hide control.
  addCustomCss(t, 'display: none;', ' .submit-button-wrapper');
  const w = Number(det.params?.markW);
  const h = Number(det.params?.markH);
  if (w > 0 && h > 0) {
    const radius = Number(det.params?.markRadius) || 0;
    // The input has no width, height, or radius control. The numbers are the Figma mark.
    addCustomCss(t, `appearance: none; width: ${w}px; height: ${h}px; border-radius: ${radius}px; margin: 0; flex: none;`, ` input[type="${fieldType}"]`);
  }
  if (kind === 'switch') {
    warn(node, 'Bricks 1.12.3 has no switch element (no toggle-mode). The control is a checkbox field sized to the Figma pill. That size is element CSS, compiled into the external post CSS file. The form submit button is hidden because form.php always renders it.');
  } else if (kind === 'radio') {
    warn(node, 'The drawn circle becomes a native radio sized to the Figma circle. That size is element CSS, compiled into the external post CSS file. The form submit button is hidden because form.php always renders it.');
  } else {
    warn(node, 'The drawn square becomes a native checkbox sized to the Figma square. That size is element CSS, compiled into the external post CSS file. The form submit button is hidden because form.php always renders it.');
  }
}
