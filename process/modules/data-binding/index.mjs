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
//   icons     [{ node, tag, reason }]                   the drawn icon becomes <i class="{tag}"> at the same box
//   hideEmpty [{ node, tag, reason }]                   element shows only when the tag is not empty (_conditions)
//   show      [{ node, reason }]                        a layer the component holds but this instance hides (the
//                                                       source fills it; pair it with hideEmpty)
//   onlyAt    [{ node, loop, index, reason }]           a layer the drawing shows on one repeated item only (index from 0)
//
// Bricks 1.12.3: `hasLoop` + `query.objectType` (includes/query.php), link type `meta` reads `useDynamicData`
// (elements/base.php set_link_attributes), custom attributes merge into `class` since 1.11.1, conditions key
// `dynamic_data` (includes/conditions.php).

const TAG = /\{([a-z][a-z0-9_]*)((?::[^{}:]+)*)\}/gi;
const LISTS = ['loops', 'text', 'links', 'attrs', 'icons', 'hideEmpty', 'show', 'onlyAt'];

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
      } else if (list === 'onlyAt') {
        if (!(bind.loops ?? []).some((l) => l.node === row.loop)) throw new Error(`${where}: loop ${row.loop} is not in loops`);
        if (!Number.isInteger(row.index) || row.index < 0) throw new Error(`${where}: index from 0`);
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
export function applyBinding(template, mappings, bind, textOf = () => null) {
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
      s._attributes = [...(s._attributes ?? []).filter((a) => a.name !== 'class'), { name: 'class', value: row.tag }];
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
  // prints no id on a looped element); nth-of-type counts the clones (the loop's <template> is not a div).
  for (const row of bind.onlyAt ?? []) {
    const loops = elementsOf(row.loop);
    for (const el of elementsOf(row.node)) {
      for (const loop of loops) {
        const s = settingsOf(loop);
        const rule = `.brxe-${loop.id}:not(:nth-of-type(${row.index + 1})) :is(#brxe-${el.id}, .brxe-${el.id}) { display: none; }`;
        s._cssCustom = s._cssCustom ? `${s._cssCustom} ${rule}` : rule;
      }
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
  const argKey = { pkg: 'p', cycle: 'c', row: 'r' };
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
