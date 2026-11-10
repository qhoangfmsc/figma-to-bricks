// One state enum for every component. The value is the designer's variant property `State`
// (or the variant name "State=Hover", or Checked=True), never a layer name.
// A state is the paint difference plus the HTML attribute plus the script that moves both.
// Paint left on one item after another item is chosen is not a state.
// Accordion, menu, and tabs own their open / active behaviour and are skipped by the sibling walker.
import { cssColor, px } from '../../write-bricks/render/utils/css.mjs';

export const ComponentState = Object.freeze({
  REST: 'rest',
  HOVER: 'hover',
  ACTIVE: 'active',
  OPEN: 'open',
  FOCUS: 'focus',
  DISABLED: 'disabled',
  PRESSED: 'pressed',
});

// Selector hung on the element that owns the variant. Open and active are classes the
// component script toggles. Hover, focus, and pressed are CSS pseudos.
export const STATE_SELECTOR = Object.freeze({
  [ComponentState.REST]: '',
  [ComponentState.HOVER]: ':hover',
  [ComponentState.ACTIVE]: '.is-active',
  [ComponentState.OPEN]: '.brx-open',
  [ComponentState.FOCUS]: ':focus-visible',
  [ComponentState.DISABLED]: '.is-disabled',
  [ComponentState.PRESSED]: ':active',
});

const NAMED = [
  [ComponentState.HOVER, /^hover$/i],
  [ComponentState.FOCUS, /^focus(ed)?$/i],
  [ComponentState.PRESSED, /^press(ed)?$/i],
  [ComponentState.DISABLED, /^disabled$/i],
  [ComponentState.OPEN, /^(expand|expanded|open|opened)$/i],
  [ComponentState.ACTIVE, /^(active|selected|current)$/i],
  [ComponentState.REST, /^(default|collapsed|closed|rest|normal|idle)$/i],
];

export function componentState(node) {
  const fromProps = String(node?.props?.State ?? node?.props?.state ?? '').trim();
  const fromVariant = /(?:^|,\s*)state\s*=\s*([^,]+)/i.exec(node?.component ?? '')?.[1]?.trim() ?? '';
  const value = fromProps || fromVariant;
  if (!value) return null;
  return NAMED.find(([, re]) => re.test(value))?.[0] ?? null;
}

const solidFill = (n) => (n?.fills ?? []).filter((f) => f.type === 'SOLID').at(-1) ?? null;
const fillKey = (f) => (f ? `${f.hex}:${f.alpha ?? 1}` : '');
const shown = (n) => (n?.children ?? []).filter((c) => c && c.visible !== false);

function checkedValue(n) {
  const raw = n?.props?.Checked ?? n?.props?.checked;
  if (raw == null || raw === '') return null;
  if (raw === true || /^true$/i.test(String(raw))) return true;
  if (raw === false || /^false$/i.test(String(raw))) return false;
  return null;
}

function strokeWidths(st) {
  return st.weights ?? { top: st.weight ?? 0, right: st.weight ?? 0, bottom: st.weight ?? 0, left: st.weight ?? 0 };
}

// The same declaration the render writes, so the state rule beats the baked paint.
function strokeDecl(n) {
  const st = n?.stroke;
  const top = st?.paints?.filter((p) => p.visible !== false && p.type === 'SOLID').at(-1);
  if (!top?.hex) return '';
  const w = strokeWidths(st);
  const uniform = w.top === w.right && w.right === w.bottom && w.bottom === w.left && w.top > 0;
  if (!uniform) return '';
  const pad = n.layout?.padding;
  const padOk = !!pad && ['top', 'right', 'bottom', 'left'].every((k) => (pad[k] ?? 0) >= w[k]);
  const inset = st.align !== 'OUTSIDE' && st.align !== 'CENTER' && !padOk && !(n.effects ?? []).some((e) => e.hex);
  if (inset) return `box-shadow: inset 0 0 0 ${w.top}px ${cssColor(top)} !important;`;
  return `border-color: ${cssColor(top)} !important;`;
}

function clearDecl(decl) {
  if (decl.startsWith('box-shadow')) return 'box-shadow: none !important;';
  if (decl.startsWith('border-color')) return 'border-color: transparent !important;';
  return '';
}

// Paint that differs between the resting item and the selected item.
// Text characters and svg files stay: those identify the item. Colour, stroke, and a
// check mark that exists only on the checked variant are the selected state.
function paintDiff(rest, on, { root = false } = {}) {
  const out = { rest: [], on: [] };
  if (!root && rest.type !== 'TEXT' && on.type !== 'TEXT') {
    const a = solidFill(rest);
    const b = solidFill(on);
    if (fillKey(a) !== fillKey(b)) {
      out.rest.push(`background-color: ${a ? cssColor(a) : 'transparent'} !important;`);
      out.on.push(`background-color: ${b ? cssColor(b) : 'transparent'} !important;`);
    }
  }
  if (rest.type === 'TEXT' && on.type === 'TEXT') {
    const a = solidFill(rest);
    const b = solidFill(on);
    if (a && b && fillKey(a) !== fillKey(b)) {
      out.rest.push(`color: ${cssColor(a)} !important;`);
      out.on.push(`color: ${cssColor(b)} !important;`);
    }
  }
  const aStroke = strokeDecl(rest);
  const bStroke = strokeDecl(on);
  if (aStroke !== bStroke) {
    out.rest.push(aStroke || clearDecl(bStroke));
    out.on.push(bStroke || clearDecl(aStroke));
  }
  out.rest = out.rest.filter(Boolean);
  out.on = out.on.filter(Boolean);
  return out.rest.length || out.on.length ? out : null;
}

export function markSettings(clone) {
  const settings = { _cssClasses: clone.className };
  if (clone.width > 0) settings._width = px(clone.width);
  if (clone.height > 0) settings._height = px(clone.height);
  return settings;
}

export function nodeAt(root, path) {
  let n = root;
  if (!path) return n ?? null;
  for (const part of String(path).split('-')) {
    n = shown(n)[Number(part)];
    if (!n) return null;
  }
  return n;
}

// `selector` is the class the component script toggles on the item (`.brx-open`, `.is-active`).
// The idle declarations sit on the item. The selected declarations sit on the item while that class is present.
export function activeLook(rest, on, selector = '.brx-open') {
  const css = [];
  const classes = [];
  const clones = [];
  const controls = [];
  const seen = new Set();
  const addCss = (decl, suffix) => {
    const key = `${suffix}|${decl}`;
    if (!decl || seen.has(key)) return;
    seen.add(key);
    css.push({ decl, suffix });
  };
  const walk = (a, b, path) => {
    if (!a || !b || a.svg || b.svg) return;
    const diff = paintDiff(a, b, { root: path === '' });
    if (diff) {
      const slot = path ? `f2b-s-${path}` : '';
      if (slot) classes.push({ path, className: slot });
      const idle = slot ? ` .${slot}` : '';
      const hot = slot ? `${selector} .${slot}` : selector;
      for (const decl of diff.rest) addCss(decl, idle);
      for (const decl of diff.on) addCss(decl, hot);
    }
    const ca = checkedValue(a);
    const cb = checkedValue(b);
    if (ca != null && cb != null && ca !== cb) {
      const blob = `${a.name ?? ''} ${a.component ?? ''} ${b.name ?? ''} ${b.component ?? ''}`;
      const role = /checkbox/i.test(blob) ? 'checkbox' : 'radio';
      controls.push({ path, role });
      const extra = (cb ? shown(b) : shown(a)).slice(Math.min(shown(a).length, shown(b).length));
      for (let i = 0; i < extra.length; i++) {
        const index = Math.min(shown(a).length, shown(b).length) + i;
        const markPath = path ? `${path}-${index}` : String(index);
        classes.push({ path: markPath, className: 'f2b-on' });
        clones.push({
          path: markPath,
          parentPath: path,
          like: extra[i].id,
          className: 'f2b-on',
          name: extra[i].svg ? 'svg' : 'block',
          label: extra[i].name || 'On',
          // `like` drops height on purpose (a copied answer is not the drawn line's height). The mark is a fixed shape.
          width: extra[i].box?.w,
          height: extra[i].box?.h,
        });
      }
      addCss('display: none !important;', ' .f2b-on');
      addCss('display: block !important;', `${selector} .f2b-on`);
    }
    const ak = shown(a);
    const bk = shown(b);
    const n = Math.min(ak.length, bk.length);
    for (let i = 0; i < n; i++) walk(ak[i], bk[i], path ? `${path}-${i}` : String(i));
  };
  walk(rest, on, '');
  return { css, classes, clones, controls };
}

function findNode(n, id) {
  if (!n) return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const hit = findNode(c, id); if (hit) return hit; }
  return null;
}

// Patches for sibling instances of one component set. `skipIds` are roots whose component
// already paints its own states (the whole subtree is left alone).
export function siblingStatePatches(root, skipIds = []) {
  const skip = new Set();
  const mark = (n) => { if (!n || skip.has(n.id)) return; skip.add(n.id); for (const c of n.children ?? []) mark(c); };
  for (const id of skipIds) mark(findNode(root, id));
  const patches = {};
  const addCss = (id, rule) => {
    const prev = patches[id] ?? {};
    patches[id] = { ...prev, css: [...(prev.css ?? []), rule] };
  };
  const addClass = (id, className) => {
    const prev = patches[id] ?? {};
    const settings = { ...(prev.settings ?? {}) };
    settings._cssClasses = [settings._cssClasses, className].filter(Boolean).join(' ');
    patches[id] = { ...prev, settings };
  };
  const addExtra = (id, clone) => {
    const prev = patches[id] ?? {};
    const child = { name: clone.name, label: clone.label, like: clone.like, settings: markSettings(clone) };
    const settings = { ...(prev.settings ?? {}) };
    settings._position ??= 'relative';
    patches[id] = { ...prev, settings, extraChildren: [...(prev.extraChildren ?? []), child] };
  };
  const walk = (n) => {
    if (!n || n.visible === false) return;
    const kids = (n.children ?? []).filter((c) => c.visible !== false && !skip.has(c.id));
    const groups = new Map();
    for (const k of kids) {
      if (!k.componentSet) continue;
      if (!groups.has(k.componentSet)) groups.set(k.componentSet, []);
      groups.get(k.componentSet).push(k);
    }
    for (const rows of groups.values()) {
      const rests = rows.filter((k) => !componentState(k) || componentState(k) === ComponentState.REST);
      const specials = rows.filter((k) => componentState(k) && componentState(k) !== ComponentState.REST);
      if (!rests.length || !specials.length) continue;
      const restFill = solidFill(rests[0]);
      for (const item of specials) {
        const fill = solidFill(item);
        if (!fill || fillKey(fill) === fillKey(restFill)) continue;
        const rule = { decl: `background-color: ${cssColor(fill)};`, suffix: STATE_SELECTOR[componentState(item)] };
        for (const member of rows) addCss(member.id, rule);
        const prev = patches[item.id] ?? {};
        patches[item.id] = {
          ...prev,
          dropSettings: [...new Set([...(prev.dropSettings ?? []), '_background'])],
          expectCss: { ...(prev.expectCss ?? {}), 'background-color': 'rgba(0, 0, 0, 0)' },
        };
      }
      for (const item of specials) {
        const sel = STATE_SELECTOR[componentState(item)];
        if (!sel.startsWith(':')) continue;
        const look = activeLook(rests[0], item, sel);
        for (const member of rows) {
          for (const rule of look.css) addCss(member.id, rule);
          for (const slot of look.classes) {
            const hit = nodeAt(member, slot.path);
            if (hit) addClass(hit.id, slot.className);
          }
          for (const clone of look.clones) {
            if (nodeAt(member, clone.path)) continue;
            const parent = nodeAt(member, clone.parentPath);
            if (parent) addExtra(parent.id, clone);
          }
        }
      }
    }
    for (const c of kids) walk(c);
  };
  walk(root);
  return patches;
}
