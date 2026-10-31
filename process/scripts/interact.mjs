#!/usr/bin/env node
// Host side of qa/interact.mjs: do the widgets of a built page work when a user clicks them (accordion opens, tab switches, slider moves)?
//   node process/scripts/interact.mjs [<url>] [<width>]     default url = the shared preview page of the verify step (WP_URL/?page_id=<preview page>)
// Runs in the f2b-qa Docker image, never on the owner's machine. Run it right after a run: the preview page holds the last verified section.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureQaImage } from '../shared/qa.mjs';
import { env } from '../shared/env.mjs';

const SCRIPT = fileURLToPath(new URL('../qa/interact.mjs', import.meta.url));
const [urlArg, width = '1440'] = process.argv.slice(2);
if (!urlArg) { console.error('usage: interact.mjs <url of the page to click through> [width]  (the preview page of the last verify is printed in verify.md: "Rendered with Playwright … <url>")'); process.exit(1); }
ensureQaImage();
const wp = new URL(env.WP_URL ?? 'http://localhost:8080');
const r = spawnSync('docker', ['run', '--rm', '--ipc=host', '--add-host=host.docker.internal:host-gateway', '-v', `${SCRIPT}:/qa/interact.mjs:ro`, env.QA_IMAGE ?? 'f2b-qa:1', 'node', '/qa/interact.mjs', urlArg.replace(wp.origin, `http://host.docker.internal:${wp.port || 8080}`), width], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (r.status !== 0) { console.error((r.stderr || r.stdout).slice(-800)); process.exit(1); }
const rep = JSON.parse(r.stdout.trim().split('\n').at(-1));
const yes = (b) => (b ? 'yes' : 'NO');
for (const [i, acc] of rep.accordions.entries()) {
  console.log(`accordion ${i + 1}: ${acc.length} item(s)`);
  for (const it of acc) console.log(`  ${it.item}. "${it.title}": ${it.hasContent ? 'has content' : 'EMPTY (no answer: opens nothing)'} · open at load ${yes(it.openAtLoad)} · toggles on click ${yes(it.toggles)}`);
}
for (const [i, t] of rep.tabs.entries()) { console.log(`tabs ${i + 1}:`); for (const x of t) console.log(`  ${x.tab}. "${x.title}": panes shown ${JSON.stringify(x.panesShown)} · only its own pane ${yes(x.onlyItsPane)}`); }
for (const [i, s] of rep.sliders.entries()) console.log(`slider ${i + 1}: ${s.slides} slide(s) · next arrow ${yes(s.hasNextArrow)}${s.hasNextArrow ? ` · track moves on click ${yes(s.trackMovesOnNext)}` : ' (none drawn in Figma)'}`);
for (const [i, r] of rep.readMore.entries()) console.log(`read more ${i + 1} "${r.label}": closed ${r.closedHeight}px -> open ${r.openHeight}px · opens ${yes(r.opens)} · closes on 2nd click ${yes(r.closesAgain)}`);
if (!rep.accordions.length && !rep.tabs.length && !rep.sliders.length && !rep.readMore.length) console.log('no accordion / tabs / slider on this page');
