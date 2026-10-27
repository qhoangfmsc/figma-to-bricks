#!/usr/bin/env node
// STEP 2  raw.json -> tree.json (normalized, machine) + tree.md (readable, for review).  Pure code.
//   node process/scripts/02-tree.mjs <figma-url | workspace-dir>
import { resolveWorkspace } from '../shared/workspace.mjs';
import { normalizeRoot } from '../figma/normalize.mjs';
import { renderTreeMd, stats } from '../figma/tree-md.mjs';

export function treeStep(urlOrDir) {
  const ws = resolveWorkspace(urlOrDir);
  const raw = ws.readJson('raw.json');
  const manifest = ws.readJson('assets/manifest.json', { images: {}, svgs: {} });
  const nodeId = ws.ref?.nodeId ?? Object.keys(raw.nodes)[0];

  const root = normalizeRoot(raw, nodeId, manifest);
  ws.writeJson('tree.json', root);
  ws.writeText('tree.md', renderTreeMd(root, { fileName: raw.name, fileKey: ws.ref?.fileKey, version: raw.version }));

  const s = stats(root);
  console.log(`  tree.json + tree.md  (${s.nodes} nodes, ${s.hidden} hidden, ${s.text} text, ${s.images} images, ${s.svgs} svg)`);
  if (s.unhandled.size) console.log(`  ! unhandled raw keys: ${[...s.unhandled].join(', ')}`);
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) treeStep(process.argv[2]);
