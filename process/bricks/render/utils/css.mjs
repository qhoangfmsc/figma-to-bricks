// Small value helpers shared by every render module. No Figma or Bricks knowledge here.
//   px / pct        number -> '12px' / '12%' (4 decimals max, so 1/3 does not turn into a 17-digit string)
//   colorObj        Figma color {hex, alpha} -> Bricks color object ({hex} or {hex, rgb})
//   cssColor        Figma color {hex, alpha} -> CSS color string
//   addCustomCss    append a declaration to the element's `_cssCustom` (Bricks "custom CSS" field)
export const r4 = (v) => Math.round(v * 10000) / 10000;
export const px = (v) => `${r4(v)}px`;
export const pct = (v) => `${r4(v)}%`;
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const colorObj = (c) => {
  if (c.alpha >= 1) return { hex: c.hex };
  const [r, g, b] = hex2rgb(c.hex);
  return { hex: c.hex, rgb: `rgba(${r}, ${g}, ${b}, ${c.alpha})` };
};
export const cssColor = (c) => (c.alpha >= 1 ? c.hex : `rgba(${hex2rgb(c.hex).join(', ')}, ${c.alpha})`);

// Several rules can target the same element: they are kept in one %root% block per selector suffix ('' or ':hover' …).
// %root% is replaced by the real `#brxe-<id>` selector when the element is emitted (index.mjs).
const blocks = new WeakMap(); // settings object -> Map(suffix -> [declarations]); never serialized
export function addCustomCss(s, decl, suffix = '') {
  const m = blocks.get(s) ?? blocks.set(s, new Map()).get(s);
  if (!m.has(suffix)) m.set(suffix, []);
  m.get(suffix).push(decl);
  s._cssCustom = [...m].map(([suf, list]) => `%root%${suf} { ${list.join(' ')} }`).join(' ');
}
