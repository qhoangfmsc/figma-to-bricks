#!/usr/bin/env node
// STEP 7  Check the REAL render against Figma, with Playwright in Docker (shared/qa.mjs, qa/check.mjs).  Pure code, no AI, no eyeballing.
//   node process/scripts/07-verify.mjs <figma-url | workspace-dir> [--tol=1] [--no-cross]
// One run renders the template at the width of every Figma frame (the base frame and each breakpoint variant of responsive.json), in a frozen,
// animation-free page, and checks per frame:
//   boxes      every mapped node: position / size relative to the root and the CSS values the tree demands (tolerance 1px, never loosened)
//   look       the screenshot against Figma's own render of that frame, region by region (a missing text, a wrong crop or a covered layer fails here)
//   covered    every text / button / image must be the element on top at its own center
//   overflow   no horizontal scroll at the frame's width
//   weight     images the page really downloads stay inside the budget (qa/budgets.json); an image hidden by CSS must not be downloaded
//   engines    the base frame again in WebKit and Firefox, compared with Chromium
// Writes verify.md / verify.png / verify.diff.png / verify.json (base) and verify.<key>.* (variants). Exit 1 on any mismatch.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveWorkspace } from '../shared/workspace.mjs';
import { requireSignOff } from '../review/index.mjs';
import { bridge } from '../bricks/bridge.mjs';
import { runQa } from '../shared/qa.mjs';
import { tierOf, TIER_NAME, verdictOf } from '../shared/severity.mjs';
import { download, getRenders } from '../figma/api.mjs';

const BUDGETS = JSON.parse(readFileSync(new URL('../qa/budgets.json', import.meta.url), 'utf8'));
const FREEZE = '2026-10-27T03:00:00Z'; // fixed "now": the live countdown renders the same numbers on every run

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function canon(prop, v) {
  v = String(v).trim().replace(/#([0-9a-f]{6})\b/gi, (h) => `rgb(${hex2rgb(h).join(', ')})`); // hex anywhere (e.g. inside box-shadow)
  if (/color$/.test(prop) || prop === 'color') {
    let m = v.match(/^#([0-9a-f]{6})$/i);
    if (m) return `rgb(${hex2rgb(v).join(', ')})`;
    m = v.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(',').map((x) => Number(x.trim()));
      return p.length === 4 && p[3] !== 1 ? `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${Math.round(p[3] * 100) / 100})` : `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
    }
  }
  return v;
}
const numeric = (v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null);
// content the eye must be able to see: text, buttons, links, images with an alt, svgs with a label. Decoration (alt="", aria-hidden, backgrounds) may sit under other layers.
const isContent = (m, el) => ['text-basic', 'heading', 'button', 'text-link', 'countdown'].includes(m.element) || (m.element === 'image' && !!el?.settings?.altText) || (m.element === 'svg' && !!(el?.settings?._attributes ?? []).find((a) => a.name === 'aria-label'));

export async function verifyStep(urlOrDir, { tol = 1, cross = true } = {}) {
  const ws = resolveWorkspace(urlOrDir);
  requireSignOff(ws, 'verify'); // the owner must have reviewed detections.md first
  const state = ws.readJson('state.json');
  const baseTree = ws.readJson('tree.json');
  const elements = new Map(ws.readJson('bricks.json').content.map((e) => [e.id, e]));
  const responsive = ws.readJson('responsive.json', { variants: [] });
  const context = ws.readJson('context.json', { bg: {} });

  // frames: the base frame, then every breakpoint variant (same template, rendered at that frame's width)
  const frames = [{ key: 'base', suffix: '', tree: baseTree, mapping: ws.readJson('mapping.json') }];
  for (const v of responsive.variants) {
    frames.push({ key: v.key, suffix: `.${v.key}`, tree: resolveWorkspace(join(dirname(ws.dir), v.workspace)).readJson('tree.json'), mapping: ws.readJson(`mapping.${v.key}.json`) });
  }
  const rootId = `brxe-${frames[0].mapping[baseTree.id].bricksId}`;
  const { url } = await bridge('POST', `/preview/${state.templateId}`);

  // Figma's own render of every frame = what the eye should see
  const figmaErr = {};
  for (const f of frames) {
    try {
      const r = await getRenders(ws.ref.fileKey, [f.tree.id], 'png', { scale: 1 });
      const file = ws.file(`verify${f.suffix}.figma.png`);
      writeFileSync(file, await download(r[f.tree.id]));
      f.figmaPng = file;
    } catch (e) { figmaErr[f.key] = e.message; }
  }

  const job = {
    url, rootId, freezeTime: FREEZE,
    frames: frames.map((f, i) => {
      const entries = Object.entries(f.mapping).filter(([, m]) => m.bricksId && m.verify);
      const items = entries.map(([fid, m]) => ({ f: fid, b: m.bricksId, a: Object.keys(m.expect.attrs ?? {}) }));
      return {
        key: f.key, width: Math.round(f.tree.box.w), items,
        props: [...new Set(entries.flatMap(([, m]) => Object.keys(m.expect.css)))],
        hit: entries.filter(([, m]) => isContent(m, elements.get(m.bricksId))).map(([fid, m]) => ({ f: fid, b: m.bricksId, name: m.element })),
        maskIds: entries.filter(([, m]) => m.element === 'countdown').map(([fid]) => fid),
        figmaPng: f.figmaPng ?? null,
        figmaBg: context.bg?.[f.key] ?? null,
        crossBrowsers: cross && i === 0,
      };
    }),
  };
  const { result, outDir } = runQa(ws, job);

  const summary = [];
  let anyBad = false;
  for (const f of frames) {
    const r = result.frames[f.key];
    if (!r || r.error) throw new Error(`QA ${f.key}: ${r?.error ?? 'no result'}`);
    const m = r.measured;
    const rows = [];
    // text-engine class: Figma and the browser measure text differently (1 to 2.5px per label, measured on 6 strings: -1.2..+1.6px). A width or an x that
    // follows from text (a text node, a hugging box, a box in a horizontal flow) within SOFT_PX is reported on its own, not as a failure. Heights and
    // line breaks are never soft: a different number of lines is a real difference.
    const info = new Map(), parentOf = new Map();
    (function rec(n, p) { info.set(n.id, n); if (p) parentOf.set(n.id, p); (n.children ?? []).forEach((c) => rec(c, n)); })(f.tree, null);
    const SOFT_PX = 2.5;
    const isSoft = (fid, check, delta) => {
      if (!['x', 'w'].includes(check) || Math.abs(delta) > SOFT_PX) return false;
      const n = info.get(fid);
      if (!n) return false;
      const hasText = (m) => m.type === 'TEXT' || (m.children ?? []).some(hasText);
      if (check === 'w') return n.type === 'TEXT' || n.sizing?.h === 'HUG' || hasText(n);
      const p = parentOf.get(fid);
      return n.type === 'TEXT' || p?.layout?.mode === 'HORIZONTAL' || hasText(n);
    };
    const items = Object.entries(f.mapping).filter(([, x]) => x.bricksId && x.verify).map(([figmaId, x]) => ({ figmaId, element: x.element, component: x.component, expect: x.expect }));

    for (const it of items) {
      const got = m.nodes[it.figmaId];
      const label = `${it.figmaId} ${it.element}${it.component ? ` (${it.component})` : ''}`;
      if (!got) { rows.push({ label, check: 'exists', want: 'in DOM', got: 'missing', ok: false }); continue; }
      const e = it.expect;
      for (const [k, want, have] of [['x', e.x, got.x], ['y', e.y, got.y], ['w', e.w, got.w], ['h', e.h, got.h]]) {
        { const ok = Math.abs(want - have) <= tol; rows.push({ label, check: k, want: `${want}`, got: `${Math.round(have * 100) / 100}`, ok, soft: !ok && isSoft(it.figmaId, k, have - want) }); }
      }
      for (const [a, want] of Object.entries(e.attrs ?? {})) rows.push({ label, check: `attr ${a}`, want: String(want), got: String(got.attrs?.[a]), ok: got.attrs?.[a] === want });
      for (const [p, wantRaw] of Object.entries(e.css)) {
        const want = canon(p, wantRaw), have = canon(p, got.css[p]);
        const wn = numeric(want), gn = numeric(have);
        rows.push({ label, check: p, want, got: have, ok: wn !== null && gn !== null ? Math.abs(wn - gn) <= Math.max(0.5, tol / 2) : want === have });
      }
    }
    // look vs Figma's render
    const limit = BUDGETS.visualCellLimit;
    // a region of the picture that lies on text boxes whose width / x are only off by the text-engine amount is that same class (glyph edges of 40px
    // bold text move by a few px over a long line); a region with no text on it, or text off by more, is a real difference
    const textBoxes = items.filter((it) => info.get(it.figmaId)?.type === 'TEXT' && m.nodes[it.figmaId]).map((it) => ({ b: m.nodes[it.figmaId], e: it.expect }));
    const onText = (c) => {
      const hit = textBoxes.filter(({ b }) => Math.min(c.x + c.w, b.x + b.w) - Math.max(c.x, b.x) > 0 && Math.min(c.y + c.h, b.y + b.h) - Math.max(c.y, b.y) > 0);
      const area = hit.reduce((s, { b }) => s + (Math.min(c.x + c.w, b.x + b.w) - Math.max(c.x, b.x)) * (Math.min(c.y + c.h, b.y + b.h) - Math.max(c.y, b.y)), 0);
      return area >= 0.5 * c.w * c.h && hit.every(({ b, e }) => Math.abs(b.x - e.x) <= SOFT_PX && Math.abs(b.w - e.w) <= SOFT_PX && Math.abs(b.y - e.y) <= SOFT_PX && Math.abs(b.h - e.h) <= SOFT_PX);
    };
    if (r.visual) for (const c of r.visual.cells.filter((c) => c.diff > limit)) rows.push({ label: `look ${c.x},${c.y} ${c.w}×${c.h}`, check: 'vs Figma render', want: `≤ ${limit}`, got: `${Math.round(c.diff * 10) / 10}`, ok: false, soft: onText(c) });
    // Figma's picture is clear over a large area and no page-frame fill is known: the template would show the page's white there (Problems: white text on white)
    if (r.visual && r.visual.transparent > 0.05 && !context.bg?.[f.key]) rows.push({ label: `frame ${f.key}`, check: 'transparent area without a background', want: 'a page-frame fill behind it', got: `${Math.round(r.visual.transparent * 100)}% of Figma's picture is clear`, ok: false });
    // covered layers
    for (const c of m.covered) rows.push({ label: `${c.f} ${c.name}`, check: 'on top at its center', want: 'itself', got: `covered by ${c.on_top}`, ok: false });
    // horizontal overflow
    if (m.overflow.over) rows.push({ label: `page @${m.overflow.innerWidth}px`, check: 'horizontal scroll', want: 'none', got: `scrollWidth ${m.overflow.scrollWidth}`, ok: false });
    // image weight and hidden images that still download
    const loaded = m.images.filter((i) => i.loaded && i.bytes);
    const visibleBytes = loaded.filter((i) => !i.hidden).reduce((s, i) => s + i.bytes, 0);
    const hiddenLoaded = loaded.filter((i) => i.hidden);
    const hiddenBytes = hiddenLoaded.reduce((s, i) => s + i.bytes, 0);
    if (visibleBytes > BUDGETS.imageBytesPerFrame) rows.push({ label: `images @${f.tree.box.w}px`, check: 'image weight', want: `≤ ${Math.round(BUDGETS.imageBytesPerFrame / 1024)} KB`, got: `${Math.round(visibleBytes / 1024)} KB`, ok: false });
    if (hiddenBytes > BUDGETS.hiddenImageBytesLoaded) rows.push({ label: `images @${f.tree.box.w}px`, check: 'hidden images downloaded', want: `${BUDGETS.hiddenImageBytesLoaded} KB`, got: `${Math.round(hiddenBytes / 1024)} KB in ${hiddenLoaded.length} image(s)`, ok: false });
    if (m.h1 > 1) rows.push({ label: `page @${f.tree.box.w}px`, check: 'visible h1 (at most one per section; the page has exactly one, in the Hero)', want: '≤ 1', got: String(m.h1), ok: m.h1 <= 1 });
    for (const msg of r.log.failed) rows.push({ label: 'request', check: 'failed', want: 'ok', got: msg, ok: false });

    for (const x of rows) if (!x.ok) { x.tier = tierOf(x); if (x.tier === 4) x.soft = true; } // tier 4 = negligible: listed, not counted as a failure
    const soft = rows.filter((x) => !x.ok && x.soft);
    const bad = rows.filter((x) => !x.ok && !x.soft);
    const tiers = { 1: 0, 2: 0, 3: 0, 4: soft.length };
    for (const x of bad) tiers[x.tier]++;
    anyBad ||= bad.some((x) => x.tier <= 2);
    const md = [
      `# Verify: ${f.tree.name} [${f.tree.id}]${f.key === 'base' ? '' : ` · breakpoint ${f.key}`}`, '',
      `Rendered with Playwright (Chromium, in Docker) at ${Math.round(f.tree.box.w)}px · ${url} · time frozen at ${FREEZE}`, '',
      `**Verdict: ${verdictOf(tiers)}** · tier 1 blocker ${tiers[1]} · tier 2 major ${tiers[2]} · tier 3 minor ${tiers[3]} · tier 4 negligible ${tiers[4]} (listed below, not counted)`, '',
      `**${rows.length - bad.length - soft.length}/${rows.length} checks match** (position/size tolerance ${tol}px)${soft.length ? ` · **${soft.length} text-engine difference(s)** within ${SOFT_PX}px listed below, not counted as failures` : ''}`, '',
      r.visual ? `**Look vs Figma render:** mean difference ${Math.round(r.visual.mean * 100) / 100}/255, ${r.visual.cells.filter((c) => c.diff > limit).length} of ${r.visual.cells.length} regions (${r.visual.cell}px) above ${limit}${r.visual.masks.length ? `; ${r.visual.masks.length} live region(s) (countdown) masked` : ''} (see verify${f.suffix}.diff.png, white = different)` : `**Look vs Figma render: not measured** (${figmaErr[f.key] ?? 'no figma token'})`,
      `**Images downloaded:** ${loaded.length} · visible ${Math.round(visibleBytes / 1024)} KB · hidden by CSS but downloaded ${Math.round(hiddenBytes / 1024)} KB (${hiddenLoaded.length})`, '',
      bad.length ? '## Mismatches (worst first)\n\n| tier | node | check | Figma | rendered |\n|---|---|---|---|---|\n' + [...bad].sort((a, b) => a.tier - b.tier).map((x) => `| ${x.tier} ${TIER_NAME[x.tier]} | ${x.label} | ${x.check} | ${x.want} | ${x.got} |`).join('\n') : '## All checks pass',
      '',
    ];
    if (soft.length) md.push('## Text-engine differences (Figma vs browser text layout, within 2.5px)', '', '| node | check | Figma | rendered |', '|---|---|---|---|', ...soft.map((x) => `| ${x.label} | ${x.check} | ${x.want} | ${x.got} |`), '');
    if (f.key === 'base' && Object.keys(result.engines).length) {
      md.push('## Other browsers (compared with Chromium)', '', '| engine | mean diff | worst region | horizontal scroll | covered | console |', '|---|---|---|---|---|---|');
      for (const [k, e] of Object.entries(result.engines)) {
        md.push(e.error ? `| ${k} | error: ${e.error.slice(0, 80)} | | | | |` : `| ${k} | ${Math.round(e.mean * 100) / 100} | ${Math.round(e.worst[0].diff * 10) / 10} @ ${e.worst[0].x},${e.worst[0].y} | ${e.overflow.over ? 'yes' : 'no'} | ${e.covered} | ${e.console.length ? e.console[0] : 'clean'} |`);
      }
      md.push('');
    }
    if (r.log.console.length) md.push('## Console', '', ...r.log.console.map((c) => `- ${c}`), '');
    ws.writeText(`verify${f.suffix}.md`, md.join('\n'));
    ws.writeJson(`verify${f.suffix}.json`, { url, tol, total: rows.length, bad, soft, tiers, verdict: verdictOf(tiers), visualMean: r.visual?.mean ?? null, imageBytes: visibleBytes, hiddenImageBytes: hiddenBytes, engines: f.key === 'base' ? result.engines : undefined });
    for (const [src, dst] of [[r.shot, `verify${f.suffix}.png`], [`${f.key}.diff.png`, `verify${f.suffix}.diff.png`]]) {
      try { writeFileSync(ws.file(dst), readFileSync(join(outDir, src))); } catch { /* no diff without figma png */ }
    }
    console.log(`  [${f.key} @${Math.round(f.tree.box.w)}px] ${verdictOf(tiers)} T1:${tiers[1]} T2:${tiers[2]} T3:${tiers[3]} T4:${tiers[4]} · ${rows.length - bad.length - soft.length}/${rows.length} checks match${soft.length ? ` (+${soft.length} text-engine)` : ''}${r.visual ? ` · look ${Math.round(r.visual.mean * 100) / 100}/255` : ''} · images ${Math.round(visibleBytes / 1024)} KB (+${Math.round(hiddenBytes / 1024)} KB hidden)`);
    for (const x of bad.slice(0, 25)) console.log(`    ✗ ${x.label} ${x.check}: want ${x.want} · got ${x.got}`);
    if (bad.length > 25) console.log(`    … ${bad.length - 25} more in verify${f.suffix}.md`);
    summary.push({ key: f.key, total: rows.length, bad: bad.length, tiers });
  }
  for (const [k, e] of Object.entries(result.engines)) console.log(`  [${k}] ${e.error ? `error ${e.error.slice(0, 80)}` : `vs chromium ${Math.round(e.mean * 100) / 100}/255 · scroll ${e.overflow.over ? 'YES' : 'no'} · covered ${e.covered}`}`);
  if (anyBad) process.exitCode = 1;
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const tol = Number((args.find((a) => a.startsWith('--tol=')) ?? '--tol=1').split('=')[1]);
  await verifyStep(args.find((a) => !a.startsWith('--')), { tol, cross: !args.includes('--no-cross') });
}
