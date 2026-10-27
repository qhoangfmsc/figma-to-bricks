#!/usr/bin/env node
// STEP 5  tree.json (+ overrides.json, approved entries of detections.json) -> bricks.json + mapping.json + report.md.  Pure code, no network.
//   node process/scripts/05-build.mjs <figma-url | workspace-dir> [--strict]
// --strict: exit 1 if anything could not be mapped (warnings) or the tree has unhandled raw keys.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { resolveWorkspace } from '../shared/workspace.mjs';
import { requireSignOff } from '../review/index.mjs';
import { buildTemplate } from '../bricks/render/index.mjs';
import { stats } from '../figma/tree-md.mjs';
import { mergeResponsive } from '../responsive/merge.mjs';

// [{ family, weights: [400, 700], italicWeights: [] }] for every visible text node (incl. mixed-style runs)
export function collectFonts(root) {
  const fam = {};
  const add = (family, weight, italic) => {
    if (!family) return;
    const f = (fam[family] ??= { family, weights: new Set(), italicWeights: new Set() });
    (italic ? f.italicWeights : f.weights).add(weight);
  };
  (function rec(n) {
    if (n.visible === false) return;
    if (n.text && !n.svg) {
      add(n.text.fontFamily, n.text.fontWeight, n.text.italic);
      for (const r of n.text.runs ?? []) if (r.style) add(r.style.fontFamily ?? n.text.fontFamily, r.style.fontWeight ?? n.text.fontWeight, r.style.italic ?? n.text.italic);
    }
    n.children?.forEach(rec);
  })(root);
  return Object.values(fam).map((f) => ({ family: f.family, weights: [...f.weights].sort(), italicWeights: [...f.italicWeights].sort() }));
}

export function buildStep(urlOrDir, { strict = false } = {}) {
  const ws = resolveWorkspace(urlOrDir);
  requireSignOff(ws, 'build'); // the owner must have reviewed detections.md first
  const tree = ws.readJson('tree.json');
  const overrides = ws.readJson('overrides.json', { nodes: {} });
  const detections = ws.readJson('detections.json', null);
  const flats = ws.readJson('assets/manifest.json', {}).flats ?? {};
  const readAsset = (file) => readFileSync(ws.file('assets/' + file), 'utf8');

  const firstBuild = buildTemplate(tree, { overrides, detections, flats, readAsset, salt: ws.ref?.fileKey ?? '' });
  const { mapping, warnings } = firstBuild;
  let template = firstBuild.template;
  for (const f of ws.readJson('assets/manifest.json', {}).svgFailed ?? []) warnings.push({ node: f.id, name: f.name, msg: 'Figma could not render this svg (e.g. a mask): built as a plain node, the look is not reproduced' });
  ws.writeJson('bricks.base.json', template); // the base frame alone (before the breakpoint variants are merged in)

  // content signature of an asset file (svg: without the root width / height, which Figma writes for the node's own size)
  const signature = (w) => (file) => {
    const buf = readFileSync(w.file('assets/' + file));
    const body = file.endsWith('.svg') ? Buffer.from(buf.toString('utf8').replace(/<svg([^>]*)>/, (m, a) => `<svg${a.replace(/\s(width|height)="[^"]*"/g, '')}>`)) : buf;
    return createHash('sha1').update(body).digest('hex');
  };
  // Breakpoint variants (responsive.json): every variant frame is built with its own workspace (tree, decisions, assets) and merged in
  const responsive = ws.readJson('responsive.json', null);
  const fontSources = [tree];
  if (responsive?.variants?.length) {
    const variants = responsive.variants.map((v) => {
      const vws = resolveWorkspace(join(dirname(ws.dir), v.workspace));
      requireSignOff(vws, 'build');
      const vtree = vws.readJson('tree.json');
      fontSources.push(vtree);
      const b = buildTemplate(vtree, {
        overrides: vws.readJson('overrides.json', { nodes: {} }), detections: vws.readJson('detections.json', null), flats: vws.readJson('assets/manifest.json', {}).flats ?? {},
        readAsset: (file) => readFileSync(vws.file('assets/' + file), 'utf8'), salt: `${ws.ref?.fileKey ?? ''}|${v.key}`,
      });
      for (const w of b.warnings) warnings.push({ ...w, msg: `[${v.key}] ${w.msg}` });
      return { key: v.key, maxWidth: v.maxWidth, aliases: v.aliases ?? {}, tree: vtree, template: b.template, mapping: b.mapping, ws: vws, sig: signature(vws) };
    });
    const merged = mergeResponsive({ base: { tree, template, mapping, sig: signature(ws) }, variants });
    template = merged.template;
    for (const w of merged.warnings) warnings.push(w);
    for (const v of variants) ws.writeJson(`mapping.${v.key}.json`, merged.mappings[v.key]);
    // images / svg / flat exports that only a variant frame has: the push step reads them from this workspace
    const need = new Set([...JSON.stringify(template).matchAll(/"\$asset":"([^"]+)"/g)].map((m) => m[1]));
    for (const file of need) {
      if (existsSync(ws.file('assets/' + file))) continue;
      const src = variants.find((v) => existsSync(v.ws.file('assets/' + file)));
      if (!src) { warnings.push({ node: '-', name: '-', msg: `asset ${file} not found in any frame workspace` }); continue; }
      mkdirSync(dirname(ws.file('assets/' + file)), { recursive: true });
      copyFileSync(src.ws.file('assets/' + file), ws.file('assets/' + file));
    }
    console.log(`  responsive: ${variants.map((v) => `${v.key} (<=${v.maxWidth}px, ${Object.keys(merged.mappings[v.key]).length} nodes)`).join(' · ')}`);
  }
  ws.writeJson('bricks.json', template);
  ws.writeJson('mapping.json', mapping);
  ws.writeJson('warnings.json', warnings);
  const fonts = new Map(); // union over every frame: the site loads each family once
  for (const f of fontSources.flatMap(collectFonts)) {
    const e = fonts.get(f.family) ?? { family: f.family, weights: new Set(), italicWeights: new Set() };
    f.weights.forEach((w) => e.weights.add(w)); f.italicWeights.forEach((w) => e.italicWeights.add(w));
    fonts.set(f.family, e);
  }
  ws.writeJson('fonts.json', [...fonts.values()].map((f) => ({ family: f.family, weights: [...f.weights].sort(), italicWeights: [...f.italicWeights].sort() })));

  const st = stats(tree);
  const built = Object.values(mapping).filter((m) => m.bricksId).length;
  const skipped = Object.entries(mapping).filter(([, m]) => m.skipped);
  const lines = [
    `# Build report: ${tree.name} [${tree.id}]`, '',
    `Figma nodes ${st.nodes} → Bricks elements ${template.content.length}  (skipped ${skipped.length}, overrides ${Object.keys(overrides.nodes ?? {}).length})`, '',
    '## Warnings (not mapped / approximated)', '',
    ...(warnings.length ? warnings.map((w) => `- [${w.node}] ${w.name}: ${w.msg}`) : ['- none']), '',
    '## Unhandled Figma properties', '',
    st.unhandled.size ? `- ${[...st.unhandled].join(', ')}` : '- none', '',
    '## Skipped nodes', '',
    ...(skipped.length ? skipped.map(([id, m]) => `- [${id}] ${m.skipped}`) : ['- none']), '',
    '## Fonts to load on the site', '', ...[...st.fonts].map((f) => `- ${f}`), '',
    '## Figma → Bricks', '',
    '| Figma | Name | Bricks | element |', '|---|---|---|---|',
    ...Object.entries(mapping).filter(([, m]) => m.bricksId).map(([id, m]) => `| ${id} | ${template.content.find((e) => e.id === m.bricksId)?.label ?? ''} | ${m.bricksId} | ${m.element} |`), '',
  ];
  ws.writeText('report.md', lines.join('\n'));

  console.log(`  bricks.json: ${template.content.length} elements · warnings ${warnings.length} · unhandled keys ${st.unhandled.size}`);
  for (const w of warnings) console.log(`    ! [${w.node}] ${w.msg}`);
  if (strict && (warnings.length || st.unhandled.size)) {
    console.error('  --strict: unresolved warnings, see report.md');
    process.exitCode = 1;
  }
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  buildStep(args.find((a) => !a.startsWith('--')), { strict: args.includes('--strict') });
}
