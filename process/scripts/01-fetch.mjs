#!/usr/bin/env node
// STEP 1  Figma -> workspace.   No AI, no guessing: pulls the exact raw node JSON plus every asset it references.
//
//   node process/scripts/01-fetch.mjs <figma-url>
//   node process/scripts/01-fetch.mjs <figma-url> --fixture process/fixtures/award     (offline: copy a saved raw + assets)
//
// Writes into the workspace:
//   raw.json                  untouched Figma REST response for the node (source of truth)
//   assets/images/<ref>.<ext> every image fill (original bytes)
//   assets/svg/<node>.svg     every vector-only subtree, rendered by Figma
//   assets/manifest.json      sha256 / size / natural dimensions of each asset
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { resolveWorkspace, safeId } from '../shared/workspace.mjs';
import { download, getImageFills, getNode, getRenders } from '../figma/api.mjs';
import { collectImageRefs, collectSvgRoots } from '../figma/nodes.mjs';
import { imageInfo, sha256 } from '../shared/image-info.mjs';

export async function fetchStep(urlOrDir, { fixture } = {}) {
  const ws = resolveWorkspace(urlOrDir);
  const images = join(ws.dir, 'assets/images');
  const svgs = join(ws.dir, 'assets/svg');
  const svgFailed = []; // svg roots Figma could not render
  mkdirSync(images, { recursive: true });
  mkdirSync(svgs, { recursive: true });
  if (ws.ref) ws.writeJson('meta.json', ws.ref);

  if (fixture) {
    const fx = resolve(fixture);
    cpSync(join(fx, 'raw.json'), ws.file('raw.json'));
    for (const d of ['images', 'svg']) if (existsSync(join(fx, d))) cpSync(join(fx, d), join(ws.dir, 'assets', d), { recursive: true });
    console.log(`  fixture copied from ${fx}`);
  } else {
    if (!ws.ref) throw new Error('Fetching needs a Figma URL');
    const { fileKey, nodeId } = ws.ref;
    const raw = await getNode(fileKey, nodeId);
    ws.writeJson('raw.json', raw);
    const root = raw.nodes[nodeId]?.document;
    if (!root) throw new Error(`Node ${nodeId} not in response (wrong node-id?)`);

    const refs = collectImageRefs(root);
    if (refs.length) {
      const urls = await getImageFills(fileKey);
      for (const ref of refs) {
        if (!urls[ref]) throw new Error(`No URL for imageRef ${ref}`);
        const buf = await download(urls[ref]);
        writeFileSync(join(images, `${ref}.${imageInfo(buf).ext}`), buf);
      }
    }

    const roots = collectSvgRoots(root);
    if (roots.length) {
      const urls = await getRenders(fileKey, roots.map((n) => n.id), 'svg');
      for (const n of roots) {
        // Figma renders nothing for some nodes (a mask vector has no render bounds): one such node must not stop the whole fetch.
        // It stays a plain node in the tree and is listed in the manifest, the build reports it (owner decision 2026-10-27).
        if (!urls[n.id]) { svgFailed.push({ id: n.id, name: n.name }); console.log(`  ! Figma could not render svg for ${n.id} "${n.name}": kept as a plain node`); continue; }
        writeFileSync(join(svgs, `${safeId(n.id)}.svg`), await download(urls[n.id]));
      }
    }
  }

  // Manifest is built from what is on disk, so fixture and live runs behave identically
  const manifest = { images: {}, svgs: {}, ...(svgFailed.length && { svgFailed }) };
  for (const f of readdirSync(images)) {
    const buf = readFileSync(join(images, f));
    manifest.images[basename(f, extname(f))] = { file: `images/${f}`, bytes: buf.length, sha256: sha256(buf), ...imageInfo(buf) };
  }
  for (const f of readdirSync(svgs)) {
    const buf = readFileSync(join(svgs, f));
    manifest.svgs[basename(f, '.svg')] = { file: `svg/${f}`, bytes: buf.length, sha256: sha256(buf) };
  }
  ws.writeJson('assets/manifest.json', manifest);

  console.log(`  raw.json + ${Object.keys(manifest.images).length} images + ${Object.keys(manifest.svgs).length} svg -> ${ws.dir}`);
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const fx = args.indexOf('--fixture');
  const fixture = fx >= 0 ? args.splice(fx, 2)[1] : undefined;
  await fetchStep(args[0], { fixture });
}
