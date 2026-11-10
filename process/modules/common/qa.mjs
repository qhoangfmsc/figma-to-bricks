// Playwright and image optimization run on this machine, against WP_URL in .env.
// Headless only: no browser window. Chromium, Firefox and WebKit come from the playwright package in process/.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeOptimized } from '../visual-check/optimize.mjs';

const SCRIPT = fileURLToPath(new URL('../visual-check/check.mjs', import.meta.url));

export function runQa(ws, job) {
  const dir = ws.file('qa');
  const outDir = join(dir, 'out');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const frames = job.frames.map((f) => ({ ...f, figmaPng: f.figmaPng && existsSync(f.figmaPng) ? f.figmaPng : null }));
  const jobFile = join(dir, 'job.json');
  writeFileSync(jobFile, JSON.stringify({ ...job, frames, outDir }));
  const started = Date.now();
  const run = spawnSync(process.execPath, [SCRIPT, jobFile], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (run.status !== 0) {
    const detail = (run.stderr || run.stdout || '').slice(-800);
    throw new Error(`QA run failed. Install browsers with: yarn --cwd process playwright install chromium firefox webkit\n${detail}`);
  }
  const result = JSON.parse(readFileSync(join(outDir, 'result.json'), 'utf8'));
  result.timing = { ...(result.timing ?? {}), qa_total: Date.now() - started };
  return { result, outDir };
}

// png / jpg -> webp (alpha kept, never upscaled). Photos cap at 1600px on the long edge. Flat exports keep their size. SVG is left alone.
export async function optimizeAssets(ws, files, { photoMaxEdge = 1600, quality = 86 } = {}) {
  const todo = [];
  const map = new Map();
  for (const file of files) {
    if (!/\.(png|jpe?g)$/i.test(file)) continue;
    const buf = readFileSync(ws.file('assets/' + file));
    const flat = file.startsWith('flat/');
    const key = createHash('sha1').update(buf).update(`${flat ? 0 : photoMaxEdge}|${quality}`).digest('hex').slice(0, 20);
    const dst = `optimized/${key}.webp`;
    map.set(file, dst);
    if (!existsSync(ws.file('assets/' + dst))) todo.push({ src: ws.file('assets/' + file), dst: ws.file('assets/' + dst), maxEdge: flat ? 0 : photoMaxEdge, quality });
  }
  if (todo.length) {
    mkdirSync(ws.file('assets/optimized'), { recursive: true });
    const out = await writeOptimized(todo);
    const before = todo.reduce((sum, item) => sum + readFileSync(item.src).length, 0);
    const after = out.reduce((sum, item) => sum + item.bytes, 0);
    console.log(`  optimized ${out.length} image(s) to webp: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
  }
  return map;
}
