// Staging upload. The local template is already on WP_URL.
// This file talks only to the f2b-mcp plugin. It does not run during build.
// The phrase is the whole switch: any other text returns before a request is made.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveWorkspace, workRoot } from '../common/workspace.mjs';
import { need } from '../common/env.mjs';
import { popupPageSettings } from '../write-bricks/components/popup-settings.mjs';

export const STAGING_PHRASE = 'Xác nhận lên staging';

export function assertStagingPhrase(text) {
  if (text !== STAGING_PHRASE) {
    const error = new Error('Staging không chạy. Cần đúng câu: Xác nhận lên staging');
    error.code = 'STAGING_PHRASE';
    throw error;
  }
}

// Bricks draws the structure panel from `children`. The local file only stores `parent`
// because the local bridge fills `children` when it saves. The staging plugin stores the
// payload as sent, so an empty children list shows only the root elements.
export function linkChildren(elements) {
  const copy = elements.map((el) => ({ ...el, children: [] }));
  const indexOf = new Map(copy.map((el, index) => [String(el.id), index]));
  for (const el of copy) {
    if (el.parent === 0 || el.parent === '0' || el.parent == null || el.parent === '') continue;
    const parentIndex = indexOf.get(String(el.parent));
    if (parentIndex == null) {
      const error = new Error(`element '${el.id}' has unknown parent '${el.parent}'`);
      error.code = 'STAGING_TREE';
      throw error;
    }
    copy[parentIndex].children.push(el.id);
  }
  return copy;
}

// A button that opens a local template id must name the staging id. The local file keeps
// the local id. Popup is uploaded first, so its state.json already has stagingTemplateId.
export function stagingTemplateIds(root = workRoot()) {
  const ids = new Map();
  let keys = [];
  try { keys = readdirSync(root); } catch { return ids; }
  for (const key of keys) {
    const keyDir = join(root, key);
    let nodes = [];
    try {
      if (!statSync(keyDir).isDirectory()) continue;
      nodes = readdirSync(keyDir);
    } catch { continue; }
    for (const node of nodes) {
      try {
        const state = JSON.parse(readFileSync(join(keyDir, node, 'state.json'), 'utf8'));
        if (state.templateId != null && state.stagingTemplateId != null) ids.set(String(state.templateId), String(state.stagingTemplateId));
      } catch { /* this folder is not a workspace */ }
    }
  }
  return ids;
}

export function pointButtonsAtStaging(elements, ids) {
  if (!ids || !ids.size) return elements;
  return elements.map((el) => {
    const settings = el.settings;
    if (!settings) return el;
    const next = { ...settings };
    if (Array.isArray(settings._interactions)) {
      next._interactions = settings._interactions.map((row) => (
        row && row.templateId != null && ids.has(String(row.templateId))
          ? { ...row, templateId: ids.get(String(row.templateId)) }
          : row
      ));
    }
    if (Array.isArray(settings._attributes)) {
      next._attributes = settings._attributes.map((attr) => (
        attr && attr.name === 'data-f2b-open' && ids.has(String(attr.value))
          ? { ...attr, value: ids.get(String(attr.value)) }
          : attr
      ));
    }
    return { ...el, settings: next };
  });
}

async function mcpCall(name, args) {
  const url = need('STAGING_MCP_URL', 'Set STAGING_MCP_URL in .env to the f2b-mcp endpoint.');
  const token = need('STAGING_MCP_TOKEN', 'Set STAGING_MCP_TOKEN in .env. The token is on the staging site under Settings → F2B MCP.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`staging MCP ${res.status}`);
  const text = body?.result?.content?.[0]?.text ?? body?.error?.message ?? '';
  if (body?.result?.isError || body?.error) throw new Error(text || 'staging MCP tool failed');
  try { return JSON.parse(text); } catch { return { text }; }
}

function assetName(nodeId, file, sent) {
  const base = file.split('/').pop().replace(/\.(png|jpe?g)$/i, '');
  const ext = sent.endsWith('.webp') ? '.webp' : file.slice(file.lastIndexOf('.'));
  return `figma-${(nodeId ?? 'node').replace(':', '-')}-${base}${ext}`;
}

export async function pushStaging(workspace, phrase, call = mcpCall) {
  assertStagingPhrase(phrase);
  const ws = resolveWorkspace(workspace);
  const template = ws.readJson('bricks.json');
  const state = ws.readJson('state.json', {});
  const uploaded = new Map();

  async function resolveAssets(value) {
    if (Array.isArray(value)) return Promise.all(value.map(resolveAssets));
    if (value && typeof value === 'object') {
      if (typeof value.$asset === 'string') return uploadAsset(value.$asset, value.size);
      const out = {};
      for (const [key, item] of Object.entries(value)) out[key] = await resolveAssets(item);
      return out;
    }
    return value;
  }

  async function uploadAsset(file, size = 'full') {
    if (uploaded.has(file)) return { ...uploaded.get(file), size };
    const bytes = readFileSync(ws.file('assets/' + file));
    const filename = assetName(ws.ref?.nodeId, file, file);
    const saved = await call('upload_media', { filename, content_base64: bytes.toString('base64') });
    const image = { id: saved.attachment_id, url: saved.url, filename, size };
    uploaded.set(file, image);
    return { ...image, size };
  }

  const content = [];
  for (const element of template.content) content.push({ ...element, settings: await resolveAssets(element.settings) });
  const linked = linkChildren(pointButtonsAtStaging(content, stagingTemplateIds()));
  const elementsJson = JSON.stringify(linked);
  const type = template.type || 'section';
  let templateId = state.stagingTemplateId ?? null;
  let editUrl = state.stagingEditUrl ?? '';

  if (templateId) {
    const saved = await call('set_template_content', { template_id: templateId, elements_json: elementsJson, sync_css: true });
    editUrl = saved.edit_url || editUrl;
  } else {
    const created = await call('create_template', { title: template.title, type, elements_json: elementsJson });
    templateId = created.template_id;
    editUrl = created.edit_url || '';
    await call('generate_css_file', { template_id: templateId });
  }

  if (type === 'popup') {
    await call('set_page_settings', { template_id: templateId, page_settings_json: JSON.stringify(popupPageSettings(templateId, template.popup)) });
  }

  state.stagingTemplateId = templateId;
  state.stagingEditUrl = editUrl;
  ws.writeJson('state.json', state);
  return { templateId, editUrl };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await pushStaging(process.argv[2], process.argv[3]);
    console.log(`staging template ${result.templateId}  ${result.editUrl}`);
  } catch (error) {
    console.error(error.message);
    process.exit(error.code === 'STAGING_PHRASE' ? 2 : 1);
  }
}
