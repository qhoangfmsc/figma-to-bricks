import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { figmaGet } from './process/modules/read-figma/api.mjs';
import { readTemplate, buildTemplate } from './process/template.mjs';
import { parseFrameInput } from './process/modules/single-template/frames.mjs';
import { parsePlan } from './process/modules/missing-content/index.mjs';
import { MISSING, choiceOf } from './process/modules/missing-content/choices.mjs';

const skip = new Set(['39:6485', '142:3807', '2097:7350']);
const roots = [
  ['Homepage 2026', 'cLbX6E4TL45F6k2WYE5TCQ', '1:3517'],
  ['Homepage', 'M1jYQKqMc2wnSEuxOcDxR2', '994:21255'],
  ['Homepage', 'M1jYQKqMc2wnSEuxOcDxR2', '961:23353'],
  ['Homepage', 'M1jYQKqMc2wnSEuxOcDxR2', '961:23540'],
  ['LDP IT Prospeak', 'tEtTrwnzPZe4GkangPN4Ae', '307:6932'],
  ['VPS Landing', '60M3Tb1u0wNCgXcQG8x5z0', '2368:80484'],
  ['VPS Windows', 'IonA5bnHDbm0CfAhWMA75n', '112:1369'],
  ['VPS Linux', 'NcaLAzM0EyDXVnHwqAjOR0', '112:1369'],
  ['PageSpeed', '4Fg9060CBIg7qeFxJzWiru', '1587:4864'],
  ['Domain', '3orMAEhB0WwXwDgr6RbZ4e', '2676:6308'],
];

async function kids(file, id) {
  const data = await figmaGet(`/v1/files/${file}/nodes?ids=${encodeURIComponent(id)}&depth=2`);
  const doc = data.nodes?.[id]?.document;
  return (doc?.children ?? []).filter((c) => c.visible !== false && ['FRAME', 'INSTANCE', 'COMPONENT', 'SECTION'].includes(c.type)).map((c) => {
    const b = c.absoluteBoundingBox ?? {};
    return { id: c.id, name: c.name, w: Math.round(b.width ?? 0), h: Math.round(b.height ?? 0) };
  }).filter((c) => c.w >= 1000 && c.h >= 80);
}

function answersOf(planPath) {
  const raw = parsePlan(readFileSync(planPath, 'utf8'));
  const answers = {};
  for (const [key, value] of Object.entries(raw)) {
    const group = key.split(':')[0];
    const text = String(value ?? '').trim();
    if (group === 'answer' && text && text !== MISSING) answers[key] = { choice: 'text', text };
    else if (group === 'count' && /^\d+$/.test(text)) answers[key] = { choice: 'set', count: Number(text) };
    else if (group === 'alt' && text && text !== MISSING) answers[key] = { choice: 'text', text };
    else     if (group === 'link' && /^(https?:\/\/|\/|#|mailto:|tel:)/.test(text)) answers[key] = { choice: 'url', href: text };
    else if (choiceOf(group, text)) answers[key] = text;
    else answers[key] = '';
  }
  return answers;
}

const jobs = [];
for (const [page, file, id] of roots) {
  const list = await kids(file, id);
  for (const child of list) {
    let parts = [child];
    if (child.h > 3000) {
      const inner = await kids(file, child.id);
      if (inner.length >= 3) parts = inner;
    }
    for (const part of parts) {
      if (skip.has(part.id)) continue;
      jobs.push({ page, file, ...part });
    }
  }
}
console.log(`SECTIONS ${jobs.length}`);
writeFileSync('/tmp/f2b-pages-list.json', JSON.stringify(jobs, null, 2));
const logPath = '/tmp/f2b-pages.jsonl';
for (const job of jobs) {
  const node = job.id.replace(':', '-');
  const url = `https://www.figma.com/design/${job.file}/x?node-id=${node}`;
  const row = { page: job.page, name: job.name, id: job.id, url };
  const donePath = `history/runs/${job.file}/${node}/state.json`;
  if (existsSync(donePath)) {
    const done = JSON.parse(readFileSync(donePath, 'utf8'));
    if (done.builderUrl) {
      row.ok = true;
      row.builderUrl = done.builderUrl;
      row.skipped = true;
      appendFileSync(logPath, JSON.stringify(row) + '\n');
      console.log(`SKIP ${row.builderUrl}`);
      continue;
    }
  }
  console.log(`START ${job.page} ${job.name} ${job.id}`);
  try {
    const parsed = parseFrameInput({ desktop: url, widescreen: '', tablet: '', landscape: '', mobile: '' });
    await readTemplate(parsed.frames, { log: (line) => console.log(`  ${line}`) });
    const plan = `history/runs/${job.file}/${node}/plan.md`;
    const answers = answersOf(plan);
    writeFileSync(plan.replace(/plan\.md$/, 'choices.json'), JSON.stringify(answers, null, 2));
    const result = await buildTemplate(url, answers, { log: (line) => console.log(`  ${line}`) });
    row.ok = true;
    row.builderUrl = result.builderUrl;
    row.title = result.title;
    row.look = result.frames?.[0]?.look ?? null;
    row.verdict = result.frames?.[0]?.verdict ?? null;
  } catch (e) {
    const statePath = `history/runs/${job.file}/${node}/state.json`;
    const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
    row.ok = !!state.builderUrl;
    row.builderUrl = state.builderUrl ?? '';
    row.error = String(e.message ?? e).slice(0, 400);
  }
  appendFileSync(logPath, JSON.stringify(row) + '\n');
  console.log(`END ${row.ok ? 'OK' : 'FAIL'} ${row.builderUrl || row.error}`);
}
console.log('BATCH DONE');
