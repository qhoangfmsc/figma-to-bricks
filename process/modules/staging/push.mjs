// Staging upload. The local template is already on WP_URL.
// This file talks only to the f2b-mcp plugin. It does not run during build.
// The phrase is the whole switch: any other text returns before a request is made.
import { readFileSync } from 'node:fs';
import { resolveWorkspace } from '../common/workspace.mjs';
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
  const elementsJson = JSON.stringify(content);
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
