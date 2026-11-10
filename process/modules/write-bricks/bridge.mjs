// Client for the site in .env. The live API is the F2B MCP plugin (Bearer MCP_TOKEN).
import { need } from '../common/env.mjs';

let rpcId = 0;
let siteInfo;

async function mcp(name, args = {}) {
  const url = new URL('/wp-json/f2b-mcp/v1/mcp', need('WP_URL')).href;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${need('MCP_TOKEN')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`bridge ${name} -> ${res.status} ${data.error?.message ?? 'request failed'}`);
  }
  const result = data.result ?? {};
  const text = result.content?.[0]?.text ?? '';
  if (result.isError) {
    const status = /not found/i.test(text) ? 404 : 422;
    throw new Error(`bridge ${name} -> ${status} ${text}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function cssLoading() {
  siteInfo ??= await mcp('get_site_info');
  return siteInfo.css_loading;
}

function templateShape(raw, content) {
  const id = raw.template_id ?? raw.id;
  return {
    id,
    title: raw.title,
    status: raw.status,
    builderUrl: raw.edit_url,
    elementCount: Array.isArray(content) ? content.length : raw.elements?.length,
  };
}

export async function bridge(method, path, body = {}) {
  if (method === 'POST' && path === '/media') {
    const uploaded = await mcp('upload_media', { filename: body.filename, content_base64: body.data_base64 });
    return { id: uploaded.attachment_id, url: uploaded.url, filename: body.filename, reused: false };
  }

  if (method === 'POST' && path === '/fonts') {
    console.log('  fonts stay as the site already has them');
    return body.fonts ?? [];
  }

  if (method === 'POST' && path === '/templates') {
    const created = await mcp('create_template', {
      title: body.title,
      type: body.type || 'section',
      elements_json: JSON.stringify(body.content ?? []),
    });
    return templateShape(created, body.content);
  }

  const template = path.match(/^\/templates\/(\d+)$/);
  if (template && method === 'GET') return templateShape(await mcp('get_template', { template_id: Number(template[1]) }));

  if (template && method === 'PUT') {
    const id = Number(template[1]);
    if (body.page_settings && !body.content) {
      const saved = await mcp('set_page_settings', { template_id: id, page_settings_json: JSON.stringify(body.page_settings) });
      return templateShape({ ...saved, template_id: id, edit_url: saved.edit_url });
    }
    const saved = await mcp('set_template_content', {
      template_id: id,
      elements_json: JSON.stringify(body.content ?? []),
      ...(body.page_settings ? { page_settings_json: JSON.stringify(body.page_settings) } : {}),
    });
    return templateShape(saved, body.content);
  }

  if (method === 'POST' && path === '/css-file') {
    const id = body.template_id ?? body.post_id;
    const file = await mcp('generate_css_file', { template_id: id });
    return { ...file, css_loading: file.css_loading ?? await cssLoading() };
  }

  const preview = path.match(/^\/preview\/(\d+)$/);
  if (preview && method === 'POST') {
    const id = Number(preview[1]);
    const current = await mcp('get_template', { template_id: id });
    const file = await mcp('generate_css_file', { template_id: id });
    const slug = `f2b-preview-${id}`;
    const findPage = async () => {
      const listed = await mcp('list_pages', { search: slug, status: 'publish', per_page: 20 });
      return (listed.pages ?? []).find((page) => page.slug === slug || page.slug.startsWith(`${slug}-`));
    };
    let page = await findPage();
    if (!page) {
      try {
        const created = await mcp('create_page', { title: slug, slug, status: 'publish' });
        page = { id: created.page_id, url: created.url };
      } catch (error) {
        page = await findPage();
        if (!page) throw error;
      }
    }
    const saved = await mcp('set_page_content', {
      page_id: page.id,
      elements_json: JSON.stringify(current.elements ?? []),
      page_settings_json: JSON.stringify({
        headerDisabled: true,
        footerDisabled: true,
        ...(current.page_settings?.customScriptsBodyFooter ? { customScriptsBodyFooter: current.page_settings.customScriptsBodyFooter } : {}),
      }),
      sync_css: true,
    });
    const url = new URL(saved.url);
    url.searchParams.set('bricks_preview', String(Math.floor(Date.now() / 1000)));
    return { pageId: saved.page_id, url: url.toString(), css_loading: file.css_loading ?? await cssLoading(), file_name: file.file_name ?? null };
  }

  if (method === 'DELETE' && path === '/preview') return { trashed: [] };

  throw new Error(`bridge ${method} ${path} is not available on this site`);
}
