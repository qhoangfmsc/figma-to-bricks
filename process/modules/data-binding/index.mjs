// Data binding: a Figma section whose words and repeats come from a data source on the site
// (a Bricks query loop type plus dynamic tags a plugin registers). The drawing gives the look of ONE item;
// the source gives how many there are and what they say.
//
// The owner names the source in the chat. The chat writes `bind.json` in the frame workspace from the
// source's own listing (query types and tags) and from node ids that exist in tree.md. Nothing here guesses a tag.
//
// bind.json
//   source    text, where the listing came from (endpoint, table id)
//   provider  { queries: [{ kind, type }], tags: [{ tag, needs: [kind] }] }  copied from the source listing
//   loops     [{ node, query, drop: [node], reason }]   node repeats once per source item; drop = the drawn copies
//   text      [{ node, value | runs: [..], reason }]    words of a TEXT node, replaced after render; runs keep each drawn style run
//   links     [{ node, tag, reason }]                   link of a button / link element (Bricks link type "meta")
//   attrs     [{ node, name, value, reason }]           custom attribute (Bricks renders dynamic data in it)
//   icons     [{ node, tag | className, paintFrom, reason }]       the drawn icon becomes <i class="{tag}"> at the same box; className:
//                                                       a fixed icon class for a glyph Figma has no picture of (a layer
//                                                       hidden in every instance)
//   hideEmpty [{ node, tag, reason }]                   element shows only when the tag is not empty (_conditions)
//   show      [{ node, reason }]                        a layer the component holds but this instance hides (the
//                                                       source fills it; pair it with hideEmpty)
//   hoverShow [{ node, trigger, transition, anchor, pointer, reason }]
//                                                       a layer (a tooltip the component holds hidden) that shows while
//                                                       the trigger layer is hovered. transition: 'Ns easing' from
//                                                       Figma, or none. Figma draws no state for it: the owner names it.
//                                                       anchor: true moves the layer next to the trigger (into the
//                                                       trigger's parent, pinned to the parent edge the trigger sits on),
//                                                       so it follows the trigger when the source words change widths.
//                                                       pointer: the layer's arrow, centred on the trigger
//                                                       flipUp: a row loop; on its last row (and the last row a
//                                                       closed group shows) the layer opens above the trigger
//                                                       copy: the layer is drawn in another frame only; a copy goes
//                                                       under the trigger's parent, at its left padding
//                                                       A layer that hugs in Figma hugs the source words
//   stateOn   [{ node, trigger, className, hide, text, icon, reason }]
//                                                       a state a script sets as a class on the trigger (a copy button
//                                                       gets `is-copied`): inside node, the hide layers go, a text made
//                                                       like text.like says text.value, an icon made like icon.like shows
//                                                       icon.className (glyph size / colour / box paint from Figma)
//   onlyAt    [{ node, loop, index, mode, reason }]     a layer the drawing shows on one repeated item only (index from 0).
//                                                       mode 'hide' (default): gone on the other items. mode 'box': on
//                                                       the other items only its box goes (display: contents), its
//                                                       children stay: the frame the drawing puts around one featured
//                                                       item (a ribbon band around the popular card)
//   twin      [{ node, loop, index, reason }]           a drawn copy of a looped item with its own look (the featured
//                                                       column): it loops the same source and shows only at its drawn
//                                                       position (counted among the loop's drawn copies); the plain
//                                                       item hides there. Order is kept with flex `order`. index
//                                                       (from 0): the owner names another position than the drawn one
//   collapse  [{ node, rows, keep, more, less, className, open, reason }]
//                                                       a looped group shows its first `keep` looped rows until a script
//                                                       sets className on it; `more` shows while closed, `less` while
//                                                       open, both go when the group has no more rows. `open`: group
//                                                       positions (from 0) the drawing shows open, without either control
//   columns   [{ node, mode, reason }]                  looped columns of a row. 'share': from their drawn width they
//                                                       grow / shrink with the row's other drawn columns (a source with
//                                                       more items than the drawing stays inside the row). 'scroll':
//                                                       each keeps at least its drawn width and grows to fill the row
//   slider    [{ node, pin, reason }]                   the frame scrolls sideways when its rows grow past it (columns
//                                                       'scroll'); each row is as wide as its content; pin layers (a
//                                                       label that spans the frame) stay in view at the frame width
//
// Bricks 1.12.3: `hasLoop` + `query.objectType` (includes/query.php), link type `meta` reads `useDynamicData`
// (elements/base.php set_link_attributes), custom attributes merge into `class` since 1.11.1, conditions key
// `dynamic_data` (includes/conditions.php).

// Position among the clones of one loop, written with sibling combinators only. `:nth-child(3 of .x)` is valid
// CSS, but a CSS minifier on the site (LiteSpeed) joins "3 of" into "3of" and the browser drops the rule.
const from = (id, k) => Array.from({ length: k }, () => `.brxe-${id}`).join(' ~ '); // the k-th clone and later
const at = (id, k) => `${from(id, k)}:not(${from(id, k + 1)})`; // exactly the k-th clone
const notAt = (id, k) => `:is(.brxe-${id}:not(${from(id, k)}), ${from(id, k + 1)})`; // every clone but the k-th

const TAG = /\{([a-z][a-z0-9_]*)((?::[^{}:]+)*)\}/gi;
const LISTS = ['loops', 'text', 'links', 'attrs', 'icons', 'hideEmpty', 'show', 'onlyAt', 'hoverShow', 'stateOn', 'twin', 'collapse', 'columns', 'slider'];

export function tagsIn(value) {
  return [...String(value ?? '').matchAll(TAG)].map((m) => ({ raw: m[0], name: m[1], args: m[2] ? m[2].slice(1).split(':') : [] }));
}

// Throws on anything the source does not list or the tree does not have. Returns the tag rows used.
export function validateBinding(bind, hasNode) {
  if (!bind || typeof bind !== 'object') throw new Error('bind.json must be an object');
  if (!String(bind.source ?? '').trim()) throw new Error('bind.json needs source: where the query types and tags were listed');
  const queries = new Map((bind.provider?.queries ?? []).map((q) => [q.type, q]));
  const tags = new Map((bind.provider?.tags ?? []).map((t) => [String(t.tag).replace(/[{}]/g, ''), t]));
  if (!queries.size || !tags.size) throw new Error('bind.json needs provider.queries and provider.tags copied from the source');
  const used = [];
  const needTag = (value, where) => {
    const found = tagsIn(value);
    for (const t of found) {
      if (!tags.has(t.name)) throw new Error(`${where}: ${t.raw} is not a tag of ${bind.source}`);
      used.push({ ...t, where });
    }
    return found;
  };
  for (const list of LISTS) {
    for (const [i, row] of (bind[list] ?? []).entries()) {
      const where = `${list}[${i}] ${row?.node ?? ''}`;
      if (!row?.node) throw new Error(`${where}: node is missing`);
      if (!String(row.reason ?? '').trim()) throw new Error(`${where}: reason is missing`);
      if (!hasNode(row.node)) throw new Error(`${where}: node is not in the tree`);
      if (list === 'loops') {
        if (!queries.has(row.query)) throw new Error(`${where}: ${row.query} is not a query type of ${bind.source}`);
        for (const d of row.drop ?? []) if (!hasNode(d)) throw new Error(`${where}: drop ${d} is not in the tree`);
      } else if (list === 'text') {
        const parts = Array.isArray(row.runs) ? row.runs : [row.value];
        if (parts.some((p) => typeof p !== 'string')) throw new Error(`${where}: value or runs must be text`);
        if (!parts.some((p) => tagsIn(p).length)) throw new Error(`${where}: no tag in the text`);
        parts.forEach((p) => needTag(p, where));
      } else if (list === 'show') {
        continue;
      } else if (list === 'hoverShow') {
        if (!row.trigger || !hasNode(row.trigger)) throw new Error(`${where}: trigger is not in the tree`);
        if (row.transition != null && !/^\d+(\.\d+)?s [a-z-]+$/.test(row.transition)) throw new Error(`${where}: transition is "<seconds>s <easing>"`);
        if (row.pointer != null && !hasNode(row.pointer)) throw new Error(`${where}: pointer is not in the tree`);
        if (typeof row.anchor === 'string' && !hasNode(row.anchor)) throw new Error(`${where}: anchor is true or the node the layer is drawn beside`);
        if (row.flipUp != null && !(bind.loops ?? []).some((l) => l.node === row.flipUp)) throw new Error(`${where}: flipUp is a row loop`);
      } else if (list === 'stateOn') {
        if (!row.trigger || !hasNode(row.trigger)) throw new Error(`${where}: trigger is not in the tree`);
        if (!/^[a-z][a-z0-9-]*$/i.test(row.className ?? '')) throw new Error(`${where}: className`);
        for (const h of row.hide ?? []) if (!hasNode(h)) throw new Error(`${where}: hide ${h} is not in the tree`);
        if (row.text && (!hasNode(row.text.like) || !String(row.text.value ?? '').trim())) throw new Error(`${where}: text needs like and value`);
        if (row.text && /[{}]/.test(row.text.value)) throw new Error(`${where}: text.value is plain words`);
        if (row.icon && (!hasNode(row.icon.like) || !/^[a-z0-9 -]+$/i.test(row.icon.className ?? ''))) throw new Error(`${where}: icon needs like and className`);
      } else if (list === 'onlyAt') {
        if (!(bind.loops ?? []).some((l) => l.node === row.loop)) throw new Error(`${where}: loop ${row.loop} is not in loops`);
        if (!Number.isInteger(row.index) || row.index < 0) throw new Error(`${where}: index from 0`);
        if (row.mode != null && !['hide', 'box'].includes(row.mode)) throw new Error(`${where}: mode is hide or box`);
      } else if (list === 'twin') {
        const loop = (bind.loops ?? []).find((l) => l.node === row.loop);
        if (!loop) throw new Error(`${where}: loop ${row.loop} is not in loops`);
        if ((loop.drop ?? []).includes(row.node)) throw new Error(`${where}: a twin is not a dropped copy`);
        if (row.index != null && (!Number.isInteger(row.index) || row.index < 0)) throw new Error(`${where}: index from 0`);
      } else if (list === 'collapse') {
        const loops = new Set((bind.loops ?? []).map((l) => l.node));
        if (!loops.has(row.node) || !loops.has(row.rows)) throw new Error(`${where}: node and rows are loops`);
        if (!Number.isInteger(row.keep) || row.keep < 1) throw new Error(`${where}: keep is the number of rows shown closed`);
        for (const k of ['more', 'less']) if (row[k] != null && !hasNode(row[k])) throw new Error(`${where}: ${k} is not in the tree`);
        if (!/^[a-z][a-z0-9-]*$/i.test(row.className ?? '')) throw new Error(`${where}: className`);
        if ((row.open ?? []).some((i) => !Number.isInteger(i) || i < 0)) throw new Error(`${where}: open positions from 0`);
      } else if (list === 'columns') {
        if (!(bind.loops ?? []).some((l) => l.node === row.node)) throw new Error(`${where}: columns are a loop`);
        if (!['share', 'scroll'].includes(row.mode)) throw new Error(`${where}: mode is share or scroll`);
      } else if (list === 'slider') {
        for (const pin of row.pin ?? []) if (!hasNode(pin)) throw new Error(`${where}: pin ${pin} is not in the tree`);
      } else if (list === 'icons' && (row.className != null || row.paintFrom != null)) {
        if (row.className != null && !/^[a-z0-9 -]+$/i.test(row.className)) throw new Error(`${where}: className`);
        if (row.paintFrom != null && !hasNode(row.paintFrom)) throw new Error(`${where}: paintFrom is not in the tree`);
        if (row.className == null && !needTag(row.tag, where).length) throw new Error(`${where}: tag is missing`);
      } else if (list === 'attrs') {
        if (!/^[a-z][a-z0-9-]*$/i.test(row.name ?? '')) throw new Error(`${where}: attribute name`);
        needTag(row.value, where);
      } else if (!needTag(row.tag, where).length) {
        throw new Error(`${where}: tag is missing`);
      }
    }
  }
  return used;
}

const findNode = (n, id) => {
  if (!n) return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
};

// Before render: a layer the component holds but this instance hides is built (render skips hidden layers).
export function showDrawnLayers(tree, bind) {
  let shown = 0;
  for (const row of bind?.show ?? []) {
    const n = findNode(tree, row.node);
    if (!n) continue;
    if (n.visible !== false) throw new Error(`show ${row.node}: the layer is not hidden in Figma`);
    n.visible = true;
    shown++;
    // A layer hidden in this instance keeps the component's defaults: its overrides (colour of a link, the picture of
    // an icon-font glyph; Figma exports no picture of a hidden layer) are only drawn where the same component layer
    // is visible in another instance. The shown copy takes that paint.
    const pathOf = (x) => String(x.id).split(';').slice(1).join(';');
    const borrow = (d) => {
      const path = pathOf(d);
      if (path) {
        let seen = null;
        (function seek(x) { if (!seen && x !== d && x.visible !== false && pathOf(x) === path && (x.svg || x.fills)) seen = x; if (!seen) (x.children ?? []).forEach(seek); })(tree);
        if (seen) {
          for (const k of ['fills', 'stroke', 'effects']) if (seen[k] !== undefined) d[k] = structuredClone(seen[k]);
          if (!d.svg && seen.svg) d.svg = { ...seen.svg };
        }
      }
      (d.children ?? []).forEach(borrow);
    };
    borrow(n);
  }
  return shown;
}

// The drawn words as render wrote them (render/index.mjs esc): the needle to find inside settings.text.
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([^\s])\r?\n/g, '$1 <br>').replace(/\r?\n/g, '<br>');

// After render: the drawn words become the tags. Recognition ran on the drawn words, so a tab title is still a title.
// Each drawn style run is replaced in place, so its span (bold label, coloured code) stays.
function bindText(el, row, text) {
  const drawn = Array.isArray(row.runs) ? (text.runs ?? []).map((r) => r.text) : [text.characters];
  const parts = Array.isArray(row.runs) ? row.runs : [row.value];
  if (drawn.length !== parts.length) throw new Error(`text ${row.node}: Figma has ${drawn.length} style run(s), bind.json gives ${parts.length}`);
  const s = el.settings ?? {};
  const keys = Object.keys(s).filter((k) => k === 'text' || k.startsWith('text:'));
  if (!keys.length) return false;
  let hit = false;
  for (const key of keys) {
    let html = String(s[key]);
    let from = 0;
    drawn.forEach((d, i) => {
      for (const needle of [esc(d), d, esc(d).trim(), d.trim()]) {
        if (!needle) continue;
        const at = html.indexOf(needle, from);
        if (at < 0) continue;
        html = html.slice(0, at) + parts[i] + html.slice(at + needle.length);
        from = at + parts[i].length;
        hit = true;
        return;
      }
    });
    s[key] = html;
  }
  return hit;
}

// After render (and after the breakpoint merge): words, loops, drops, links, attributes, icons, conditions.
// `mappings` are the mapping objects of every frame (figma id -> { bricksId }). `textOf(node)` is the drawn
// `text` of a TEXT node (tree.json).
export function applyBinding(template, mappings, bind, textOf = () => null, nodeOf = () => null) {
  const content = template.content;
  const byId = new Map(content.map((e) => [e.id, e]));
  const report = [];
  const elementsOf = (node) => {
    const ids = mappings.map((m) => m?.[node]?.bricksId).filter((id) => id && byId.has(id));
    return [...new Set(ids)].map((id) => byId.get(id));
  };
  const each = (row, fn) => {
    const els = elementsOf(row.node);
    if (!els.length) { report.push({ node: row.node, msg: 'no Bricks element for this node, binding skipped' }); return; }
    els.forEach(fn);
  };
  const settingsOf = (el) => (el.settings ??= {});

  for (const row of bind.text ?? []) {
    const text = textOf(row.node);
    if (!text) throw new Error(`text ${row.node}: not a TEXT node of any frame`);
    each(row, (el) => {
      if (!bindText(el, row, text)) report.push({ node: row.node, msg: 'the drawn words were not found in the element text, binding skipped' });
    });
  }
  for (const row of bind.loops ?? []) {
    each(row, (el) => {
      const s = settingsOf(el);
      s.hasLoop = true;
      s.query = { objectType: row.query };
    });
  }
  for (const row of bind.links ?? []) {
    each(row, (el) => { settingsOf(el).link = { type: 'meta', useDynamicData: row.tag }; });
  }
  for (const row of bind.attrs ?? []) {
    each(row, (el) => {
      const s = settingsOf(el);
      s._attributes = [...(s._attributes ?? []).filter((a) => a.name !== row.name), { name: row.name, value: row.value }];
    });
  }
  for (const row of bind.icons ?? []) {
    each(row, (el) => {
      const s = settingsOf(el);
      el.name = 'div';
      delete s.svg; delete s.source; delete s.file; delete s.code;
      s.tag = 'custom';
      s.customTag = 'i';
      s._attributes = [...(s._attributes ?? []).filter((a) => a.name !== 'class'), { name: 'class', value: row.tag ?? row.className }];
      // A glyph drawn as icon-font text: the <i> keeps its size, colour, line and alignment.
      const t = nodeOf(row.node)?.text;
      // paintFrom: the glyph colour of another drawn copy (this frame's copy keeps the component default)
      const solid = (nodeOf(row.paintFrom ?? row.node)?.fills ?? []).filter((f) => f.visible !== false && f.type === 'SOLID' && f.hex).at(-1);
      if (t) {
        const ty = (s._typography ??= {});
        if (t.fontSize) ty['font-size'] = `${t.fontSize}px`;
        if (t.lineHeightPx) ty['line-height'] = `${t.lineHeightPx}px`;
        if (solid) ty.color = { hex: solid.hex, ...(solid.alpha != null && solid.alpha < 1 ? { rgb: `rgba(${parseInt(solid.hex.slice(1, 3), 16)}, ${parseInt(solid.hex.slice(3, 5), 16)}, ${parseInt(solid.hex.slice(5, 7), 16)}, ${solid.alpha})` } : {}) };
        if (t.align) ty['text-align'] = t.align === 'JUSTIFIED' ? 'justify' : String(t.align).toLowerCase();
      }
    });
  }
  for (const row of bind.hideEmpty ?? []) {
    each(row, (el) => {
      settingsOf(el)._conditions = [[{ key: 'dynamic_data', compare: '!=', value: '', dynamic_data: row.tag }]];
    });
  }

  // Words of the source have their own length. A bound text keeps the drawn type but wraps inside its box
  // instead of the one-line width the drawn words gave it.
  for (const row of bind.text ?? []) {
    for (const el of elementsOf(row.node)) {
      const s = el.settings ?? {};
      if (s._typography?.['white-space'] === 'nowrap') {
        delete s._typography['white-space'];
        report.push({ node: row.node, msg: 'bound text: drawn one-line width (nowrap) dropped, the source words wrap inside the box' });
      }
      if (s._widthMax === 'none') s._widthMax = '100%';
      // A fixed pixel box was the drawn words' size (a "2" in a 62 x 30 box): the source words size the box.
      const fixed = Object.keys(s).filter((k) => /^_(width|height)(:|$)/.test(k) && /^\d+(\.\d+)?px$/.test(String(s[k])));
      if (fixed.length) {
        fixed.forEach((k) => delete s[k]);
        s._widthMax = '100%';
        report.push({ node: row.node, msg: `bound text: the drawn fixed box (${fixed.join(', ')}) dropped, the source words size it` });
      }
    }
  }

  // A looped tab title / pane. Every clone shares the drawn classes, so a drawn `brx-open` would open every pane.
  // Bricks marks the first title aria-selected="true" on the server and keeps it in step with brx-open
  // (tabs-nested.php enhance_accessibility, bricks.min.js), so the open look also follows aria-selected.
  // The first pane is open until the script marks one (tabs-chrome.mjs; a site may delay scripts until the first interaction).
  for (const row of bind.loops ?? []) {
    for (const el of elementsOf(row.node)) {
      const s = el.settings ?? {};
      const classes = String(s._hidden?._cssClasses ?? '').split(/\s+/).filter(Boolean);
      const sel = `#brxe-${el.id}`;
      if (classes.includes('tab-title')) {
        for (const other of template.content) {
          const css = other.settings?._cssCustom;
          if (!css) continue;
          other.settings._cssCustom = css
            .replaceAll(`${sel}.brx-open`, `${sel}:is(.brx-open, [aria-selected="true"])`)
            .replaceAll('.tab-title.brx-open', '.tab-title:is(.brx-open, [aria-selected="true"])');
        }
      }
      if (classes.includes('brx-open')) {
        // The tabs chrome opens the first pane until the script marks one (components/tabs-chrome.mjs).
        s._hidden._cssClasses = classes.filter((c) => c !== 'brx-open').join(' ');
      }
    }
  }

  // A layer the drawing shows on one repeated item only. Loop clones carry the class brxe-<id> (Bricks
  // prints no id on a looped element); the sibling chain counts the clones only, not a drawn sibling before
  // them (a label cell in front of looped value cells).
  for (const row of bind.onlyAt ?? []) {
    const loops = elementsOf(row.loop);
    for (const el of elementsOf(row.node)) {
      for (const loop of loops) {
        const s = settingsOf(loop);
        const other = notAt(loop.id, row.index + 1);
        const target = el.id === loop.id ? other : `${other} :is(#brxe-${el.id}, .brxe-${el.id})`;
        const rule = `${target} { display: ${row.mode === 'box' ? 'contents' : 'none'}; }`;
        s._cssCustom = s._cssCustom ? `${s._cssCustom} ${rule}` : rule;
      }
    }
  }

  // A layer shown while another is hovered. The rule sits on the nearest element that holds both, so it works
  // inside a loop clone too (the selectors take the id and the class Bricks prints on a looped element).
  const byIdNow = new Map(template.content.map((e) => [e.id, e]));
  const chain = (el) => { const out = []; for (let p = el; p; p = byIdNow.get(p.parent)) out.push(p.id); return out; };
  const any = (id) => `:is(#brxe-${id}, .brxe-${id})`;
  const r3 = (n) => `${Math.round(n * 1000) / 1000}px`;
  // Ids for elements the binding adds (a copied layer, a state text / icon): derived from the element they copy.
  const used = new Set(template.content.map((e) => e.id));
  const newId = (seed) => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let id = '';
    do { id = h.toString(36).padStart(6, 'a').slice(-6); h = (h * 31 + 7) >>> 0; } while (used.has(id));
    used.add(id);
    return id;
  };
  const hug = (s, n) => {
    // A layer that hugs its words in Figma hugs the source words (a tooltip with a longer note grows, it is not cut).
    if (n?.sizing?.v === 'HUG') for (const k of Object.keys(s)) if (/^_height(:|$)/.test(k)) delete s[k];
  };
  // A copy of a drawn layer for a frame that does not draw it (the phone frame of a tooltip drawn on desktop only).
  const copyInto = (src, parent, seed) => {
    const map = new Map();
    const sub = [];
    (function walk(e) { sub.push(e); template.content.filter((c) => c.parent === e.id).forEach(walk); })(src);
    for (const e of sub) map.set(e.id, newId(`${seed}|${e.id}`));
    const swap = (txt) => [...map].reduce((t, [a, b]) => t.replaceAll(`brxe-${a}`, `brxe-${b}`), txt);
    const out = sub.map((e) => {
      const c = { ...structuredClone(e), id: map.get(e.id), parent: e === src ? parent.id : map.get(e.parent) };
      if (Array.isArray(c.children)) c.children = c.children.map((id) => map.get(id)).filter(Boolean);
      if (c.settings?._cssCustom) c.settings._cssCustom = swap(c.settings._cssCustom);
      return c;
    });
    template.content.push(...out);
    for (const c of out) byIdNow.set(c.id, c);
    if (Array.isArray(parent.children)) parent.children.push(out[0].id);
    return out[0];
  };
  for (const row of bind.hoverShow ?? []) {
    const triggers = elementsOf(row.trigger);
    const ln = nodeOf(row.node);
    let layers = elementsOf(row.node);
    if (row.copy) {
      // The layer is drawn in another frame only: a copy sits in the trigger's parent, under it ('below') at the
      // parent's left padding, so it stays inside the frame whatever the trigger's place in the row.
      const src = layers[0];
      layers = [];
      for (const t of src ? triggers : []) {
        const parent = byIdNow.get(t.parent);
        const el = copyInto(src, parent, `${t.id}|copy`);
        const s = settingsOf(el);
        for (const k of Object.keys(s)) if (/^_(left|right|top|bottom|width|widthMax|widthMin|height|heightMax|heightMin)(:|$)/.test(k) && k !== '_width') delete s[k];
        s._position = 'absolute';
        s._top = '100%';
        s._left = parent.settings?._padding?.left ?? '0px';
        s._widthMax = 'none';
        s._zIndex = '1';
        hug(s, ln);
        const ps = settingsOf(parent);
        if (!ps._position) ps._position = 'relative';
        layers.push(el);
      }
      if (!layers.length) report.push({ node: row.node, msg: 'hover copy: no drawn layer or no trigger' });
    } else if (row.anchor) {
      // anchor: a node id = the layer is drawn beside that copy of the trigger (a looped row the drawing repeats)
      const drawnBeside = typeof row.anchor === 'string' ? row.anchor : null;
      const tn = nodeOf(drawnBeside ?? row.trigger);
      const pn = row.pointer ? nodeOf(row.pointer) : null;
      const box = (n) => (n?.box && n.box.absX != null ? { x: n.box.absX, y: n.box.absY, w: n.box.w, h: n.box.h } : null);
      const T = box(tn);
      const L = box(ln);
      const P = box(pn);
      for (const el of layers) {
        const t = triggers.find((x) => chain(el).some((id) => chain(x).includes(id)));
        const parent = t && byIdNow.get(t.parent);
        const parentNode = drawnBeside ? nodeOf.parent?.(drawnBeside) : parent && nodeOf(Object.entries(mappings.find((m) => Object.values(m ?? {}).some((v) => v?.bricksId === parent.id)) ?? {}).find(([, v]) => v?.bricksId === parent.id)?.[0]);
        const Q = box(parentNode);
        if (!T || !L || !Q) { report.push({ node: row.node, msg: 'hover anchor: the drawn boxes of the layer, the trigger or its parent are missing' }); continue; }
        // Left edge of the layer: the arrow over the trigger centre, else the drawn offset from the trigger.
        const left = P ? T.x + T.w / 2 - (P.x + P.w / 2 - L.x) : L.x;
        const s = settingsOf(el);
        for (const k of ['_left', '_right', '_top', '_bottom']) delete s[k];
        s._position = 'absolute';
        // Its drawn size at every width: a % width or max-width 100% (theme default for a block) would now be
        // measured against the trigger's row instead of the card it was fitted in.
        for (const k of Object.keys(s)) if (/^_(width|widthMax|widthMin|height|heightMax|heightMin):/.test(k)) delete s[k];
        s._widthMax = 'none';
        // flipped (flipUp): the same gap mirrored about the trigger. A trigger centred across its row (a row that
        // grows with longer source words keeps it in the middle) is measured from the parent's middle.
        const mirror = T.y + T.h - (L.y - T.y);
        const pl = parentNode.layout;
        const centred = pl && pl.mode === 'HORIZONTAL' && pl.counterAlign === 'CENTER';
        const mid = Q.y + Q.h / 2;
        const calc = (n) => `calc(50% ${n < 0 ? '-' : '+'} ${r3(Math.abs(n))})`;
        s._top = centred ? calc(L.y - mid) : r3(L.y - Q.y);
        el._flipBottom = centred ? calc(mid - mirror) : r3(Q.y + Q.h - mirror);
        const fromRight = Q.x + Q.w - (T.x + T.w);
        const fromLeft = T.x - Q.x;
        if (fromRight <= fromLeft) s._right = r3(Q.x + Q.w - (left + L.w));
        else s._left = r3(left - Q.x);
        hug(s, ln);
        // The drawn layer lies over the card (it is drawn last). Moved before later siblings, it keeps that order.
        s._zIndex = '1';
        el.parent = parent.id;
        const ps = settingsOf(parent);
        if (!ps._position) ps._position = 'relative';
        if (Array.isArray(parent.children) && !parent.children.includes(el.id)) parent.children.push(el.id);
      }
    }
    for (const el of layers) {
      const up = chain(el);
      for (const t of triggers) {
        const host = chain(t).find((id) => up.includes(id) && id !== el.id && id !== t.id);
        if (!host) continue;
        const s = settingsOf(el);
        const move = row.transition ? ` transition: opacity ${row.transition}, visibility ${row.transition};` : '';
        // While shown, the holder rises above the rows after it (a sticky label of the next row would cover the layer).
        const rules = [`${any(el.id)} { opacity: 0; visibility: hidden; pointer-events: none;${move} } ${any(host)}:has(${any(t.id)}:hover) ${any(el.id)} { opacity: 1; visibility: visible; } ${any(host)}:has(${any(t.id)}:hover) { z-index: 2; }`];
        // flipUp: on the last row of a loop (and the last row a closed group shows) the layer opens above the
        // trigger, so the frame that clips the rows does not cut it.
        if (row.flipUp) {
          const rowsLoop = elementsOf(row.flipUp).find((r) => up.includes(r.id));
          if (rowsLoop) {
            const R = rowsLoop.id;
            const lastRows = [`.brxe-${R}:not(:has(~ .brxe-${R}))`];
            for (const c of bind.collapse ?? []) {
              if (c.rows !== row.flipUp) continue;
              for (const g of elementsOf(c.node).filter((x) => up.includes(x.id))) {
                const opened = (c.open ?? []).map((i) => `:not(${at(g.id, i + 1)})`).join('');
                lastRows.push(`.brxe-${g.id}:not(.${c.className})${opened} ${at(R, c.keep)}`);
              }
            }
            const flip = row.copy ? 'top: auto !important; bottom: 100% !important;' : `top: auto !important; bottom: ${el._flipBottom} !important;`;
            rules.push(`:is(${lastRows.join(', ')}) ${any(el.id)} { ${flip} }`);
          }
        }
        s._cssCustom = s._cssCustom ? `${s._cssCustom} ${rules.join(' ')}` : rules.join(' ');
      }
      if (!triggers.some((t) => chain(t).some((id) => up.includes(id) && id !== el.id && id !== t.id))) report.push({ node: row.node, msg: 'hover: no element holds both the layer and its trigger' });
      delete el._flipBottom;
    }
  }

  // A state class a script puts on a trigger. New elements copy the look of a drawn one (text / icon box).
  const insertAfter = (ref, el) => {
    const at = template.content.indexOf(ref);
    template.content.splice(at + 1, 0, el);
  };
  for (const row of bind.stateOn ?? []) {
    const triggers = elementsOf(row.trigger);
    for (const host of elementsOf(row.node)) {
      const inHost = (el) => chain(el).includes(host.id);
      const t = triggers.find(inHost);
      if (!t) { report.push({ node: row.node, msg: 'state: the trigger is not inside the node' }); continue; }
      const on = `${any(host.id)}:has(${any(t.id)}.${row.className})`;
      const rules = [];
      const hides = (row.hide ?? []).flatMap((h) => elementsOf(h).filter(inHost));
      if (hides.length) rules.push(`${on} :is(${hides.map((e) => any(e.id)).join(', ')}) { display: none; }`);
      if (row.text) {
        const like = elementsOf(row.text.like).find(inHost);
        if (like) {
          const el = { id: newId(`${like.id}|state-text`), name: like.name, parent: like.parent, label: `${like.label ?? 'Text'} (${row.className})`, settings: { ...structuredClone(like.settings ?? {}), text: row.text.value } };
          delete el.settings._cssCustom;
          delete el.settings._conditions;
          insertAfter(like, el);
          rules.push(`${any(host.id)} ${any(el.id)} { display: none; } ${on} ${any(el.id)} { display: block; }`);
        }
      }
      if (row.icon) {
        const like = elementsOf(row.icon.like).find(inHost);
        if (like) {
          const ls = like.settings ?? {};
          const settings = { tag: 'custom', customTag: 'i', _attributes: [{ name: 'class', value: row.icon.className }, { name: 'aria-hidden', value: 'true' }] };
          for (const k of ['_width', '_height', '_flexShrink', '_widthMax']) if (ls[k] != null) settings[k] = ls[k];
          const el = { id: newId(`${like.id}|state-icon`), name: 'div', parent: like.parent, label: `Icon (${row.className})`, settings };
          insertAfter(like, el);
          const box = row.icon.box ?? {};
          const paint = [box.background && `background-color: ${box.background};`, box.radius && `border-radius: ${box.radius};`, row.icon.size && `font-size: ${row.icon.size}; line-height: 1;`, row.icon.color && `color: ${row.icon.color};`].filter(Boolean).join(' ');
          rules.push(`${any(host.id)} ${any(el.id)} { display: none; align-items: center; justify-content: center; ${paint} } ${on} ${any(el.id)} { display: inline-flex; }`);
        }
      }
      const hs = settingsOf(host);
      hs._cssCustom = hs._cssCustom ? `${hs._cssCustom} ${rules.join(' ')}` : rules.join(' ');
    }
  }

  const addCss = (el, rules) => { const s = settingsOf(el); s._cssCustom = s._cssCustom ? `${s._cssCustom} ${rules}` : rules; };
  const loopRow = (node) => (bind.loops ?? []).find((l) => l.node === node);

  // A drawn copy with its own look (the featured column) loops the same source and shows at its drawn position only.
  const twinsOf = new Map();
  for (const row of bind.twin ?? []) {
    const loop = loopRow(row.loop);
    const parent = nodeOf.parent?.(row.node);
    const drawn = new Set([loop.node, ...(loop.drop ?? []), row.node]);
    const order = (parent?.children ?? []).filter((c) => c.visible !== false && drawn.has(c.id)).map((c) => c.id);
    // index (from 0): the owner names another position than the drawn one
    const index = Number.isInteger(row.index) ? row.index : order.indexOf(row.node);
    if (index < 0) { report.push({ node: row.node, msg: 'twin: not drawn beside the looped item, skipped' }); continue; }
    for (const b of elementsOf(row.node)) {
      const a = elementsOf(row.loop).find((x) => x.parent === b.parent);
      if (!a) { report.push({ node: row.node, msg: 'twin: no looped item in the same parent' }); continue; }
      const bs = settingsOf(b);
      bs.hasLoop = true;
      bs.query = { objectType: loop.query };
      twinsOf.set(a.id, [...(twinsOf.get(a.id) ?? []), b.id]);
      // Flex order, whatever the drawn layer order of the plain item and its twin: clones before the twin's place 0,
      // the twin 1, clones after it 2, a drawn sibling after both 3.
      const pos = (e) => template.content.indexOf(e);
      const last = Math.max(pos(a), pos(b));
      const later = template.content.filter((e) => e.parent === b.parent && e !== a && e !== b && pos(e) > last);
      addCss(a, [
        `${at(a.id, index + 1)} { display: none !important; }`,
        `${notAt(b.id, index + 1)} { display: none !important; }`,
        `.brxe-${b.id} { order: 1; }`,
        `${from(a.id, index + 2)} { order: 2; }`,
        ...later.map((e) => `${any(e.id)} { order: 3; }`),
      ].join(' '));
      report.push({ node: row.node, msg: `twin: shown at position ${index + 1} of the loop (${Number.isInteger(row.index) ? 'named by the owner' : 'drawn order'})` });
    }
  }

  // Looped columns of a row.
  for (const row of bind.columns ?? []) {
    const w = nodeOf(row.node)?.box?.w;
    for (const el of elementsOf(row.node)) {
      const ids = [el.id, ...(twinsOf.get(el.id) ?? [])];
      const decl = row.mode === 'share'
        ? `flex: 1 1 ${r3(w)} !important; min-width: 0 !important; max-width: none !important;`
        : `flex: 1 0 ${r3(w)} !important; min-width: ${r3(w)} !important; max-width: none !important;`;
      addCss(el, `:is(${ids.map((id) => `.brxe-${id}`).join(', ')}) { ${decl} }`);
    }
  }

  // A sideways scrolling frame. Its rows are as wide as their columns at their smallest (min-content: each 'scroll'
  // column at its drawn width, long words wrap) and at least the frame; a pinned layer keeps the frame width and
  // stays at its left edge while the rows scroll.
  for (const row of bind.slider ?? []) {
    for (const el of elementsOf(row.node)) {
      const pins = (row.pin ?? []).flatMap((p) => elementsOf(p)).filter((p) => chain(p).includes(el.id));
      addCss(el, [
        `${any(el.id)} { overflow-x: auto !important; container-type: inline-size; }`,
        `${any(el.id)} > * { width: min-content !important; min-width: 100% !important; max-width: none !important; overflow: visible !important; }`,
        ...pins.map((p) => `${any(el.id)} ${any(p.id)} { position: sticky; left: 0; z-index: 1; width: 100cqw !important; min-width: 0 !important; max-width: 100cqw !important; flex: none !important; }`),
      ].join(' '));
    }
  }

  // A group that shows its first rows until opened.
  for (const row of bind.collapse ?? []) {
    for (const g of elementsOf(row.node)) {
      const inG = (e) => chain(e).includes(g.id);
      const rows = elementsOf(row.rows).filter(inG);
      const more = row.more ? elementsOf(row.more).filter(inG) : [];
      const less = row.less ? elementsOf(row.less).filter(inG) : [];
      const G = `.brxe-${g.id}`;
      const opened = (row.open ?? []).map((i) => `:not(${at(g.id, i + 1)})`).join('');
      const closed = `${G}:not(.${row.className})${opened}`;
      const ctl = (list) => list.map((e) => any(e.id)).join(', ');
      const rules = [];
      for (const r of rows) {
        rules.push(`${closed} ${from(r.id, row.keep + 1)} { display: none !important; }`);
        if (more.length || less.length) rules.push(`${G}:not(:has(${from(r.id, row.keep + 1)})) :is(${ctl([...more, ...less])}) { display: none !important; }`);
      }
      if (more.length) rules.push(`${G}.${row.className} :is(${ctl(more)}) { display: none !important; }`);
      if (less.length) rules.push(`${G}:not(.${row.className}) :is(${ctl(less)}) { display: none !important; }`);
      for (const i of row.open ?? []) if (more.length || less.length) rules.push(`${at(g.id, i + 1)} :is(${ctl([...more, ...less])}) { display: none !important; }`);
      addCss(g, rules.join(' '));
    }
  }

  // Drawn copies of a repeated item: the loop renders them. Remove each with its subtree.
  const gone = new Set();
  for (const row of bind.loops ?? []) {
    for (const node of row.drop ?? []) {
      for (const el of elementsOf(node)) gone.add(el.id);
    }
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const el of content) if (!gone.has(el.id) && gone.has(el.parent)) { gone.add(el.id); grew = true; }
  }
  template.content = content.filter((el) => !gone.has(el.id));
  for (const el of template.content) if (Array.isArray(el.children)) el.children = el.children.filter((id) => !gone.has(id));
  for (const m of mappings) {
    for (const [node, entry] of Object.entries(m ?? {})) {
      if (entry?.bricksId && gone.has(entry.bricksId)) {
        m[node] = { ...entry, bricksId: undefined, verify: false, skipped: 'data loop: a drawn copy of the repeated item' };
      }
    }
  }
  return { removed: gone.size, report };
}

// Tags whose source dimension has no loop above them. The source may fall back (its first item);
// the report lists them so nothing is silent.
export function unloopedTags(template, bind) {
  const byId = new Map(template.content.map((e) => [e.id, e]));
  const kindOf = new Map((bind.provider?.queries ?? []).map((q) => [q.type, q.kind]));
  const needs = new Map((bind.provider?.tags ?? []).map((t) => [String(t.tag).replace(/[{}]/g, ''), t.needs ?? []]));
  const argKey = { pkg: 'p', cycle: 'c', row: 'r', group: 'g' };
  const out = [];
  for (const el of template.content) {
    const raw = JSON.stringify(el.settings ?? {});
    const found = tagsIn(raw.replace(/\\"/g, '"'));
    if (!found.length) continue;
    const kinds = new Set();
    for (let p = el; p; p = byId.get(p.parent)) if (p.settings?.hasLoop) kinds.add(kindOf.get(p.settings.query?.objectType));
    for (const t of found) {
      const missing = (needs.get(t.name) ?? []).filter((k) => !kinds.has(k) && !t.args.some((a) => a.startsWith(`${argKey[k] ?? k}=`)));
      if (missing.length) out.push({ element: el.id, label: el.label ?? '', tag: t.raw, missing });
    }
  }
  return out;
}

// The drawn text of a node: a TEXT node, or the one TEXT inside a component that holds its words itself
// (a button element carries its label; the label's TEXT node gets no element of its own).
export function nodeLookup(trees) {
  const byId = new Map();
  const up = new Map();
  const walk = (n) => { byId.set(n.id, n); (n.children ?? []).forEach((c) => { up.set(c.id, n); walk(c); }); };
  trees.forEach(walk);
  const of = (id) => byId.get(id) ?? null;
  of.parent = (id) => up.get(id) ?? null;
  return of;
}

export function textLookup(trees) {
  const byId = new Map();
  const walk = (n) => { byId.set(n.id, n); (n.children ?? []).forEach(walk); };
  trees.forEach(walk);
  return (id) => {
    const n = byId.get(id);
    if (!n) return null;
    if (n.text) return n.text;
    const found = [];
    const seek = (c) => { if (c.visible === false) return; if (c.text && !c.svg) found.push(c.text); (c.children ?? []).forEach(seek); };
    (n.children ?? []).forEach(seek);
    return found.length === 1 ? found[0] : null;
  };
}
