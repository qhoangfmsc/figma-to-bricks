// Host side of the Playwright QA runner. The browsers run inside the image named by QA_IMAGE, never on the owner's machine.
// The first verify builds that image from process/modules/visual-check.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env, isLocalSite, siteUrl } from '../common/env.mjs';

// Same image on every machine. .env.local can override it. It is not a site setting.
const image = () => env.QA_IMAGE || 'f2b-qa:1';
const SCRIPT = fileURLToPath(new URL('../visual-check/check.mjs', import.meta.url));
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 1 << 28 });

export function ensureQaImage() {
  if (docker('info').status !== 0) throw new Error('Docker is not running: start Docker Desktop (the QA browsers run in a container)');
  const name = image();
  if (docker('image', 'inspect', name).status !== 0) {
    console.log(`  building the QA image ${name} (first run only: Playwright + 3 browsers)…`);
    const b = docker('build', '-t', name, fileURLToPath(new URL('../visual-check', import.meta.url)));
    if (b.status !== 0) throw new Error(`could not build ${name}: ${b.stderr.slice(-400)}`);
  }
}

// job: { url, rootId, freezeTime, frames: [{ key, width, items, props, hit, maskIds, figmaPng (file path on the host, optional), crossBrowsers }] }
export function runQa(ws, job) {
  ensureQaImage();
  const dir = ws.file('qa');
  rmSync(join(dir, 'out'), { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = job.frames.map((f) => {
    if (f.figmaPng && existsSync(f.figmaPng)) { const name = `figma.${f.key}.png`; copyFileSync(f.figmaPng, join(dir, name)); return { ...f, figmaPng: `/job/${name}` }; }
    return { ...f, figmaPng: null };
  });
  const wp = siteUrl();
  const hostPort = isLocalSite(wp) ? Number(wp.port || (wp.protocol === 'https:' ? 443 : 80)) : 0;
  writeFileSync(join(dir, 'job.json'), JSON.stringify({ ...job, frames, hostPort }));
  const tDocker = Date.now();
  const r = docker('run', '--rm', '--ipc=host', '--add-host=host.docker.internal:host-gateway', '-v', `${dir}:/job`, '-v', `${SCRIPT}:/qa/check.mjs:ro`, image(), 'node', '/qa/check.mjs', '/job/job.json');
  if (r.status !== 0) throw new Error(`QA run failed: ${(r.stderr || r.stdout).slice(-800)}`);
  const result = JSON.parse(readFileSync(join(dir, 'out/result.json'), 'utf8'));
  result.timing = { ...(result.timing ?? {}), docker_total: Date.now() - tDocker }; // container start + everything inside
  return { result, outDir: join(dir, 'out') };
}

// Optimize the bitmaps of a workspace for the web: png / jpg -> webp (alpha kept, never upscaled), inside the same Docker image.
// -> Map(assetFile -> optimizedAssetFile), cached by content hash. Photos are capped at 1600px on the long edge; flat exports (artwork rendered by
// Figma at 2x for a big frame) keep their size. svg is left alone.
export function optimizeAssets(ws, files, { photoMaxEdge = 1600, quality = 86 } = {}) {
  const todo = [];
  const map = new Map();
  for (const file of files) {
    if (!/\.(png|jpe?g)$/i.test(file)) continue;
    const buf = readFileSync(ws.file('assets/' + file));
    const flat = file.startsWith('flat/');
    const key = createHash('sha1').update(buf).update(`${flat ? 0 : photoMaxEdge}|${quality}`).digest('hex').slice(0, 20);
    const dst = `optimized/${key}.webp`;
    map.set(file, dst);
    if (!existsSync(ws.file('assets/' + dst))) todo.push({ src: `/assets/${file}`, dst: `/assets/${dst}`, maxEdge: flat ? 0 : photoMaxEdge, quality });
  }
  if (todo.length) {
    ensureQaImage();
    mkdirSync(ws.file('assets/optimized'), { recursive: true });
    writeFileSync(ws.file('assets/optimize.json'), JSON.stringify({ files: todo }));
    const r = docker('run', '--rm', '-v', `${ws.file('assets')}:/assets`, '-v', `${fileURLToPath(new URL('../visual-check/optimize.mjs', import.meta.url))}:/qa/optimize.mjs:ro`, image(), 'node', '/qa/optimize.mjs', '/assets/optimize.json');
    if (r.status !== 0) throw new Error(`image optimization failed: ${(r.stderr || r.stdout).slice(-600)}`);
    const out = JSON.parse(readFileSync(ws.file('assets/optimize.out.json'), 'utf8'));
    const before = todo.reduce((s, t) => s + readFileSync(ws.file(t.src.replace('/assets/', 'assets/'))).length, 0);
    const after = out.reduce((s, o) => s + o.bytes, 0);
    console.log(`  optimized ${out.length} image(s) to webp: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
  }
  return map;
}
