#!/usr/bin/env node
// ONE template. Desktop URL in, a Bricks template out. Tablet and mobile URLs are that frame at the other widths.
// Widescreen is recorded and not merged. Nothing here assembles a WordPress page (that is process/auto.mjs).
//
//   node process/template.mjs read --desktop URL [--tablet URL] [--mobile URL] [--widescreen URL]
//   node process/template.mjs build --desktop URL --answers '<json>'
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkspace } from './shared/workspace.mjs';
import { fetchStep } from './scripts/01-fetch.mjs';
import { treeStep } from './scripts/02-tree.mjs';
import { detectStep } from './scripts/03-detect.mjs';
import { decide, writeDecisionReport } from './decide/index.mjs';
import { discoverFormErrors } from './figma/discover.mjs';
import { signOff } from './review/index.mjs';
import { figmaGet, enableRunCache, refreshRunCache } from './figma/api.mjs';
import { groupQuestions, GROUPS, keyOf, validateAnswers, filled, figmaLink, applyAnswers } from './plan/index.mjs';
import { runLines } from './shared/spawn-lines.mjs';
import { parseFrameInput } from './template/frames.mjs';
import { screenParts } from './template/parts.mjs';
import { attachExpandFrames } from './template/expand.mjs';

const flag = (args, name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
};

async function prepareFrame(url, { variant, formErrors }) {
  const ws = await fetchStep(url);
  treeStep(ws.dir);
  const prev = ws.readJson('detections.json', null);
  if (prev) {
    prev.components = prev.components.filter((c) => !String(c.note ?? '').startsWith('autopilot'));
    ws.writeJson('detections.json', prev);
  }
  detectStep(ws.dir);
  const result = decide(ws, { firstSection: false, variant, parentBg: null, formErrors });
  writeDecisionReport(ws, result, ws.readJson('tree.json').name);
  detectStep(ws.dir);
  return { ws, result };
}

function frameWidth(ws) {
  const box = ws.readJson('tree.json').box;
  return box?.w ?? null;
}

export async function readTemplate(frames, { log = () => {} } = {}) {
  enableRunCache();
  const desktop = frames.desktop;
  await refreshRunCache(desktop.fileKey);
  let formErrors = {};
  try {
    formErrors = await discoverFormErrors(desktop.fileKey, desktop.nodeId);
  } catch (e) {
    log(`Không đọc được error message cạnh frame: ${e.message}`);
  }
  const designName = (await figmaGet(`/v1/files/${desktop.fileKey}?depth=1`)).name;
  const prepared = {};
  for (const id of ['desktop', 'tablet', 'mobile']) {
    const frame = frames[id];
    if (!frame) continue;
    log(`Đọc ${frame.label} ${frame.nodeId}`);
    prepared[id] = await prepareFrame(frame.url, { variant: id !== 'desktop', formErrors: id === 'desktop' ? formErrors : {} });
    log(`${frame.label}: ${prepared[id].ws.readJson('tree.json').name} ${frameWidth(prepared[id].ws) ?? '?'}px`);
  }
  const base = prepared.desktop.ws;
  const tree = base.readJson('tree.json');
  const title = `${designName} - ${tree.name}`;
  const ov = base.readJson('overrides.json', {});
  ov.template = { ...(ov.template ?? {}), title, reason: 'naming convention: "<design name> - <section>"' };
  base.writeJson('overrides.json', ov);
  const variants = ['tablet', 'mobile'].filter((id) => prepared[id]).map((id) => ({
    key: frames[id].key,
    maxWidth: frames[id].maxWidth,
    workspace: prepared[id].ws.dir.split('/').pop(),
    width: frameWidth(prepared[id].ws),
  }));
  base.writeJson('responsive.json', {
    note: 'breakpoint frames pasted on Vietnix Tools (process/template.mjs). Widescreen is not a variant.',
    variants: variants.map(({ width, ...v }) => v),
  });
  base.writeJson('context.json', { bg: { base: null } });
  const det = base.readJson('detections.json');
  const counts = {};
  for (const c of det.components.filter((c) => c.status === 'approved')) counts[c.component] = (counts[c.component] ?? 0) + 1;
  const questions = groupQuestions(prepared.desktop.result.questions ?? []).flatMap((g) => g.items.map((item) => ({
    group: g.group,
    title: GROUPS[g.group].title(1).replace(/ 1 /, ' '),
    summary: GROUPS[g.group].summary,
    node: item.node,
    label: item.label,
    key: keyOf(g.group, item.node),
    value: GROUPS[g.group].value ?? '',
    figma: figmaLink(desktop.fileKey, item.node),
  })));
  const parts = screenParts(base.readJson('tree.json'), det.components, questions, desktop.fileKey);
  const widescreen = frames.widescreen
    ? { url: frames.widescreen.url, nodeId: frames.widescreen.nodeId, merged: false, reason: 'Bricks 1.9.8 không có breakpoint rộng hơn desktop, nên link này được ghi lại và không gộp vào template.' }
    : null;
  if (widescreen) log(`Widescreen ${widescreen.nodeId}: ghi lại, không gộp`);
  return {
    fileKey: desktop.fileKey,
    nodeId: desktop.nodeId,
    url: desktop.url,
    designName,
    title,
    name: tree.name,
    width: frameWidth(base),
    dir: base.dir,
    becomes: Object.entries(counts).map(([k, n]) => `${k} ×${n}`).join(', ') || 'block',
    questions,
    parts,
    variants: variants.map((v) => ({ key: v.key, width: v.width })),
    widescreen,
    designer: [...new Set(prepared.desktop.result.designer)],
  };
}

export async function buildTemplate(desktopUrl, answers, { log = () => {} } = {}) {
  const problems = validateAnswers(answers ?? {});
  if (problems.length) {
    const err = new Error(problems.join('\n'));
    err.problems = problems;
    throw err;
  }
  const base = resolveWorkspace(desktopUrl);
  if (!base.has('tree.json')) throw new Error('Chưa đọc Figma. Bấm Đọc Figma trước.');
  const applied = applyAnswers(base, filled(answers ?? {}));
  log(`Đã gắn ${applied.applied.length} giá trị`);
  await attachExpandFrames(base, { log });
  const note = 'the owner confirmed the values on the Vietnix Tools screen';
  signOff(base, { by: 'owner (vietnix tools)', note });
  const responsive = base.readJson('responsive.json', { variants: [] });
  for (const v of responsive.variants) {
    signOff(resolveWorkspace(join(dirname(base.dir), v.workspace)), { by: 'owner (vietnix tools)', note });
  }
  log('Đang export, build, đẩy template và verify');
  const run = await runLines('node', [join(dirname(new URL(import.meta.url).pathname), 'run.mjs'), desktopUrl, '--from=export', '--no-cross'], (line) => {
    if (line.trim()) log(line.trim().slice(0, 180));
  });
  const state = base.readJson('state.json', {});
  const verify = base.has('verify.json') ? base.readJson('verify.json') : null;
  if (!state.templateId) throw new Error(`Chưa tạo được template. ${(run.stderr || run.stdout).slice(-400)}`);
  const frames = [{ key: 'desktop', verify }];
  for (const v of responsive.variants) {
    const file = `verify.${v.key}.json`;
    frames.push({ key: v.key, verify: base.has(file) ? base.readJson(file) : null });
  }
  return {
    templateId: state.templateId,
    builderUrl: state.builderUrl,
    title: base.readJson('overrides.json', {}).template?.title ?? base.readJson('tree.json').name,
    frames: frames.map((f) => ({
      key: f.key,
      verdict: f.verify?.verdict ?? null,
      look: f.verify ? Math.round(f.verify.visualMean * 100) / 100 : null,
    })),
    verifyStatus: run.status,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const input = { desktop: flag(args, 'desktop'), tablet: flag(args, 'tablet'), mobile: flag(args, 'mobile'), widescreen: flag(args, 'widescreen') };
  const parsed = parseFrameInput(input);
  if (!cmd || !parsed.ok) {
    if (!parsed.ok) for (const e of parsed.errors) console.error(e);
    console.error('usage: node process/template.mjs read|build --desktop URL [--tablet URL] [--mobile URL] [--widescreen URL] [--answers JSON]');
    process.exit(1);
  }
  const log = (line) => console.log(line);
  try {
    if (cmd === 'read') {
      console.log(JSON.stringify(await readTemplate(parsed.frames, { log }), null, 2));
    } else if (cmd === 'build') {
      const raw = flag(args, 'answers');
      const answers = raw ? JSON.parse(raw) : {};
      console.log(JSON.stringify(await buildTemplate(parsed.frames.desktop.url, answers, { log }), null, 2));
    } else {
      throw new Error(`unknown command ${cmd}`);
    }
  } catch (e) {
    console.error(e.problems ? e.problems.join('\n') : e.message);
    process.exit(1);
  }
}
