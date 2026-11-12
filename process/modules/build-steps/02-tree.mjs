#!/usr/bin/env node
// STEP 2  raw.json -> tree.json (normalized, machine) + tree.md (readable, for review).  Pure code.
//   node process/modules/build-steps/02-tree.mjs <figma-url | workspace-dir>
import { readFileSync } from 'node:fs';
import { resolveWorkspace } from '../common/workspace.mjs';
import { normalizeRoot } from '../read-figma/normalize.mjs';
import { renderTreeMd, stats } from '../read-figma/tree-md.mjs';
import { noteReadError } from '../common/read-errors.mjs';
import { chevronSide, dashRowFromSvg } from '../recognize-parts/rules/carousel.mjs';

function stampDashRows(root, read) {
  (function walk(n) {
    if (n.svg?.file) {
      let text = '';
      try { text = read(n.svg.file); } catch { text = ''; }
      const row = dashRowFromSvg(text);
      if (row) n.svgMarks = { count: row.count };
      const side = chevronSide(text);
      if (side) n.arrow = side;
    }
    for (const c of n.children ?? []) walk(c);
  })(root);
}

export function treeStep(urlOrDir) {
  const ws = resolveWorkspace(urlOrDir);
  const raw = ws.readJson('raw.json');
  const manifest = ws.readJson('assets/manifest.json', { images: {}, svgs: {} });
  const nodeId = ws.ref?.nodeId ?? Object.keys(raw.nodes)[0];

  const root = normalizeRoot(raw, nodeId, manifest);
  stampDashRows(root, (rel) => readFileSync(ws.file(`assets/${rel}`), 'utf8'));
  const fileKey = ws.ref?.fileKey;
  (function note(n) {
    const broken = (n.unhandled ?? []).filter((u) => u === 'interaction action is null' || u === 'component property value is null');
    if (broken.length) noteReadError({ step: 'tree', node: n.id, fileKey, error: `${n.name}: ${broken.join('; ')}` });
    for (const c of n.children ?? []) note(c);
  })(root);
  ws.writeJson('tree.json', root);
  ws.writeText('tree.md', renderTreeMd(root, { fileName: raw.name, fileKey: ws.ref?.fileKey, version: raw.version }));

  const s = stats(root);
  console.log(`  tree.json + tree.md  (${s.nodes} nodes, ${s.hidden} hidden, ${s.text} text, ${s.images} images, ${s.svgs} svg)`);
  if (s.unhandled.size) console.log(`  ! unhandled raw keys: ${[...s.unhandled].join(', ')}`);
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) treeStep(process.argv[2]);
