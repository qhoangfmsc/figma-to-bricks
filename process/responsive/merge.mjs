// Responsive merge: one Bricks template that carries the values of several Figma frames (the base frame and breakpoint variants).
// Owner decisions 2026-10-27 (see work/<file>/2112-19384/responsive-decisions.md): base = the widest frame, each variant frame is a Bricks
// breakpoint (tablet 768 -> tablet_portrait <=991px, mobile 375 -> mobile_portrait <=478px), exact numbers per frame, nodes that exist in one
// frame only stay in the tree and are hidden where Figma has none, a wrapper a variant dropped becomes `display: contents`.
//
// Input:  base { tree, template, mapping } and variants [{ key, maxWidth, tree, template, mapping, aliases }] (each built on its own with the
//         normal renderer, so components and decisions are applied the same way), sorted by maxWidth descending.
// Output: { template, mappings: { <key>: figma id -> { bricksId, element, expect… } }, warnings }
//
// How one element gets its breakpoint values:
//   * the Figma nodes are paired (match.mjs); a pair with the same Bricks element name is ONE element. Style settings (`_width`, `_padding`,
//     typography…) that differ from the wider frame are written as `<key>:<breakpoint>` (objects: only the sub-keys that changed). The mobile
//     frame is compared with the tablet frame when the element exists there (CSS cascades down), otherwise with the base.
//   * `_cssCustom` rules that differ are appended inside `@media (max-width: <maxWidth>px)`.
//   * content that a setting cannot swap per breakpoint (text, image, svg file, repeater rows) splits the pair into two elements, one shown per
//     frame; other content (link, tag, alt…) is never made responsive: a difference is reported, the base value stays.
//   * an element missing in a frame gets `display: none !important` in the width range of that frame (`display: contents` when a part of it
//     lives on in that frame, e.g. a wrapper the mobile design dropped). An element that exists only in a variant is added to the tree
//     (under the partner of its nearest paired ancestor, after its previous sibling) and hidden in the other ranges.
// Not supported (reported, never silently approximated): a setting present in the wider frame and absent in the variant (CSS cannot unset it),
//   a paired node whose parent changed to another paired node (moved between containers), different image / content per breakpoint.
import { matchTrees } from './match.mjs';

const NON_STYLE = new Set(['_cssId', '_cssClasses', '_attributes', '_hidden', '_cssCustom']);
const COMPONENT_STYLE = new Set(['typography', 'typographyPrefix', 'typographySuffix', 'gutter', 'iconGap', 'titleTypography', 'titleMargin', 'countTypography', 'prefixTypography', 'suffixTypography']);
const isStyleKey = (k) => (k.startsWith('_') && !NON_STYLE.has(k)) || COMPONENT_STYLE.has(k);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// content that cannot change per breakpoint through a setting: when these differ the two frames hold two elements (one hidden per range)
// semantic settings come from the base frame (decided once, never per breakpoint): a difference is not worth a warning or a split
const SEMANTIC_KEYS = new Set(['tag', 'customTag', 'altText', '_attributes', 'link', '_cssId', '_cssClasses', 'loading', 'label']);
const SPLIT_ON = ['image', 'file', 'icon', 'svg', 'text', 'fields', 'items'];
// what "absent" means in CSS: a variant that does not set a key the wider frame set gets the initial value instead of a warning
const ZERO_SIDES = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
// Bricks builds ONE css declaration out of these objects (box-shadow: values + color + inset): a breakpoint that holds only the changed sub-key (the new spread)
// makes `box-shadow: 0 0 0 .3153px` with no color and no inset, so the whole object is written whenever any part differs
const ONE_DECLARATION = new Set(['_boxShadow', '_textShadow', '_transform', '_gradient']);
const NEUTRAL = { _height: 'auto', _widthMax: 'none', _heightMax: 'none', _widthMin: '0px', _heightMin: '0px', _flexShrink: 1, _flexGrow: 0, _flexBasis: 'auto', _alignSelf: 'auto', _position: 'static', _left: 'auto', _top: 'auto', _right: 'auto', _bottom: 'auto', _overflow: 'visible', _border: { width: ZERO_SIDES, style: 'none' }, _padding: ZERO_SIDES, _margin: ZERO_SIDES };
const SUB_NEUTRAL = { 'white-space': 'normal', 'text-transform': 'none', 'text-decoration': 'none', 'font-style': 'normal', 'letter-spacing': 'normal', radius: ZERO_SIDES, width: ZERO_SIDES, style: 'none' }; // typography sub-keys a variant leaves out
const FLEX_ONLY = new Set(['_direction', '_justifyContent', '_alignItems', '_flexWrap', '_rowGap', '_columnGap']); // meaningless when the frame has no flex container

// `#brxe-x .field:not(:last-child)::after { a: b; }` -> Map(selector -> body)
function cssRules(text) {
  const out = new Map();
  for (const m of (text ?? '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.set(m[1].trim().replace(/\s+/g, ' '), m[2].trim().replace(/\s+/g, ' '));
  return out;
}
// 'a: b; c: d' -> Map(property -> value)
const decls = (body) => new Map(body.split(/;(?![^(]*\))/).map((d) => d.trim()).filter(Boolean).map((d) => { const i = d.indexOf(':'); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }));
// the declarations a narrower frame must write over the wider frame's rule: changed or new ones as they are, dropped ones as `unset`
// (initial value; CSS has no other way to take a declaration back)
function cssDelta(refBody, nextBody) {
  const a = decls(refBody ?? ''), b = decls(nextBody ?? '');
  const out = [];
  for (const [k, v] of b) if (a.get(k) !== v) out.push(`${k}: ${v};`);
  for (const k of a.keys()) if (!b.has(k)) out.push(`${k}: unset;`);
  return out.join(' ');
}
const cssText = (rules) => [...rules].map(([sel, body]) => `${sel} { ${body} }`).join(' ');

const mediaFor = (range) => {
  const parts = [];
  if (range.min != null) parts.push(`(min-width: ${range.min}px)`);
  if (range.max != null) parts.push(`(max-width: ${range.max}px)`);
  return parts.join(' and ');
};

export function mergeResponsive({ base, variants }) { // base.sig / variants[].sig: (assetFile) -> content signature (optional)
  const warnings = [];
  const warn = (node, msg) => warnings.push({ node: node?.id ?? '-', name: node?.name ?? '-', msg });
  const sorted = [...variants].sort((a, b) => b.maxWidth - a.maxWidth);

  // width ranges: base is everything above the first variant, variant i runs from the next variant's max + 1 up to its own max
  const ranges = [{ key: 'base', min: sorted[0].maxWidth + 1 }, ...sorted.map((v, i) => ({ key: v.key, max: v.maxWidth, ...(sorted[i + 1] && { min: sorted[i + 1].maxWidth + 1 }) }))];

  const composite = base.template.content.map((e) => ({ ...e, settings: structuredCloneSafe(e.settings) }));
  const elById = new Map(composite.map((e) => [e.id, e]));
  const baseElOf = (fid) => { const id = base.mapping[fid]?.bricksId; return id ? elById.get(id) : null; };
  const exists = new Map(composite.map((e) => [e.id, new Set(['base'])])); // element id -> keys of the frames that have it
  const orig = new Map(composite.map((e) => [e.id, structuredCloneSafe(e.settings)])); // base values before any breakpoint key is added
  const effective = new Map(composite.map((e) => [e.id, { settings: withSignatures(structuredCloneSafe(e.settings), base.sig), css: cssRules(e.settings._cssCustom) }])); // settings carry content signatures for assets // values of the previous (wider) frame
  const baseCss = new Map(composite.map((e) => [e.id, cssRules(e.settings._cssCustom)]));
  const media = new Map(); // element id -> [{ range, selector, body }]
  const addMedia = (id, range, selector, body) => { if (!media.has(id)) media.set(id, []); media.get(id).push({ range, selector, body }); };
  const mappings = {};
  const variantOnly = []; // { variant, el, node }

  for (const v of sorted) {
    const range = ranges.find((r) => r.key === v.key);
    const { pairs } = matchTrees(base.tree, v.tree, { aliases: v.aliases });
    const vNode = new Map(); (function rec(n) { vNode.set(n.id, n); (n.children ?? []).forEach(rec); })(v.tree);
    // Elements Bricks needs that Figma does not draw (the content block of a closed FAQ item) are keyed "<host node>#extraN" and are not in the tree: they follow their
    // host node, so the base frame and the variant frame share ONE element instead of getting one each.
    for (const [vFid, bFid] of [...pairs]) {
      for (const k of Object.keys(v.mapping)) {
        if (!k.startsWith(`${vFid}#extra`)) continue;
        const bKey = bFid + k.slice(vFid.length);
        if (base.mapping[bKey]?.bricksId) { pairs.set(k, bKey); vNode.set(k, vNode.get(vFid)); }
      }
    }
    const vParent = new Map(); (function rec(n) { for (const c of n.children ?? []) { vParent.set(c.id, n); rec(c); } })(v.tree);
    const vElOf = (fid) => { const id = v.mapping[fid]?.bricksId; return id ? v.template.content.find((e) => e.id === id) : null; };
    const vMap = {};
    const pairedBase = new Set(pairs.values());
    const baseParent = new Map(); (function rec(n) { for (const c of n.children ?? []) { baseParent.set(c.id, n.id); rec(c); } })(base.tree);
    const pairedEl = new Map(); // variant element id -> base element

    for (const [vFid, bFid] of pairs) {
      const vEl = vElOf(vFid);
      const bEl = baseElOf(bFid);
      if (!vEl || !bEl) continue;
      if (vEl.name !== bEl.name) { warn(vNode.get(vFid), `${v.key}: element is "${vEl.name}" here and "${bEl.name}" in the base frame: kept as two elements, one per frame`); continue; }
      const aSig = withSignatures(orig.get(bEl.id), base.sig), bSig = withSignatures(vEl.settings, v.sig);
      const split = SPLIT_ON.filter((k) => !same(aSig[k], bSig[k]));
      if (split.length) { warn(vNode.get(vFid), `${v.key}: ${split.join(', ')} differs from the base frame (a setting cannot swap it per breakpoint): two elements, one shown per frame`); continue; }
      pairedEl.set(vEl.id, bEl);
      exists.get(bEl.id).add(v.key);
      vMap[vFid] = { ...v.mapping[vFid], bricksId: bEl.id };

      // ---- values
      const ref = effective.get(bEl.id);
      const next = structuredCloneSafe(vEl.settings);
      const nextCss = cssRules(String(next._cssCustom ?? '').replaceAll(`#brxe-${vEl.id}`, `#brxe-${bEl.id}`));
      const nodeForWarn = vNode.get(vFid);
      for (const k of new Set([...Object.keys(ref.settings), ...Object.keys(next)])) {
        if (k === '_cssCustom' || k.includes(':')) continue;
        const a = ref.settings[k];
        let b = next[k];
        if (same(a, withSignatures(b, v.sig))) continue;
        if (SEMANTIC_KEYS.has(k)) continue;
        if (!isStyleKey(k)) { warn(nodeForWarn, `${v.key}: "${k}" differs from the wider frame (content cannot change per breakpoint): base value kept`); continue; }
        if (b === undefined) {
          if (FLEX_ONLY.has(k)) continue;
          if (!(k in NEUTRAL)) { warn(nodeForWarn, `${v.key}: "${k}" is set in the wider frame and absent here: CSS cannot unset it`); continue; }
          b = NEUTRAL[k];
        }
        if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b) && !ONE_DECLARATION.has(k)) {
          const diff = Object.fromEntries(Object.entries(b).filter(([sk, sv]) => !same(a[sk], sv)));
          for (const sk of Object.keys(a)) {
            if (sk in b) continue;
            if (sk in SUB_NEUTRAL) diff[sk] = SUB_NEUTRAL[sk];
            else warn(nodeForWarn, `${v.key}: "${k}.${sk}" is set in the wider frame and absent here: CSS cannot unset it`);
          }
          if (Object.keys(diff).length) bEl.settings[`${k}:${v.key}`] = diff;
        } else bEl.settings[`${k}:${v.key}`] = b;
      }
      // the Bricks control `_alignSelf: stretch` also writes `width: 100%` (see render/size.mjs): taking `stretch` away at a breakpoint without a width of its own
      // leaves the 100% behind, so the element stays as wide as its parent (Certificate mobile: a 124px counter became 319px)
      if (bEl.settings._alignSelf === 'stretch' && `_alignSelf:${v.key}` in bEl.settings && bEl.settings[`_alignSelf:${v.key}`] !== 'stretch' && !(`_width:${v.key}` in bEl.settings)) bEl.settings[`_width:${v.key}`] = 'auto';
      for (const sel of new Set([...ref.css.keys(), ...nextCss.keys()])) {
        const delta = cssDelta(ref.css.get(sel), nextCss.get(sel));
        if (delta) addMedia(bEl.id, range, sel, delta);
      }
      // parent check: a node moved into another PAIRED container cannot be reproduced by CSS (a dropped wrapper is fine: it becomes `contents`)
      const vp = vParent.get(vFid);
      const wantParent = vp && pairs.get(vp.id);
      const haveParent = baseParent.get(bFid);
      if (wantParent && haveParent && wantParent !== haveParent && pairedBase.has(haveParent)) warn(nodeForWarn, `${v.key}: the parent changed to another paired container (moved): the layout may differ`);
      // what the next (narrower) frame is compared with
      effective.set(bEl.id, { settings: { ...ref.settings, ...withSignatures(next, v.sig) }, css: nextCss });
    }
    mappings[v.key] = vMap;

    // variant-only elements: whatever has no partner. Top-most ones are inserted into the composite tree.
    const idMap = new Map(); // variant element id -> composite element (paired) or itself (new)
    for (const [vid, bEl] of pairedEl) idMap.set(vid, bEl);
    const newEls = v.template.content.filter((e) => !pairedEl.has(e.id));
    for (const e of newEls) idMap.set(e.id, e);
    const vById = new Map(v.template.content.map((e) => [e.id, e]));
    for (const e of newEls) {
      const copy = { ...e, settings: structuredCloneSafe(e.settings), parent: e.parent };
      idMap.set(e.id, copy);
      composite.push(copy);
      elById.set(copy.id, copy);
      exists.set(copy.id, new Set([v.key]));
      baseCss.set(copy.id, cssRules(copy.settings._cssCustom));
      variantOnly.push({ variant: v.key, el: copy });
    }
    // parents: a new element whose variant parent is paired hangs under its partner; a new element under a new element keeps that parent
    for (const e of newEls) {
      const copy = idMap.get(e.id);
      const parentPartner = e.parent === 0 || e.parent === '0' ? null : idMap.get(e.parent);
      copy.parent = parentPartner ? parentPartner.id : (base.template.content[0]?.parent ?? 0);
    }
    // order: after the previous sibling of the variant's own tree (paired or new), else first
    const children = new Map();
    for (const e of v.template.content) { if (!children.has(e.parent)) children.set(e.parent, []); children.get(e.parent).push(e); }
    for (const e of newEls) {
      if (!pairedEl.has(e.parent) && !newEls.some((x) => x.id === e.parent)) continue;
      const sibs = children.get(e.parent) ?? [];
      const i = sibs.indexOf(e);
      const prev = sibs.slice(0, i).reverse().map((s) => idMap.get(s.id)).find(Boolean);
      const copy = idMap.get(e.id);
      composite.splice(composite.indexOf(copy), 1);
      if (!prev) { const first = composite.findIndex((x) => x.parent === copy.parent); composite.splice(first >= 0 ? first : composite.length, 0, copy); continue; }
      let at = composite.indexOf(prev) + 1;
      const inSubtree = (x, rootId) => { for (let p = x.parent; p; p = elById.get(p)?.parent) if (p === rootId) return true; return false; };
      while (at < composite.length && inSubtree(composite[at], prev.id)) at++;
      composite.splice(at, 0, copy);
    }
    // mapping of variant-only nodes
    for (const [fid, m] of Object.entries(v.mapping)) if (m.bricksId && !vMap[fid]) vMap[fid] = m;
  }

  // ---- hide / contents in the ranges where an element does not exist
  const hideNone = new Map(); // element id -> keys of the ranges where it is hidden (display: none)
  const kids = new Map();
  for (const e of composite) { if (!kids.has(e.parent)) kids.set(e.parent, []); kids.get(e.parent).push(e); }
  const subtreeExists = (e, key) => exists.get(e.id)?.has(key) || (kids.get(e.id) ?? []).some((c) => subtreeExists(c, key));
  for (const e of composite) {
    const parent = elById.get(e.parent);
    for (const r of ranges) {
      if (exists.get(e.id).has(r.key)) continue;
      const parentGone = parent && !exists.get(parent.id).has(r.key);
      // the parent hides it, unless the parent only became `display: contents` (it keeps a partner below it): then this element hides itself
      const parentHides = parentGone && !(kids.get(parent.id) ?? []).some((c) => subtreeExists(c, r.key));
      if (parentHides && !(kids.get(e.id) ?? []).some((c) => subtreeExists(c, r.key))) continue;
      const keepsChildren = (kids.get(e.id) ?? []).some((c) => subtreeExists(c, r.key));
      if (keepsChildren) addMedia(e.id, r, `body #brxe-${e.id}`, 'display: contents;'); // `body #id` out-ranks the element's own `#id { display }` without !important; Bricks has no `contents` option
      else (hideNone.get(e.id) ?? hideNone.set(e.id, new Set()).get(e.id)).add(r.key);
    }
  }
  // Hidden in the narrowest frame(s) (a run of ranges from the narrowest up) = the Bricks attribute `_display: none` at the widest of those breakpoints (it cascades down);
  // any other range (hidden on the wide frame, or a middle range only) has no attribute that says so: css
  const narrowToWide = [...sorted].reverse().map((v) => v.key);
  for (const [id, keys] of hideNone) {
    let j = 0;
    while (j < narrowToWide.length && keys.has(narrowToWide[j])) j++;
    if (j) elById.get(id).settings[`_display:${narrowToWide[j - 1]}`] = 'none';
    for (const k of keys) if (!narrowToWide.slice(0, j).includes(k)) addMedia(id, ranges.find((r) => r.key === k), `body #brxe-${id}`, 'display: none;');
  }

  // An image that is hidden at some widths must not be downloaded there: a hidden image with loading=eager is still fetched, a lazy one is not.
  for (const e of composite) {
    if (e.name === 'image' && ranges.some((r) => !exists.get(e.id).has(r.key))) e.settings.loading = 'lazy';
  }

  // ---- write the css
  for (const e of composite) {
    const list = media.get(e.id);
    if (!list?.length) continue;
    const byRange = new Map();
    for (const m of list) { const q = mediaFor(m.range); if (!byRange.has(q)) byRange.set(q, []); byRange.get(q).push(`${m.selector} { ${m.body} }`); }
    const blocks = [...byRange].map(([q, rules]) => `@media ${q} { ${rules.join(' ')} }`);
    e.settings._cssCustom = [cssText(baseCss.get(e.id) ?? new Map()), ...blocks].filter(Boolean).join(' ');
  }

  return { template: { ...base.template, content: composite }, mappings, warnings };
}

// settings with every { $asset: file } replaced by a signature of the file's content, so the same picture under two names compares equal
function withSignatures(v, sig) {
  if (Array.isArray(v)) return v.map((x) => { const { id, ...row } = x && typeof x === 'object' && !Array.isArray(x) ? x : { id: undefined, value: x }; return typeof x === 'object' && !Array.isArray(x) ? withSignatures(row, sig) : withSignatures(x, sig); }); // repeater row ids are salted per frame: not content
  if (v && typeof v === 'object') {
    if (typeof v.$asset === 'string') return { ...v, $asset: sig ? sig(v.$asset) : v.$asset };
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withSignatures(x, sig)]));
  }
  return v;
}

function structuredCloneSafe(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
