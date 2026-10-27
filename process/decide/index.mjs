// DECISION ENGINE (autopilot). Turns the judgment calls the owner used to make one by one into deterministic rules over tree.json + facts.json,
// so that one Figma link is enough. Every decision is written down (decisions.md) with its reason and confidence, so the owner reviews the
// list afterwards instead of answering questions beforehand. It never invents content: URLs, alt texts, tooltip copy, form actions go to the
// designer list (designer-list.md) and the template is built with the safe default ('#', empty alt).
//
// Rules (all from owner decisions 2026-10-27, see policy.json):
//   flat-image candidate   a subtree with any visible text is NOT a picture (rejected); text-free decoration is approved
//   masked decoration      a text-free group with a mask layer is one picture rendered by Figma (CSS cannot mask like Figma)
//   tooltip / carousel / form / accordion / tabs candidates   rejected: they need content only the designer has (listed as needs-review)
//   button candidate       approved, link '#' (designer list)
//   headings               text styles H1..H6 are honored; otherwise the largest text of the section is its title (h2, or h1 for the first section of
//                          the page); in a repeated group the largest text of each item is a title one level below
//   repeated groups        a container whose visible children are all the repeated items is a list (ul > li); a mixed container is left as blocks
//   icons (svg)            decorative: aria-hidden
//   images                 alt "" (decorative) and listed for the designer; eager in the first section, lazy below the fold
import { readFileSync } from 'node:fs';

const kids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const walk = (n, fn) => { if (n.visible === false) return; fn(n); kids(n).forEach((c) => walk(c, fn)); };
const find = (n, id) => { if (n.id === id) return n; for (const c of n.children ?? []) { const f = find(c, id); if (f) return f; } return null; };
const textsIn = (n) => { const out = []; walk(n, (m) => { if (m.type === 'TEXT' && !m.svg && m.text?.characters?.trim()) out.push(m); }); return out; };
const hasText = (n) => textsIn(n).length > 0;
const words = (s) => s.trim().split(/\s+/).length;
const DECOR_NAME = /glow|background|bg\b|pattern|decor|gradient|overlay|shadow|blur|border|corner|edge|line|divider/i;

export function decide(ws, { firstSection = false, variant = false, parentBg = null } = {}) {
  const tree = ws.readJson('tree.json');
  const facts = ws.readJson('facts.json');
  const det = ws.readJson('detections.json');
  const ov = ws.readJson('overrides.json', { nodes: {} });
  ov.nodes ??= {};
  const decisions = [];
  const needs = []; // things the designer / owner may want to look at, never blocking
  const designer = [];
  const log = (kind, node, decision, why, confidence = 'high') => decisions.push({ kind, node: node ? `${node.name} [${node.id}]` : '-', decision, why, confidence });
  const setOv = (id, patch) => { ov.nodes[id] = { ...(ov.nodes[id] ?? {}), ...patch, settings: { ...(ov.nodes[id]?.settings ?? {}), ...(patch.settings ?? {}) } }; if (!Object.keys(ov.nodes[id].settings).length) delete ov.nodes[id].settings; };
  const hand = new Set(Object.entries(ov.nodes).filter(([, v]) => v.reason && !/^autopilot/i.test(v.reason)).map(([k]) => k)); // owner's own entries win

  // ---- 0. a section without a visible fill of its own sits on its frame's fill in Figma (the Problems section is transparent on the blue page frame:
  // white text, 10% white cards and white icons are invisible without it). A template has no parent frame, so the section takes that fill.
  const rootFill = (tree.fills ?? []).some((f) => f.visible !== false && ['SOLID', 'IMAGE', 'GRADIENT_LINEAR'].includes(f.type));
  if (!rootFill && parentBg && !hand.has(tree.id)) {
    setOv(tree.id, { settings: { _background: { color: { hex: parentBg } } }, reason: `autopilot: the section is transparent in Figma, the fill ${parentBg} of its page frame shows through` });
    log('background', tree, `background ${parentBg}`, 'transparent section: the page frame fill is what the eye sees behind it', 'high');
  }

  // ---- 1. candidates found by the rules
  for (const c of det.components) {
    if (c.status !== 'proposed') continue;
    const node = find(tree, c.node);
    if (!node) continue;
    if (c.component === 'flat-image') {
      if (hasText(node)) { c.status = 'rejected'; c.note = 'autopilot: the subtree holds real text, so it is not a picture'; log('flat-image', node, 'rejected', `contains ${textsIn(node).length} visible text(s): text must stay selectable`); }
      else { c.status = 'approved'; c.note = 'autopilot: decoration without text, exported as one picture by Figma'; log('flat-image', node, 'approved', 'art layers without text: one picture rendered by Figma is exact', 'medium'); }
    } else if (c.component === 'button') {
      c.status = 'approved'; c.note = 'autopilot: button, link "#" until the designer gives the URL';
      log('button', node, 'approved', `label "${textsIn(node)[0]?.text.characters.trim().slice(0, 40) ?? ''}" with a frame look`);
      designer.push(`Link URL (and target) of the button "${textsIn(node)[0]?.text.characters.trim().slice(0, 40) ?? node.name}" [${node.id}]`);
    } else {
      c.status = 'rejected'; c.note = `autopilot: ${c.component} needs content only the designer has`;
      log(c.component, node, 'rejected', 'needs content the Figma file does not contain', 'medium');
      needs.push(`${c.component} candidate on "${node.name}" [${node.id}] was left as blocks: ${c.evidence ?? ''}`);
    }
  }

  // ---- 1b. masked decoration: a group with a mask layer and no text. CSS cannot reproduce a Figma mask, Figma can render it, so it is one picture
  walk(tree, (n) => {
    if (n === tree || !['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE'].includes(n.type) || hasText(n)) return;
    if (!kids(n).some((c) => c.isMask)) return;
    if (det.components.some((c) => c.component === 'flat-image' && c.node === n.id)) return;
    det.components.push({ id: `d${Math.max(0, ...det.components.map((c) => Number(c.id.slice(1)) || 0)) + 1}`, status: 'approved', source: 'ai', component: 'flat-image', node: n.id, level: 'E2', confidence: 'medium',
      cite: [{ node: n.id, field: 'type', equals: n.type }, { node: kids(n).find((c) => c.isMask).id, field: 'isMask', equals: true }], evidence: `${n.type} "${n.name}" holds a mask layer and no text`, params: { alt: '', link: null, scale: 2 }, note: 'autopilot: a masked decoration is rendered by Figma as one picture (CSS has no equivalent of a Figma mask)' });
    log('flat-image', n, 'approved (masked decoration)', 'contains a mask layer and no text: only Figma can render it exactly', 'high');
  });

  // ---- 2. headings
  const items = new Set((facts.repeats ?? []).flatMap((r) => r.ids));
  const inItem = (n) => { let hit = false; for (const id of items) { const it = find(tree, id); if (it && find(it, n.id)) { hit = true; break; } } return hit; };
  const styled = new Set(); // text nodes the designer already styled H1..H6
  walk(tree, (n) => { if (n.type === 'TEXT' && /^H[1-6](\b|\/)/.test(n.styleRefs?.text ?? '')) styled.add(n.id); });
  let sectionLevel = 0;
  if (!styled.size) {
    const all = [];
    walk(tree, (n) => { if (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim() && !inItem(n)) all.push(n); });
    const max = Math.max(0, ...all.map((n) => n.text.fontSize));
    const title = all.find((n) => n.text.fontSize >= max * 0.9 && n.text.characters.length <= 200);
    if (title && !hand.has(title.id)) {
      sectionLevel = firstSection ? 1 : 2;
      setOv(title.id, { element: 'heading', tag: `h${sectionLevel}`, reason: 'autopilot: the largest text of the section is its title' });
      log('heading', title, `h${sectionLevel}`, `largest text (${title.text.fontSize}px) of ${firstSection ? 'the first section of the page' : 'the section'}`, 'high');
    }
  }
  for (const r of facts.repeats ?? []) {
    for (const id of r.ids) {
      const item = find(tree, id);
      const ts = textsIn(item);
      if (ts.length < 2) continue;
      const big = ts.reduce((a, b) => (b.text.fontSize > a.text.fontSize ? b : a));
      const small = Math.min(...ts.map((t) => t.text.fontSize));
      if (big.text.fontSize >= small * 1.15 && words(big.text.characters) <= 14 && !hand.has(big.id)) {
        const level = Math.min(6, (sectionLevel || 2) + 1);
        setOv(big.id, { element: 'heading', tag: `h${level}`, reason: 'autopilot: the largest text of a repeated item is its title' });
        if (id === r.ids[0]) log('heading', big, `h${level} (every item of "${r.parentName}")`, `largest text (${big.text.fontSize}px) of each of ${r.count} repeated items`, 'medium');
      }
    }
  }

  // ---- 3. lists (base frame only: the breakpoint variants take the tags from the base frame)
  if (!variant) {
    for (const r of facts.repeats ?? []) {
      const parent = find(tree, r.parent);
      if (!parent || r.count < 2) continue;
      const exists = det.components.some((c) => c.component === 'semantic' && c.node === parent.id);
      if (kids(parent).length === r.count && !exists) {
        det.components.push({ id: `d${Math.max(0, ...det.components.map((c) => Number(c.id.slice(1)) || 0)) + 1}`, status: 'approved', source: 'ai', component: 'semantic', node: parent.id, level: 'E2', confidence: 'medium',
          cite: [{ node: parent.id, field: 'name', equals: parent.name }], evidence: `FRAME "${parent.name}" holds ${r.count} items of the same structure ("${r.itemName}")`, params: { tag: 'ul', itemTag: 'li' }, note: 'autopilot: a group of repeated items is a list' });
        log('list', parent, 'ul > li', `${r.count} repeated items fill the container`, 'medium');
      } else if (!exists) needs.push(`"${parent.name}" [${parent.id}] holds ${r.count} repeated items next to other children: left as blocks`);
    }
  }

  // ---- 4. icons and images
  let imgIndex = 0;
  walk(tree, (n) => {
    if (hand.has(n.id)) return;
    if (n.svg && n.type !== 'TEXT') {
      setOv(n.id, { settings: { _attributes: [{ name: 'aria-hidden', value: 'true' }] }, reason: 'autopilot: icon, decorative' });
    } else if (!kids(n).length && n.fills?.some((f) => f.type === 'IMAGE') && n.type !== 'TEXT') {
      imgIndex++;
      const decorative = DECOR_NAME.test(n.name);
      setOv(n.id, { alt: '', settings: { loading: firstSection ? 'eager' : 'lazy' }, reason: 'autopilot: image, alt left empty until the designer provides it' });
      if (!decorative) designer.push(`Alt text of the image "${n.name}" [${n.id}]`);
    }
  });
  const nSvg = Object.values(ov.nodes).filter((v) => v.reason === 'autopilot: icon, decorative').length;
  if (nSvg) log('icons', null, `aria-hidden on ${nSvg} svg icon(s)`, 'icons are decorative unless the designer names them', 'high');
  if (imgIndex) log('images', null, `alt "" + ${firstSection ? 'eager' : 'lazy'} on ${imgIndex} image(s)`, 'alt text is content only the designer has', 'high');

  ws.writeJson('detections.json', det);
  ws.writeJson('overrides.json', ov);
  return { decisions, needs, designer };
}

export function writeDecisionReport(ws, { decisions, needs, designer }, title) {
  const t = (rows) => rows.length ? ['| kind | node | decision | why | confidence |', '|---|---|---|---|---|', ...rows.map((d) => `| ${d.kind} | ${d.node} | ${d.decision} | ${d.why} | ${d.confidence} |`)].join('\n') : '_none_';
  ws.writeText('decisions.md', [`# Autopilot decisions: ${title}`, '', 'Taken by rules (decide/index.mjs, policy.json), not asked. Reverse any of them by editing detections.json / overrides.json and re-running from the build step.', '', t(decisions), '', '## Left as blocks / needs a look', '', ...(needs.length ? needs.map((x) => `- ${x}`) : ['_none_']), '', '## For the designer (content the Figma file does not contain)', '', ...(designer.length ? [...new Set(designer)].map((x) => `- ${x}`) : ['_none_']), ''].join('\n'));
}
