#!/usr/bin/env node
// STEP 6  bricks.json -> WordPress.  Uploads the images, then creates/updates the Bricks template through the bridge.
//   node process/scripts/06-push.mjs <figma-url | workspace-dir>
// Idempotent: element ids are derived from Figma node ids and the template id is kept in state.json,
// so running it again updates the same template; images are de-duplicated by sha256.
import { readFileSync } from 'node:fs';
import { resolveWorkspace } from '../shared/workspace.mjs';
import { requireSignOff } from '../review/index.mjs';
import { bridge } from '../bricks/bridge.mjs';
import { sha256 } from '../shared/image-info.mjs';
import { optimizeAssets } from '../shared/qa.mjs';


export async function pushStep(urlOrDir) {
  const ws = resolveWorkspace(urlOrDir);
  requireSignOff(ws, 'push'); // the owner must have reviewed detections.md first
  const template = ws.readJson('bricks.json');
  const state = ws.readJson('state.json', { media: {} });
  const uploaded = {};
  // bitmaps go to the site as optimized webp (page weight is part of the acceptance, qa/budgets.json); svg stays as it is
  const assetFiles = [...new Set([...JSON.stringify(template).matchAll(/"\$asset":"([^"]+)"/g)].map((m) => m[1]))];
  const optimized = optimizeAssets(ws, assetFiles);

  // Resolve { $asset: 'images/x.png' } placeholders anywhere in the settings
  async function resolveAssets(value) {
    if (Array.isArray(value)) return Promise.all(value.map(resolveAssets));
    if (value && typeof value === 'object') {
      if (typeof value.$asset === 'string') return upload(value.$asset, value.size);
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = await resolveAssets(v);
      return out;
    }
    return value;
  }

  async function upload(file, size = 'full') {
    const sent = optimized.get(file) ?? file; // optimized webp when there is one
    const buf = readFileSync(ws.file('assets/' + sent));
    const hash = sha256(buf);
    if (!uploaded[hash]) {
      const name = `figma-${ws.ref?.nodeId?.replace(':', '-') ?? 'node'}-${file.split('/').pop().replace(/\.(png|jpe?g)$/i, '')}${sent.endsWith('.webp') ? '.webp' : file.slice(file.lastIndexOf('.'))}`;
      const r = await bridge('POST', '/media', { filename: name, title: name.replace(/\.[^.]+$/, ''), data_base64: buf.toString('base64') });
      uploaded[hash] = { id: r.id, url: r.url, filename: r.filename, size };
      state.media[hash] = r.id;
      console.log(`    ${r.reused ? 'reused  ' : 'uploaded'} ${file} -> media ${r.id}`);
    }
    return { ...uploaded[hash], size };
  }

  const content = [];
  for (const el of template.content) content.push({ ...el, settings: await resolveAssets(el.settings) });

  const fonts = ws.readJson('fonts.json', []);
  if (fonts.length) {
    await bridge('POST', '/fonts', { fonts });
    console.log(`  fonts (Google): ${fonts.map((f) => `${f.family} ${[...f.weights, ...f.italicWeights.map((w) => w + 'i')].join('/')}`).join(', ')}`);
  }

  const body = { title: template.title, content };
  // A different template title means a NEW version: the old template stays untouched (owner decision 2026-10-26, "Pagespeed - Landing v2").
  if (state.templateId) {
    let oldTitle = state.templateTitle;
    if (!oldTitle) { try { oldTitle = (await bridge('GET', `/templates/${state.templateId}`)).title; } catch { /* unknown: keep updating */ } }
    if (oldTitle && oldTitle !== body.title) {
      (state.previousTemplates ??= []).push({ id: state.templateId, title: oldTitle });
      console.log(`  title changed ("${oldTitle}" -> "${body.title}"): template ${state.templateId} is kept as it is, a new template is created`);
      state.templateId = null;
    }
  }
  // A template the owner moved to the WordPress trash is gone for us: it is not restored (that is the owner's call) and not deleted for good; a new one is created.
  if (state.templateId) {
    try {
      const cur = await bridge('GET', `/templates/${state.templateId}`);
      if (cur.status === 'trash') { console.log(`  template ${state.templateId} is in the trash (the owner removed it): creating a new one, the old one is left alone`); (state.previousTemplates ??= []).push({ id: state.templateId, title: cur.title, trashed: true }); state.templateId = null; }
    } catch { /* unknown: keep updating */ }
  }
  let res;
  if (state.templateId) {
    try { res = await bridge('PUT', `/templates/${state.templateId}`, body); console.log(`  updated template ${res.id}`); }
    catch (e) { if (!/404/.test(e.message)) throw e; }
  }
  if (!res) {
    res = await bridge('POST', '/templates', { ...body, type: template.type });
    console.log(`  created template ${res.id}`);
  }
  state.templateId = res.id;
  state.templateTitle = body.title;
  state.builderUrl = res.builderUrl;
  ws.writeJson('state.json', state);
  console.log(`  elements ${res.elementCount}  ${res.builderUrl}`);
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) await pushStep(process.argv[2]);
