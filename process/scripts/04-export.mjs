#!/usr/bin/env node
// STEP 4  Export what Figma itself must render: nodes whose APPROVED detection is a flat image (banner / artwork).
//   node process/scripts/04-export.mjs <figma-url | workspace-dir>
// Figma draws the node (rotation, blur, opacity, 3D text, rounded corners… exactly as in the file) and we keep that picture.
// Needs network + FIGMA_TOKEN, but only when an approved flat-image exists; otherwise it does nothing.
// Result: assets/flat/<node>.png and manifest.json -> flats[nodeId] = { file, width, height, scale, version, sha256 }.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveWorkspace, safeId } from '../shared/workspace.mjs';
import { requireSignOff } from '../review/index.mjs';
import { download, getRenders } from '../figma/api.mjs';
import { imageInfo, sha256 } from '../shared/image-info.mjs';
import { exportJobs } from '../bricks/components/flat-image.mjs';

export async function exportStep(urlOrDir) {
  const ws = resolveWorkspace(urlOrDir);
  requireSignOff(ws, 'export'); // the owner must have reviewed detections.md first
  const manifest = ws.readJson('assets/manifest.json', { images: {}, svgs: {} });
  const jobs = exportJobs(ws.readJson('detections.json', null));
  const version = ws.readJson('raw.json').version;
  const old = manifest.flats ?? {};
  manifest.flats = {};
  if (!jobs.length) { ws.writeJson('assets/manifest.json', manifest); console.log('  no approved flat image: nothing to export'); return ws; }

  const dir = join(ws.dir, 'assets/flat');
  mkdirSync(dir, { recursive: true });
  for (const [scale, list] of Object.entries(Object.groupBy(jobs, (j) => j.scale))) {
    const todo = list.filter((j) => { const o = old[j.node]; return !(o && o.scale === j.scale && o.version === version && existsSync(ws.file('assets/' + o.file))); });
    for (const j of list) if (!todo.includes(j)) manifest.flats[j.node] = old[j.node];
    if (!todo.length) continue;
    const urls = await getRenders(ws.ref.fileKey, todo.map((j) => j.node), 'png', { scale: Number(scale) });
    for (const j of todo) {
      if (!urls[j.node]) throw new Error(`Figma could not render ${j.node}`);
      const buf = await download(urls[j.node]);
      const file = `flat/${safeId(j.node)}.png`;
      writeFileSync(ws.file('assets/' + file), buf);
      const { width, height } = imageInfo(buf);
      manifest.flats[j.node] = { file, width, height, scale: j.scale, version, sha256: sha256(buf) };
      console.log(`  exported ${j.node} -> ${file} (${width}×${height}, scale ${j.scale})`);
    }
  }
  ws.writeJson('assets/manifest.json', manifest);
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) await exportStep(process.argv[2]);
