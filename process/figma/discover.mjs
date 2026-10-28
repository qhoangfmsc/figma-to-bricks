// Finds the other breakpoint frames of a section: given the node id of a section in one breakpoint frame (e.g. "Hero / Section" inside the 1440
// frame), looks for the same-named section inside sibling frames of other widths (768, 375). Reads the file structure only (depth 5).
import { figmaGet } from './api.mjs';

const num = (n) => Math.round(n?.absoluteBoundingBox?.width ?? 0);

// The visible opaque solid fill of a frame, as "#rrggbb" (what shows behind a transparent section placed in it), or null
export function frameBackground(frame) {
  const f = [...(frame?.fills ?? [])].reverse().find((x) => x.visible !== false && x.type === 'SOLID' && (x.opacity ?? 1) >= 1 && (x.color?.a ?? 1) >= 1);
  if (!f) return null;
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(f.color.r)}${h(f.color.g)}${h(f.color.b)}`;
}

export async function discoverVariants(fileKey, nodeId) {
  const file = await figmaGet(`/v1/files/${fileKey}?depth=5`);
  // path from the document to the node
  let path = null;
  (function rec(n, trail) {
    if (path) return;
    if (n.id === nodeId) { path = [...trail, n]; return; }
    for (const c of n.children ?? []) rec(c, [...trail, n]);
  })(file.document, []);
  if (!path) throw new Error(`node ${nodeId} not found in the file structure (depth 5)`);
  const node = path.at(-1);
  const baseWidth = num(node);
  // nearest ancestor frame that has sibling frames of other widths holding a section with the same name
  for (let i = path.length - 2; i >= 1; i--) {
    const frame = path[i], parent = path[i - 1];
    const found = [];
    for (const sib of parent.children ?? []) {
      if (sib.id === frame.id || sib.type !== 'FRAME') continue;
      const match = [...(sib.children ?? []), ...(sib.children ?? []).flatMap((c) => c.children ?? [])].find((c) => c.name === node.name && c.type === 'FRAME');
      if (match) found.push({ id: match.id, width: num(match), frame: sib.name, bg: frameBackground(sib) });
    }
    if (found.length) {
      const pick = (lo, hi, key, canon) => {
        const c = found.filter((f) => f.width >= lo && f.width <= hi).sort((a, b) => Math.abs(a.width - canon) - Math.abs(b.width - canon))[0];
        return c ? { key, maxWidth: key === 'tablet_portrait' ? 991 : 478, ...c } : null;
      };
      return { base: { id: node.id, width: baseWidth, frame: frame.name, bg: frameBackground(frame) }, variants: [pick(480, 991, 'tablet_portrait', 768), pick(1, 478, 'mobile_portrait', 375)].filter(Boolean), others: found.filter((f) => f.width >= 992).map((f) => `${f.frame} ${f.width}px`) };
    }
  }
  return { base: { id: node.id, width: baseWidth }, variants: [], others: [] };
}

// ---- which sections does a link contain? (page mode of auto.mjs)
// A link can point to: a canvas Section holding breakpoint frames (desktop 1440 / tablet / mobile, each a stack of section frames), one breakpoint frame
// (a stack of section frames), or a single section frame. Returns the section frames of the BASE breakpoint frame (the one closest to 1440), top to
// bottom, so that each one is built as its own template and its tablet / mobile twins are found by discoverVariants.
export async function discoverSections(fileKey, nodeId) {
  const file = await figmaGet(`/v1/files/${fileKey}?depth=5`);
  let node = null, path = [];
  (function rec(n, trail) { if (node) return; if (n.id === nodeId) { node = n; path = [...trail, n]; return; } (n.children ?? []).forEach((c) => rec(c, [...trail, n])); })(file.document, []);
  if (!node) throw new Error(`node ${nodeId} not found in the file structure`);
  const frames = (n) => (n.children ?? []).filter((c) => ['FRAME', 'INSTANCE', 'COMPONENT'].includes(c.type));
  const isStack = (f) => { const w = num(f); return frames(f).filter((c) => num(c) >= 0.9 * w && (c.absoluteBoundingBox?.height ?? 0) >= 40).length >= 3; };
  const sectionsOf = (frame) => {
    const w = num(frame);
    return frames(frame).filter((c) => num(c) >= 0.9 * w && (c.absoluteBoundingBox?.height ?? 0) >= 40)
      .sort((a, b) => (a.absoluteBoundingBox?.y ?? 0) - (b.absoluteBoundingBox?.y ?? 0))
      .map((c) => ({ id: c.id, name: c.name, width: num(c), height: Math.round(c.absoluteBoundingBox?.height ?? 0) }));
  };
  let kind = 'section', base = node, sections = [{ id: node.id, name: node.name, width: num(node), height: Math.round(node.absoluteBoundingBox?.height ?? 0) }];
  const stacks = frames(node).filter(isStack);
  if (stacks.length >= 2 || (node.type === 'SECTION' && stacks.length >= 1)) {
    // breakpoint frames: the one closest to 1440 inside 1100..1700, else the widest up to 1920
    const inRange = stacks.filter((f) => num(f) >= 1100 && num(f) <= 1700).sort((a, b) => Math.abs(num(a) - 1440) - Math.abs(num(b) - 1440));
    base = inRange[0] ?? stacks.filter((f) => num(f) <= 1920).sort((a, b) => num(b) - num(a))[0] ?? stacks[0];
    kind = 'page'; sections = sectionsOf(base);
  } else if (isStack(node)) { kind = 'breakpoint-frame'; sections = sectionsOf(node); }
  // h1 belongs to the hero (or, without one, to the first section that is not a menu / header)
  // (a link to one single section only gets the h1 when it IS a hero: the page's one h1 is not that section's to take)
  const hero = kind === 'section' ? sections.find((s) => /hero/i.test(s.name)) : sections.find((s) => /hero/i.test(s.name)) ?? sections.find((s) => !/menu|header|nav/i.test(s.name)) ?? sections[0];
  return { kind, base: { id: base.id, name: base.name, width: num(base), bg: kind === 'section' ? frameBackground(path.at(-2)) : frameBackground(base) }, sections: sections.map((s) => ({ ...s, firstSection: s.id === hero?.id })) };
}

// ---- error messages of form fields (drawn next to the page, outside the section frames)
// The designer draws a field in its error state as "Form field / X / Error" with a text "Error message / X" under it, as a sibling of the page frames.
// Returns { x (lower case): { text, node, style, gap } } for every X that has exactly one such text (a clash with different texts is dropped: no guessing).
export async function discoverFormErrors(fileKey, nodeId) {
  const file = await figmaGet(`/v1/files/${fileKey}?depth=5`);
  let scope = null;
  (function rec(n, trail) {
    if (scope) return;
    if (n.id === nodeId) { scope = [...trail].reverse().find((a) => a.type === 'SECTION') ?? trail[1] ?? file.document; return; }
    (n.children ?? []).forEach((c) => rec(c, [...trail, n]));
  })(file.document, []);
  const found = {};
  (function walk(n, parent) {
    const m = n.type === 'TEXT' && /^Error message\s*\/\s*(.+)$/i.exec(n.name ?? '');
    if (m && n.characters?.trim()) {
      const fill = (n.fills ?? []).filter((f) => f.visible !== false && f.type === 'SOLID').pop();
      const hex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
      (found[m[1].trim().toLowerCase()] ??= []).push({
        text: n.characters.trim(), node: n.id, gap: parent?.itemSpacing ?? 0,
        style: { fontFamily: n.style?.fontFamily, fontSize: n.style?.fontSize, fontWeight: n.style?.fontWeight, lineHeightPx: n.style?.lineHeightPx, letterSpacing: n.style?.letterSpacing || 0, color: fill ? `#${hex(fill.color.r)}${hex(fill.color.g)}${hex(fill.color.b)}` : null, alpha: fill ? (fill.opacity ?? 1) * (fill.color.a ?? 1) : 1 },
      });
    }
    (n.children ?? []).forEach((c) => walk(c, n));
  })(scope ?? file.document, null);
  const out = {};
  for (const [k, list] of Object.entries(found)) if (new Set(list.map((e) => e.text)).size === 1) out[k] = list[0];
  return out;
}
