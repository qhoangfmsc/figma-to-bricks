// QA runner. Runs INSIDE the f2b-qa Docker image (Playwright + chromium / firefox / webkit + pngjs), never on the owner's machine.
//   node /qa/check.mjs /job/job.json        -> writes /job/out/result.json (+ screenshots, diffs)
// One job = one Bricks page rendered at one or more frame widths. Per frame it measures, in a frozen, animation-free page:
//   boxes      x / y / w / h and the computed css the tree demands (the numeric verify of the pipeline)
//   visual     the screenshot against Figma's own render of that frame (mean abs RGB difference per cell, masks for live parts)
//   occlusion  for every text / button / image: is the element on top at its own center? (a covered layer is invisible to a box check)
//   overflow   horizontal scroll at that width, content wider than the viewport
//   network    every image the page really downloaded, weight, and the ones that were hidden (display:none) but still loaded
//   console    page errors and failed requests
// With `crossBrowsers` the base frame is also rendered in the other engines and compared with chromium.
import net from 'node:net';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/qa/');
const { chromium, firefox, webkit } = require('playwright');
const { PNG } = require('pngjs');

const jobFile = process.argv[2];
const job = JSON.parse(readFileSync(jobFile, 'utf8'));
const out = '/job/out';
mkdirSync(out, { recursive: true });

// The site is on the Docker host (WP_URL = http://localhost:8080): forward localhost:8080 of this container to it, for every engine.
for (const host of ['0.0.0.0', '::1']) {
  const srv = net.createServer((c) => { const t = net.connect(Number(job.hostPort ?? 8080), 'host.docker.internal'); c.pipe(t); t.pipe(c); c.on('error', () => t.destroy()); t.on('error', () => c.destroy()); });
  srv.on('error', () => {});
  srv.listen(Number(job.hostPort ?? 8080), host);
}

const decode = (buf) => PNG.sync.read(buf);

// 3x3 box blur over white, applied to BOTH pictures before they are compared: a sub-pixel shift of a QR code, dots or glyph edges is
// anti-aliasing, not a difference the eye sees. A missing text, a wrong crop or a covered layer is far larger than that and still shows.
function blur3(img, bg = [255, 255, 255]) {
  const { width: w, height: h, data } = img;
  const flat = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const a = data[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) flat[i * 3 + c] = data[i * 4 + c] * a + bg[c] * (1 - a); }
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += flat[(yy * w + xx) * 3 + c]; n++; } }
      out.data[(y * w + x) * 4 + c] = s / n;
    }
    out.data[(y * w + x) * 4 + 3] = 255;
  }
  return out;
}

// ---- visual diff (same metric as before so numbers stay comparable): mean abs RGB difference, per cell and overall
function visualDiff(figmaBuf, shotBuf, { cell = 80, masks = [], bg = [255, 255, 255] } = {}) {
  const rawA = decode(figmaBuf);
  let clear = 0; for (let i = 3; i < rawA.data.length; i += 4) if (rawA.data[i] < 250) clear++;
  const transparent = clear / (rawA.width * rawA.height); // share of Figma's picture where nothing is drawn (the page frame would show through)
  const A = blur3(rawA, bg), B = blur3(decode(shotBuf));
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const sums = new Float64Array(cols * rows), counts = new Float64Array(cols * rows);
  const diff = new PNG({ width: w, height: h });
  const masked = (x, y) => masks.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);
  let total = 0, n = 0;
  // Figma exports transparency where nothing is drawn; the browser shows the page's own white there, so both pictures are laid over white
  const px = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; }; // both are already laid over their background by blur3
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    let d = 0;
    if (!masked(x, y)) { const a = px(A, x, y), b = px(B, x, y); d = (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3; total += d; n++; }
    const k = Math.floor(y / cell) * cols + Math.floor(x / cell);
    sums[k] += d; counts[k]++;
    const v = Math.min(255, d * 4);
    diff.data[o] = v; diff.data[o + 1] = v; diff.data[o + 2] = v; diff.data[o + 3] = 255;
  }
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: c * cell, y: r * cell, w: Math.min(cell, w - c * cell), h: Math.min(cell, h - r * cell), diff: sums[r * cols + c] / counts[r * cols + c] });
  return { mean: n ? total / n : 0, transparent, cell, width: w, height: h, cells, diffPng: PNG.sync.write(diff) };
}

// ---- code that runs inside the page
const PAGE_MEASURE = ({ rootId, items, props, hit }) => {
  const root = document.getElementById(rootId);
  if (!root) return { error: `root element #${rootId} not found` };
  const rr = root.getBoundingClientRect();
  const nodes = {};
  for (const it of items) {
    const el = document.getElementById('brxe-' + it.b);
    if (!el) { nodes[it.f] = null; continue; }
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), css = {};
    for (const p of props) css[p] = cs.getPropertyValue(p);
    const attrs = {};
    for (const a of it.a) { const t = el.hasAttribute(a) ? el : el.querySelector('[' + a + ']'); attrs[a] = t ? t.getAttribute(a) : null; }
    nodes[it.f] = { x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height, css, attrs };
  }
  // occlusion: the element that is really on top at the center of each visible text / button / image
  const covered = [];
  for (const it of hit) {
    const el = document.getElementById('brxe-' + it.b);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2) continue;
    if (el.closest('[style*="display: none"]')) continue;
    let hiddenAncestor = false;
    for (let p = el.parentElement; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') { hiddenAncestor = true; break; }
    if (hiddenAncestor) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; // the viewport is as tall as the page
    // The layers above this element at its center, top first. Covered = one of them PAINTS something there (a background, an image, an svg, text, a painted
    // ::before / ::after): a transparent wrapper (an absolute "Navigation" box holding two arrows) hides nothing the eye can see, however elementFromPoint answers.
    const stack = document.elementsFromPoint(x, y);
    const at = stack.findIndex((e) => e === el || el.contains(e));
    const above = at < 0 ? stack : stack.slice(0, at);
    const paintsHere = (e) => {
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (['IMG', 'svg', 'VIDEO', 'CANVAS', 'PICTURE'].includes(e.tagName)) return true;
      const solid = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); return !!m && (m[1].split(',').length < 4 || Number(m[1].split(',')[3]) > 0.02); };
      if (solid(cs.backgroundColor) || cs.backgroundImage !== 'none') return true;
      for (const pseudo of ['::before', '::after']) { const p = getComputedStyle(e, pseudo); if (p.content !== 'none' && p.display !== 'none' && (solid(p.backgroundColor) || p.backgroundImage !== 'none')) return true; }
      return [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    };
    const top = above.find(paintsHere);
    // something Figma itself paints above this layer (a strikethrough line over an old price, a badge on a photo) is expected on top
    const expected = !!top && (it.over ?? []).some((id) => { const a = document.getElementById('brxe-' + id); return a && (a === top || a.contains(top)); });
    if (top && !expected) covered.push({ f: it.f, name: it.name ?? '', on_top: `${top.tagName.toLowerCase()}#${top.id}`, topLabel: top.closest('[id^="brxe-"]')?.id ?? '' });
  }
  // images: what the page asked for and what is hidden
  const images = [...document.images].map((im) => {
    let hidden = false;
    for (let p = im; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') { hidden = true; break; }
    return { src: im.currentSrc || im.src, hidden, loaded: im.complete && im.naturalWidth > 0, loading: im.loading, w: im.naturalWidth, h: im.naturalHeight, shownW: Math.round(im.getBoundingClientRect().width) };
  });
  const h1 = [...document.querySelectorAll('h1')].filter((e) => e.getClientRects().length).length; // visible ones
  const noAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).length;
  return {
    nodes, rootRect: { x: rr.left + scrollX, y: rr.top + scrollY, w: rr.width, h: rr.height },
    covered, images, h1, imagesWithoutAltAttr: noAlt,
    overflow: { scrollWidth: document.documentElement.scrollWidth, innerWidth, over: document.documentElement.scrollWidth > innerWidth },
  };
};

const T0 = Date.now();
async function renderFrame(browserType, frame, { name }) {
  const t = { start: Date.now() }; // phase timing (ms), written to result.json: where the time of a verify goes
  const browser = await browserType.launch({ args: browserType === chromium ? ['--no-sandbox', '--font-render-hinting=none'] : [] });
  const context = await browser.newContext({ viewport: { width: frame.width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const page = await context.newPage();
  const log = { console: [], failed: [], bytes: new Map() };
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => log.console.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('requestfailed', (r) => log.failed.push(`${r.url().slice(0, 120)} ${r.failure()?.errorText ?? ''}`));
  page.on('response', async (res) => { const ct = res.headers()['content-type'] ?? ''; if (ct.startsWith('image/')) { try { log.bytes.set(res.url(), (await res.body()).length); } catch { /* streamed */ } } });
  t.launch = Date.now();
  if (job.freezeTime) { await page.clock.install({ time: new Date(job.freezeTime) }); }
  await page.goto(job.url, { waitUntil: 'load' });
  t.load = Date.now();
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.evaluate(() => document.fonts.ready);
  // make the viewport as tall as the page FIRST, so that every element can be hit-tested, nothing is below the fold and Bricks' lazy loading (an
  // IntersectionObserver) fires for all of them; then wait for the lazy elements that are rendered. An element hidden with display:none never leaves
  // `.bricks-lazy-hidden` (nothing intersects it): waiting for it always ran into the 15 s timeout (it was 15 s of every 16 s of a render)
  const pageHeight = () => page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  let docH = await pageHeight();
  await page.setViewportSize({ width: frame.width, height: docH });
  await page.waitForFunction(() => ![...document.querySelectorAll('.bricks-lazy-hidden')].some((e) => e.getClientRects().length), null, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  t.settled = Date.now();
  if (job.freezeTime) { await page.clock.pauseAt(new Date(new Date(job.freezeTime).getTime() + 1000)).catch(() => {}); }
  const docH2 = await pageHeight(); // the page can grow while fonts and images arrive
  if (docH2 !== docH) { docH = docH2; await page.setViewportSize({ width: frame.width, height: docH }); }
  await page.waitForTimeout(300);
  t.sized = Date.now();
  const measured = await page.evaluate(PAGE_MEASURE, { rootId: job.rootId, items: frame.items, props: frame.props, hit: frame.hit ?? [] });
  if (measured.error) { await browser.close(); return { error: measured.error }; }
  t.measured = Date.now();
  const shot = await page.screenshot({ clip: { x: measured.rootRect.x, y: measured.rootRect.y, width: measured.rootRect.w, height: measured.rootRect.h }, animations: 'disabled' });
  for (const im of measured.images) im.bytes = log.bytes.get(im.src) ?? null;
  await browser.close();
  t.end = Date.now();
  return { timing: { launch: t.launch - t.start, load: t.load - t.launch, settle: t.settled - t.load, resize: t.sized - t.settled, measure: t.measured - t.sized, shot_close: t.end - t.measured }, measured, shot, log: { console: log.console.slice(0, 20), failed: log.failed.slice(0, 20) } };
}

const result = { frames: {}, engines: {}, timing: {} };
for (const frame of job.frames) {
  const r = await renderFrame(chromium, frame, { name: 'chromium' });
  if (r.timing) result.timing[`${frame.key}.chromium`] = r.timing;
  if (r.error) { result.frames[frame.key] = { error: r.error }; continue; }
  writeFileSync(`${out}/${frame.key}.png`, r.shot);
  const entry = { measured: r.measured, log: r.log, shot: `${frame.key}.png` };
  // masks: live parts (countdown) are not compared with the static Figma numbers
  const masks = (frame.maskIds ?? []).map((id) => r.measured.nodes[id]).filter(Boolean).map((n) => ({ x: Math.floor(n.x), y: Math.floor(n.y), w: Math.ceil(n.w), h: Math.ceil(n.h) }));
  if (frame.figmaPng) {
    const hex = frame.figmaBg; const bg = hex ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : [255, 255, 255];
    const vd = visualDiff(readFileSync(frame.figmaPng), r.shot, { masks, bg });
    writeFileSync(`${out}/${frame.key}.diff.png`, vd.diffPng);
    delete vd.diffPng;
    entry.visual = { ...vd, masks };
  }
  result.frames[frame.key] = entry;
  // other engines: same page, compared with chromium's screenshot (consistency, not Figma)
  if (frame.crossBrowsers) {
    for (const [name, bt] of [['webkit', webkit], ['firefox', firefox]]) {
      try {
        const o = await renderFrame(bt, frame, { name });
        if (o.timing) result.timing[`${frame.key}.${name}`] = o.timing;
        if (o.error) { result.engines[`${frame.key}.${name}`] = { error: o.error }; continue; }
        const vd = visualDiff(r.shot, o.shot, { masks });
        delete vd.diffPng;
        result.engines[`${frame.key}.${name}`] = { mean: vd.mean, worst: vd.cells.sort((a, b) => b.diff - a.diff).slice(0, 5), overflow: o.measured.overflow, covered: o.measured.covered.length, console: o.log.console.slice(0, 5) };
        writeFileSync(`${out}/${frame.key}.${name}.png`, o.shot);
      } catch (e) { result.engines[`${frame.key}.${name}`] = { error: String(e).slice(0, 300) }; }
    }
  }
}
result.timing.total_in_container = Date.now() - T0;
writeFileSync(`${out}/result.json`, JSON.stringify(result));
console.log('qa done');
process.exit(0);
