// Behaviour check of the widgets of a built page: "usable", not only "looks like Figma". Runs INSIDE the f2b-qa Docker image.
//   node /qa/interact.mjs <url> [<width>]   -> prints one JSON result on the last line
//   accordion-nested  every title is clicked twice: the content toggles (an item drawn open starts open, so the first click closes it)
//   tabs-nested       every tab title is clicked: its pane is the one that shows
//   slider-nested     the next arrow (when there is one) is clicked: the track moves
//   read more         the "Xem thêm" button (a click interaction on a class): the clipped frame grows to its full height, the second click closes it
// A widget the page does not have is not reported. An empty content block (an answer the owner did not give) is reported as "empty", never as a pass.
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire('/qa/');
const { chromium } = require('playwright');

const [url, width = '1440'] = process.argv.slice(2);
// the site is on the Docker host (WP_URL = http://localhost:8080): forward localhost:8080 of this container to it
for (const host of ['0.0.0.0', '::1']) {
  const srv = net.createServer((c) => { const t = net.connect(8080, 'host.docker.internal'); c.pipe(t); t.pipe(c); c.on('error', () => t.destroy()); t.on('error', () => c.destroy()); });
  srv.on('error', () => {}); srv.listen(8080, host);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto(url.replace('host.docker.internal', 'localhost'), { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const report = { url, width: Number(width), accordions: [], tabs: [], sliders: [], readMore: [] };
const shown = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 1; });

for (const acc of await page.locator('.brxe-accordion-nested').all()) {
  const items = [];
  const titles = await acc.locator('.accordion-title-wrapper').all();
  for (const [i, title] of titles.entries()) {
    const item = title.locator('xpath=..');
    const content = item.locator(':scope > .accordion-content-wrapper');
    const text = ((await content.count()) ? (await content.first().innerText().catch(() => '')) : '').trim();
    const state = async () => ((await content.count()) ? shown(content.first()) : false);
    const s0 = await state();
    await title.scrollIntoViewIfNeeded();
    await title.click();
    await page.waitForTimeout(700);
    const s1 = await state();
    await title.click();
    await page.waitForTimeout(700);
    const s2 = await state();
    items.push({ item: i + 1, title: (await title.innerText()).trim().slice(0, 50), hasContent: text.length > 0, openAtLoad: s0, toggles: s1 !== s0 && s2 !== s1 });
  }
  report.accordions.push(items);
}

for (const tabs of await page.locator('.brxe-tabs-nested').all()) {
  const out = [];
  const titles = await tabs.locator('.tab-title').all(), panes = await tabs.locator('.tab-pane').all();
  for (const [i, t] of titles.entries()) {
    await t.click();
    await page.waitForTimeout(300);
    const visible = [];
    for (const [j, p] of panes.entries()) if (await shown(p)) visible.push(j + 1);
    out.push({ tab: i + 1, title: (await t.innerText()).trim().slice(0, 40), panesShown: visible, onlyItsPane: visible.length === 1 && visible[0] === i + 1 });
  }
  report.tabs.push(out);
}

for (const sl of await page.locator('.brxe-slider-nested').all()) {
  const next = sl.locator('.splide__arrow--next');
  const track = sl.locator('.splide__list');
  const x0 = await track.evaluate((el) => el.getBoundingClientRect().x).catch(() => null);
  const hasArrow = (await next.count()) > 0 && await shown(next.first());
  let moved = null;
  if (hasArrow) { await next.first().click(); await page.waitForTimeout(900); moved = (await track.evaluate((el) => el.getBoundingClientRect().x)) !== x0; }
  report.sliders.push({ slides: await sl.locator('.splide__slide').count(), hasNextArrow: hasArrow, trackMovesOnNext: moved });
}
for (const btn of await page.locator('[data-interactions*="read-more-open"]').all()) {
  if (!(await btn.isVisible())) continue; // the button of another breakpoint frame
  const sel = JSON.parse(await btn.getAttribute('data-interactions'))[0].targetSelector;
  const target = page.locator(sel).first();
  const h = async () => (await target.boundingBox())?.height ?? 0;
  const h0 = await h();
  await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(500);
  const h1 = await h();
  await btn.click(); await page.waitForTimeout(500);
  const h2 = await h();
  report.readMore.push({ label: (await btn.innerText()).trim(), closedHeight: Math.round(h0), openHeight: Math.round(h1), opens: h1 > h0 + 1, closesAgain: Math.abs(h2 - h0) < 2 });
}
console.log(JSON.stringify(report));
await browser.close();
process.exit(0);
