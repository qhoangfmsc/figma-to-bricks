#!/usr/bin/env node
// Clicks the widgets of a built page on WP_URL (accordion, tabs, slider, read more).
//   node process/modules/maintenance/interact.mjs <url> [<width>]
// Headless Playwright on this machine. The url is opened as written.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../visual-check/interact.mjs', import.meta.url));
const [urlArg, width = '1440'] = process.argv.slice(2);
if (!urlArg) {
  console.error('usage: interact.mjs <url of the page to click through> [width]');
  process.exit(1);
}
const run = spawnSync(process.execPath, [SCRIPT, urlArg, width], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (run.status !== 0) {
  console.error((run.stderr || run.stdout).slice(-800));
  process.exit(1);
}
const report = JSON.parse(run.stdout.trim().split('\n').at(-1));
const yes = (value) => (value ? 'yes' : 'NO');
for (const [i, accordion] of report.accordions.entries()) {
  console.log(`accordion ${i + 1}: ${accordion.length} item(s)`);
  for (const item of accordion) console.log(`  ${item.item}. "${item.title}": ${item.hasContent ? 'has content' : 'EMPTY (no answer: opens nothing)'} · open at load ${yes(item.openAtLoad)} · toggles on click ${yes(item.toggles)}`);
}
for (const [i, tabs] of report.tabs.entries()) {
  console.log(`tabs ${i + 1}:`);
  for (const tab of tabs) console.log(`  ${tab.tab}. "${tab.title}": panes shown ${JSON.stringify(tab.panesShown)} · only its own pane ${yes(tab.onlyItsPane)}`);
}
for (const [i, slider] of report.sliders.entries()) console.log(`slider ${i + 1}: ${slider.slides} slide(s) · next arrow ${yes(slider.hasNextArrow)}${slider.hasNextArrow ? ` · track moves on click ${yes(slider.trackMovesOnNext)}` : ' (none drawn in Figma)'}`);
for (const [i, more] of report.readMore.entries()) console.log(`read more ${i + 1} "${more.label}": closed ${more.closedHeight}px -> open ${more.openHeight}px · opens ${yes(more.opens)} · closes on 2nd click ${yes(more.closesAgain)}`);
if (!report.accordions.length && !report.tabs.length && !report.sliders.length && !report.readMore.length) console.log('no accordion / tabs / slider on this page');
