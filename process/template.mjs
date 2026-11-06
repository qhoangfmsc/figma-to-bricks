#!/usr/bin/env node
// ONE template. Desktop URL in, a Bricks template out. The other URLs are that frame at the other widths.
// A blank slot is skipped. Nothing here assembles a WordPress page (that is process/auto.mjs).
//
//   node process/template.mjs read --desktop URL [--widescreen URL] [--tablet URL] [--landscape URL] [--mobile URL]
//   node process/template.mjs build --desktop URL --answers '<json>'
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkspace } from './modules/common/workspace.mjs';
import { fetchStep } from './modules/build-steps/01-fetch.mjs';
import { treeStep } from './modules/build-steps/02-tree.mjs';
import { detectStep } from './modules/build-steps/03-detect.mjs';
import { decide, writeDecisionReport } from './modules/approve-parts/index.mjs';
import { discoverFormErrors } from './modules/read-figma/discover.mjs';
import { signOff } from './modules/sign-off/index.mjs';
import { figmaGet, enableRunCache, refreshRunCache } from './modules/read-figma/api.mjs';
import { groupQuestions, GROUPS, keyOf, validateAnswers, filled, figmaLink, applyAnswers, shareAccordionAnswers, hearAnswers } from './modules/missing-content/index.mjs';
import { runLines } from './modules/common/spawn-lines.mjs';
import { parseFrameInput, SLOTS } from './modules/single-template/frames.mjs';
import { planInventory, screenParts } from './modules/single-template/parts.mjs';
import { writeTemplatePlan } from './modules/single-template/plan-doc.mjs';
import { unclaimedRepeats } from './modules/recognize-parts/structure.mjs';
import { reviewFrame } from './modules/single-template/review.mjs';
import { attachFilledFrames } from './modules/single-template/filled.mjs';
import { outcomeOf, readyForUser } from './modules/single-template/outcome.mjs';

const ROUNDS = 3;
const runner = join(dirname(new URL(import.meta.url).pathname), 'run.mjs');

function bricksHash(base) {
  if (!base.has('bricks.json')) return '';
  return createHash('sha1').update(readFileSync(base.file('bricks.json'))).digest('hex');
}

function measuredFrames(base, responsive, verified) {
  const frames = [{ key: 'desktop', verify: verified && base.has('verify.json') ? base.readJson('verify.json') : null }];
  for (const v of responsive.variants) {
    const file = `verify.${v.key}.json`;
    frames.push({ key: v.key, verify: verified && base.has(file) ? base.readJson(file) : null });
  }
  return frames;
}

export function readFlag(args, name) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return '';
}

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
  for (const slot of SLOTS) {
    const frame = frames[slot.id];
    if (!frame) continue;
    log(`Đọc ${frame.label} ${frame.nodeId}`);
    prepared[slot.id] = await prepareFrame(frame.url, { variant: slot.id !== 'desktop', formErrors: slot.id === 'desktop' ? formErrors : {} });
    log(`${frame.label}: ${prepared[slot.id].ws.readJson('tree.json').name} ${frameWidth(prepared[slot.id].ws) ?? '?'}px`);
  }
  const base = prepared.desktop.ws;
  const tree = base.readJson('tree.json');
  const title = `${designName} - ${tree.name}`;
  const ov = base.readJson('overrides.json', {});
  ov.template = { ...(ov.template ?? {}), title, reason: 'naming convention: "<design name> - <section>"' };
  base.writeJson('overrides.json', ov);
  const variants = SLOTS.filter((slot) => slot.id !== 'desktop' && prepared[slot.id]).map((slot) => {
    const width = frameWidth(prepared[slot.id].ws);
    if (!Number.isFinite(width)) throw new Error(`${slot.label}: không đọc được bề rộng của khung.`);
    return {
      key: slot.key,
      ...(slot.wide ? { minWidth: Math.round(width) } : { maxWidth: slot.maxWidth }),
      workspace: prepared[slot.id].ws.dir.split('/').pop(),
      width,
    };
  });
  base.writeJson('responsive.json', {
    note: 'breakpoint frames pasted on /generate-template-from-figma (process/template.mjs). A blank slot is not a variant. Widescreen is min-width from that frame\'s width.',
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
    value: item.value != null && item.value !== '' ? String(item.value) : (GROUPS[g.group].value ?? ''),
    figma: figmaLink(desktop.fileKey, item.node),
  })));
  const parts = screenParts(tree, det.components, questions, desktop.fileKey);
  const repeats = unclaimedRepeats(tree, det.components);
  const open = det.components.filter((c) => c.status === 'proposed').map((c) => ({
    component: c.component, node: c.node, confidence: c.confidence, evidence: c.evidence,
  }));
  const inventory = planInventory(tree, det.components, desktop.fileKey);
  const shown = {
    title,
    name: tree.name,
    width: frameWidth(base),
    variants: variants.map((v) => ({ label: SLOTS.find((s) => s.key === v.key)?.label ?? v.key, width: v.width })),
    parts,
    open: inventory.open,
    repeats: inventory.repeats,
  };
  const planFile = writeTemplatePlan(base.dir, shown);
  log(`Plan: ${planFile}`);
  return {
    fileKey: desktop.fileKey,
    nodeId: desktop.nodeId,
    url: desktop.url,
    designName,
    title,
    name: tree.name,
    width: frameWidth(base),
    dir: base.dir,
    planFile,
    becomes: Object.entries(counts).map(([k, n]) => `${k} ×${n}`).join(', ') || 'block',
    questions,
    parts,
    repeats,
    open,
    variants: variants.map((v) => ({ key: v.key, width: v.width })),
    designer: [...new Set(prepared.desktop.result.designer)],
  };
}

export async function buildTemplate(desktopUrl, answers, { log = () => {} } = {}) {
  const heard = hearAnswers(answers ?? {});
  const problems = validateAnswers(heard);
  if (problems.length) {
    const err = new Error(problems.join('\n'));
    err.problems = problems;
    throw err;
  }
  const base = resolveWorkspace(desktopUrl);
  if (!base.has('tree.json')) throw new Error('Chưa đọc Figma. Chạy read trước.');
  const applied = applyAnswers(base, filled(heard));
  const shared = shareAccordionAnswers(base);
  log(`Đã gắn ${applied.applied.length} giá trị${shared.copied ? `, chép ${shared.copied} nội dung sang khung khác` : ''}`);
  await attachFilledFrames(base, { log });
  const note = 'the owner confirmed the values in the chat';
  const responsive = base.readJson('responsive.json', { variants: [] });
  const variants = responsive.variants.map((v) => resolveWorkspace(join(dirname(base.dir), v.workspace)));
  for (const variant of variants) {
    await attachFilledFrames(variant, { log });
    signOff(variant, { by: 'owner (chat)', note });
  }
  signOff(base, { by: 'owner (chat)', note });
  const pipe = (args) => runLines('node', [runner, desktopUrl, ...args, '--no-cross'], (line) => {
    if (line.trim()) log(line.trim().slice(0, 180));
  });
  // Create, upload, check. A heavy miss rebuilds this template only and checks again.
  // The same file is not uploaded a second time: another check would see the same result.
  let frames = [];
  let seen = '';
  let verifyStatus = 0;
  for (let round = 1; round <= ROUNDS; round++) {
    if (round > 1) {
      log('Kiểm tra còn lệch. Đang sửa đúng template này rồi kiểm lại.');
      const built = await pipe(['--only=build']);
      if (built.status) throw new Error(`${built.stderr}\n${built.stdout}`.trim().slice(-800) || 'Chưa sửa được template.');
      const next = bricksHash(base);
      if (next === seen) {
        log('Template không đổi sau khi sửa. Dừng vòng kiểm tra.');
        break;
      }
    } else {
      log('Đang tạo template, đẩy lên WordPress và kiểm tra.');
    }
    const run = await pipe([round === 1 ? '--from=export' : '--from=push']);
    verifyStatus = run.status;
    const stateNow = base.readJson('state.json', {});
    const outcome = outcomeOf({ status: run.status, stdout: run.stdout, stderr: run.stderr, templateId: stateNow.templateId });
    if (!outcome.ok) throw outcome.error;
    seen = bricksHash(base);
    frames = measuredFrames(base, responsive, outcome.verified);
    if (readyForUser(frames)) break;
  }
  if (!readyForUser(frames)) log('Đã kiểm tra và sửa template này. Link là bản vừa kiểm tra.');
  const state = base.readJson('state.json', {});
  return {
    templateId: state.templateId,
    builderUrl: state.builderUrl,
    title: base.readJson('overrides.json', {}).template?.title ?? base.readJson('tree.json').name,
    frames: frames.map((f) => ({
      key: f.key,
      verdict: f.verify?.verdict ?? null,
      look: f.verify ? Math.round(f.verify.visualMean * 100) / 100 : null,
      review: reviewFrame(f.verify, f.key),
    })),
    verifyStatus,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const input = { desktop: readFlag(args, 'desktop'), widescreen: readFlag(args, 'widescreen'), tablet: readFlag(args, 'tablet'), landscape: readFlag(args, 'landscape'), mobile: readFlag(args, 'mobile') };
  const parsed = parseFrameInput(input);
  if (!cmd || !parsed.ok) {
    if (!parsed.ok) for (const e of parsed.errors) console.error(e);
    console.error('usage: node process/template.mjs read|build --desktop URL [--widescreen URL] [--tablet URL] [--landscape URL] [--mobile URL] [--answers JSON]');
    process.exit(1);
  }
  const log = (line) => console.log(line);
  try {
    if (cmd === 'read') {
      console.log(JSON.stringify(await readTemplate(parsed.frames, { log }), null, 2));
    } else if (cmd === 'build') {
      const raw = readFlag(args, 'answers');
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
