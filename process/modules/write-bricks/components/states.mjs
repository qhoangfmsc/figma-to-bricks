// One state enum for every component. The value is the designer's variant property `State`
// (or the variant name "State=Hover"), never a layer name.
// A sibling drawn in Hover / Active / Open / Focus / Disabled / Pressed is that state of the
// same component. Its extra paint is the state's selector. The resting look stays Default.
// Accordion, menu, and tabs paint their own open / active behaviour and are skipped here.
import { cssColor } from '../../write-bricks/render/utils/css.mjs';

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
    }
    for (const c of kids) walk(c);
  };
  walk(root);
  return patches;
}
