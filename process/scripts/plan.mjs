#!/usr/bin/env node
// The owner's console for the Plan (process/plan/index.mjs): the document auto.mjs writes before the build and the owner fills.
//   node process/scripts/plan.mjs "<figma url>" status                 where the file is, how many values are filled, confirmed or not
//   node process/scripts/plan.mjs "<figma url>" set <key> "<value>"    fill one value without opening the file (key as written in the file, e.g. link:1587:2968)
//   node process/scripts/plan.mjs "<figma url>" confirm                validates every value and sets the line `Xác nhận: có` (the owner can also edit that line by hand)
// <figma url> is the same link that was given to auto.mjs. auto.mjs builds only a plan whose line says `Xác nhận: có`; a build resets it to `không`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolveWorkspace } from '../shared/workspace.mjs';
import { parseFigmaUrl } from '../figma/url.mjs';
import { planPaths, parsePlan, filled, confirmPlan, loadConfirmed, validateAnswers } from '../plan/index.mjs';

const [url, cmd, ...rest] = process.argv.slice(2);
if (!url || !/^https?:\/\//.test(url)) { console.error('usage: plan.mjs "<figma url>" status | set <key> "<value>" | confirm'); process.exit(1); }
const nodeKey = parseFigmaUrl(url).nodeId.replace(':', '-');
const dir = resolveWorkspace(url).dir.replace(/[^/]+$/, ''); // process/work/<fileKey>/
const { md } = planPaths(dir, nodeKey);

function status() {
  if (!existsSync(md)) { console.log(`  no plan yet (${md}): run node process/auto.mjs "${url}"`); return; }
  const a = parsePlan(readFileSync(md, 'utf8'));
  const problems = validateAnswers(a);
  console.log(`  ${md}\n  values filled: ${Object.keys(filled(a)).length} of ${Object.keys(a).length} · confirmed: ${loadConfirmed(dir, nodeKey) ? 'yes' : 'no'}`);
  for (const p of problems) console.log(`    ! ${p}`);
}

switch (cmd) {
  case 'status': status(); break;
  case 'set': {
    const [key, ...v] = rest;
    if (!key || !existsSync(md)) throw new Error(`usage: set <key> "<value>" (and the plan file must exist: ${md})`);
    const text = readFileSync(md, 'utf8').split('\n');
    const at = text.findIndex((l) => /^- /.test(l) && l.includes('`' + key + '`:'));
    if (at < 0) throw new Error(`no line with the key \`${key}\` in ${md}`);
    const value = v.join(' ').replace(/\s*\n\s*/g, ' ').trim();
    text[at] = text[at].slice(0, text[at].indexOf('`' + key + '`:') + key.length + 3) + (value ? ' ' + value : '');
    writeFileSync(md, text.join('\n'));
    console.log(`  ${key} = ${value || '(blank)'}  `);
    break;
  }
  case 'confirm': {
    const s = confirmPlan(dir, nodeKey);
    console.log(`  CONFIRMED ${s.confirmedAt}: ${s.answered} of ${s.total} values filled (blank ones keep the safe default).\n  next: node process/auto.mjs "${url}"`);
    break;
  }
  default: console.error('usage: plan.mjs "<figma url>" status | set <key> "<value>" | confirm'); process.exitCode = 1;
}
