// The picture names every component that will be built.
// A catalog kind with a node is built. A block, a signal, or a group with no node is not.
// Render rules and the kind docs build that kind. They do not choose it.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { download, getRenders } from '../../read-figma/api.mjs';
import { SIGNAL_RULES, isSignal, lookKinds } from '../../recognize-parts/kinds.mjs';
import { screenParts } from './parts.mjs';
import { confirmNode } from '../../recognize-parts/confirm-node.mjs';
import { findNode } from '../../recognize-parts/cite.mjs';
import { walk } from '../../read-figma/nodes.mjs';
import { matchTrees } from '../../breakpoints/match.mjs';
import { resolveWorkspace } from '../../common/workspace.mjs';

export const LOOK_FILE = 'look.json';
export const PLAN_MODEL = 'plan-model.json';
export { lookKinds };

export const AI_WEIGHT = 100;
export const CODE_WEIGHT = 0;

function pictureWeight() {
  return { ai: AI_WEIGHT, code: CODE_WEIGHT, total: AI_WEIGHT };
}

function citeOf(cite) {
  return (cite ?? []).map((item) => [item.node, item.field].filter(Boolean).join('.')).filter(Boolean);
}

export function signalRows(components) {
  return (components ?? [])
    .filter((item) => item && (item.status === 'approved' || item.status === 'proposed') && !isSignal(item.component))
    .map((item) => ({
      node: item.node,
      kind: item.component,
      status: item.status,
      confidence: item.confidence ?? '',
      evidence: String(item.evidence ?? '').replace(/\s+/g, ' ').trim(),
      cite: citeOf(item.cite),
      children: childParts(item),
    }));
}

function childParts(item) {
  const rule = SIGNAL_RULES[item.component];
  return (rule?.childComponent ?? []).flatMap((child) => {
    const node = item.params?.[child.param];
    if (!node) return [];
    return [{ id: child.id, label: child.label || child.id, node: String(node) }];
  });
}

export async function saveSectionShot(ws, fileKey, nodeId, version) {
  const stamp = ws.readJson('look-render.json', null);
  if (ws.has('look.png') && stamp?.version === version && stamp?.node === nodeId) return { shot: 'look.png', shotError: '' };
  const urls = await getRenders(fileKey, [nodeId], 'png', { scale: 1 });
  const url = urls?.[nodeId];
  if (!url) return { shot: '', shotError: 'Figma không trả render của section' };
  writeFileSync(ws.file('look.png'), await download(url));
  ws.writeJson('look-render.json', { version, node: nodeId });
  return { shot: 'look.png', shotError: '' };
}

export function writeLook(ws, components, shot) {
  const look = {
    shot: shot?.shot ?? '',
    shotError: shot?.shotError ?? '',
    signals: signalRows(components),
    ai: null,
  };
  ws.writeJson(LOOK_FILE, look);
  return look;
}

function pictureSentence(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function pictureParts(group) {
  const children = {};
  const raw = group?.children;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return children;
  for (const [key, value] of Object.entries(raw)) {
    if (!/^[a-z0-9_-]+$/i.test(key)) continue;
    children[key] = value == null || value === '' ? null : String(value);
  }
  return children;
}

function readGroup(group, kinds) {
  const kind = String(group?.kind ?? '').trim();
  const node = group?.node ? String(group.node) : '';
  const see = pictureSentence(group?.see);
  if (!kinds.has(kind)) throw new Error(`Loại "${kind}" không có trong danh sách component.`);
  if (!see) throw new Error(`Nhóm ${node || kind} thiếu câu mô tả trên ảnh.`);
  return {
    node,
    kind,
    see,
    selected: group?.selected ? String(group.selected) : '',
    children: pictureParts(group),
  };
}

export function normalizeAi(groups) {
  if (!Array.isArray(groups)) throw new Error('Nhận dạng từ ảnh phải là một danh sách.');
  const kinds = lookKinds();
  return groups.map((group) => readGroup(group, kinds));
}

function canBuild(group) {
  return !!group.node && group.kind !== 'block' && !isSignal(group.kind);
}

function partRows(group) {
  return Object.entries(group.children)
    .filter(([, node]) => node)
    .map(([id, node]) => ({ id, label: id, node, review: 'part', structure: false, image: true }));
}

function renderRow(group) {
  return {
    node: group.node,
    kind: group.kind,
    status: 'approved',
    confidence: 'high',
    evidence: group.see,
    cite: [],
    children: partRows(group),
    verdict: 'render',
    review: 'render',
    structure: false,
    weight: pictureWeight(),
    see: group.see,
    aiKind: group.kind,
    selected: group.selected,
    parts: group.children,
  };
}

export function lookReport(look) {
  const shot = look?.shot || '';
  const shotError = look?.shotError || '';
  const ai = Array.isArray(look?.ai) ? look.ai : null;
  if (!shot || !ai) return { shot, shotError, ready: false, rows: [], extras: [] };
  return {
    shot,
    shotError,
    ready: true,
    rows: ai.filter(canBuild).map(renderRow),
    extras: ai.filter((group) => !canBuild(group)),
  };
}

function componentFamily(name) {
  return name === 'menu' || name === 'menu-slider' ? 'menu' : name;
}

// A rule can measure a node. It cannot approve it. The picture does that.
export function holdForPicture(components) {
  for (const entry of components ?? []) {
    if (isSignal(entry.component)) continue;
    if (entry.status !== 'approved') continue;
    if (entry.source === 'human') continue;
    entry.status = 'proposed';
    entry.note = 'Measured for the build. The picture decides whether this component is built.';
  }
  return components;
}

export function applyPictureToVariant(baseComponents, variantComponents, variantOf) {
  const approved = (baseComponents ?? []).filter((entry) => entry.status === 'approved' && !isSignal(entry.component));
  for (const entry of variantComponents ?? []) {
    if (isSignal(entry.component)) continue;
    const same = approved.filter((item) => componentFamily(item.component) === componentFamily(entry.component));
    const paired = same.find((item) => variantOf.get(item.node) === entry.node);
    const partner = paired ?? (same.length === 1 ? same[0] : null);
    if (partner) {
      entry.status = 'approved';
      entry.note = 'Same component as the desktop frame. The picture named it.';
      continue;
    }
    if (entry.status === 'rejected') continue;
    entry.status = 'rejected';
    entry.note = 'Ảnh không gọi component này. Không dựng.';
  }
  return variantComponents;
}

export function carryPicture(baseWs) {
  if (typeof baseWs?.readJson !== 'function' || typeof baseWs?.dir !== 'string') return;
  const baseTree = baseWs.readJson('tree.json', null);
  const baseDet = baseWs.readJson('detections.json', null);
  if (!baseTree || !baseDet) return;
  const variants = baseWs.readJson('responsive.json', { variants: [] }).variants ?? [];
  for (const variant of variants) {
    if (!variant.workspace) continue;
    const variantWs = resolveWorkspace(join(dirname(baseWs.dir), variant.workspace));
    if (!variantWs.has('tree.json') || !variantWs.has('detections.json')) continue;
    const variantTree = variantWs.readJson('tree.json');
    const variantDet = variantWs.readJson('detections.json');
    const { pairs } = matchTrees(baseTree, variantTree, { aliases: variant.aliases ?? {} });
    const variantOf = new Map([...pairs].map(([variantId, baseId]) => [baseId, variantId]));
    applyPictureToVariant(baseDet.components, variantDet.components, variantOf);
    variantWs.writeJson('detections.json', variantDet);
  }
}

export function applyAiLook(ws, groups) {
  const look = ws.readJson(LOOK_FILE);
  look.ai = normalizeAi(groups);
  ws.writeJson(LOOK_FILE, look);
  const report = lookReport(look);
  applyAiDecisions(ws, report);
  const model = ws.readJson(PLAN_MODEL);
  model.look = report;
  const tree = ws.readJson('tree.json', null);
  const det = ws.readJson('detections.json', null);
  if (tree && det) {
    model.parts = screenParts(tree, det.components, model.questions ?? [], model.fileKey ?? '');
    model.open = [];
    model.repeats = [];
  }
  return model;
}

function sameComponent(row, entry) {
  return entry.node === row.node && entry.component === row.kind;
}

export function applyAiDecisions(ws, report) {
  if (!ws.has('detections.json')) return;
  const det = ws.readJson('detections.json');
  const components = det.components ?? [];
  for (const entry of components) {
    if (isSignal(entry.component)) continue;
    if ((report.rows ?? []).some((row) => sameComponent(row, entry))) continue;
    entry.status = 'rejected';
    entry.note = 'Ảnh không gọi component này. Không dựng.';
  }
  for (const row of report.rows ?? []) placeComponent(components, row, ws);
  det.components = components;
  ws.writeJson('detections.json', det);
  carryPicture(ws);
}

function placeComponent(components, row, ws) {
  const existing = components.find((entry) => sameComponent(row, entry));
  const entry = existing ?? {
    id: `ai${String(row.node).replace(/\W/g, '').slice(0, 8)}`,
    source: 'ai',
    component: row.kind,
    node: row.node,
    confidence: 'high',
    cite: [{ node: row.node, field: 'name' }],
    params: {},
  };
  entry.status = 'approved';
  entry.weight = row.weight;
  entry.evidence = row.see;
  entry.note = 'Ảnh quyết định. Sẽ dựng.';
  storeReading(entry, row);
  widenOnce(ws, entry);
  if (!existing) components.push(entry);
}

function widenOnce(ws, entry) {
  const tree = typeof ws?.readJson === 'function' ? ws.readJson('tree.json', null) : null;
  if (!tree) return;
  const result = confirmNode(tree, entry.component, entry.node, entry.params);
  entry.params = { ...(entry.params ?? {}), confirm: result.confirm };
  if (result.confirm === 'again' && result.node) entry.node = result.node;
  // The chosen pill is named by its words too, because the other frames of the table draw it under other node ids.
  const picked = entry.params.selected && !entry.params.selectedLabel ? findNode(tree, entry.params.selected) : null;
  if (picked) {
    const words = [];
    walk(picked, (item) => { if (item.type === 'TEXT' && item.text?.characters) words.push(String(item.text.characters).trim()); });
    const label = words.find((word) => word && !/^[-+]?\d+\s*%$/.test(word));
    if (label) entry.params.selectedLabel = label;
  }
}

function storeReading(entry, reading) {
  const params = { ...(entry.params ?? {}) };
  if (reading.selected) params.selected = reading.selected;
  const parts = reading.parts ?? {};
  if (Object.keys(parts).length) {
    params.children = { ...(params.children ?? {}), ...parts };
    const rules = SIGNAL_RULES[entry.component]?.childComponent ?? [];
    for (const [id, node] of Object.entries(parts)) {
      const rule = rules.find((child) => child.id === id);
      if (!rule?.param) continue;
      params[rule.param] = node || null;
    }
  }
  entry.params = params;
}
