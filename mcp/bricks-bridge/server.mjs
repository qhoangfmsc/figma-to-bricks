// MCP server: thin wrapper over the f2b/v1 REST bridge (wp-content/mu-plugins/figma-to-bricks-bridge.php)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Credentials: process env first, then the project-root .env (gitignored)
const env = { ...process.env };
try {
  const file = readFileSync(fileURLToPath(new URL('../../.env', import.meta.url)), 'utf8');
  for (const line of file.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
} catch {}

const { WP_URL = 'http://localhost:8080', WP_USER, WP_APP_PASSWORD } = env;
const auth = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

// ?rest_route= works without pretty permalinks
async function api(method, path, body) {
  const res = await fetch(`${WP_URL}/?rest_route=/f2b/v1${path}`, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }
  if (!res.ok) throw new Error(`${res.status} ${typeof data === 'string' ? data : data.message}`);
  return data;
}

const out = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const wrap = (fn) => async (args) => {
  try { return out(await fn(args)); }
  catch (e) { return { isError: true, content: [{ type: 'text', text: String(e.message) }] }; }
};

// Bricks element: flat array, `parent` is 0 for roots; `children` is rebuilt server-side, ids generated if absent
const element = z.object({
  id: z.string().optional().describe('6 char id; omit to auto-generate. Needed only to reference as parent'),
  name: z.string().describe('Bricks element name: section, container, block, div, heading, text-basic, button, image...'),
  parent: z.union([z.literal(0), z.string()]).default(0).describe('Parent element id, 0 for root'),
  settings: z.record(z.any()).default({}).describe('Bricks settings, e.g. { text, tag, _padding, _typography }'),
});
const elements = z.array(element).describe('Flat list, parents before children');

const server = new McpServer({ name: 'bricks-bridge', version: '0.1.0' });

server.tool('list_templates', 'List Bricks templates (id, title, type, element count, builder URL)', {},
  wrap(() => api('GET', '/templates')));

server.tool('get_template', 'Get one Bricks template including its element array', { id: z.number() },
  wrap(({ id }) => api('GET', `/templates/${id}`)));

server.tool('create_template',
  'Create a Bricks template. type: section|header|footer|content|archive|search|error|popup',
  { title: z.string(), type: z.string().default('section'), content: elements },
  wrap((b) => api('POST', '/templates', b)));

server.tool('update_template', 'Replace title and/or the whole element array of a template',
  { id: z.number(), title: z.string().optional(), content: elements.optional() },
  wrap(({ id, ...b }) => api('PUT', `/templates/${id}`, b)));

server.tool('trash_template', 'Move a template to trash', { id: z.number() },
  wrap(({ id }) => api('DELETE', `/templates/${id}`)));

server.tool('get_global_classes', 'List Bricks global classes (id, name, settings)', {},
  wrap(() => api('GET', '/global-classes')));

server.tool('upsert_global_classes', 'Create or update global classes by name; reference them in elements via settings._cssGlobalClasses: [id]',
  { classes: z.array(z.object({ name: z.string(), settings: z.record(z.any()).default({}) })) },
  wrap((b) => api('POST', '/global-classes', b)));

server.tool('upload_media',
  'Download an image URL (e.g. a Figma asset URL) into the WP media library. Returns { id, url, filename, size }: use it directly as a Bricks image element setting: settings.image',
  { url: z.string().url(), filename: z.string().optional().describe('e.g. award-1.png'), title: z.string().optional() },
  wrap((b) => api('POST', '/media', b)));

server.tool('list_elements', 'List all element names available in this Bricks version', {},
  wrap(() => api('GET', '/elements')));

server.tool('get_element_schema',
  'Settings keys for one element (compact: key, type, label, options, units). Use before writing settings; set full=true for raw control definitions incl. css mapping',
  { name: z.string(), full: z.boolean().default(false) },
  wrap(async ({ name, full }) => {
    const s = await api('GET', `/elements/${name}`);
    if (full) return s;
    const controls = {};
    // element-specific keys (text, tag...) first, generic `_style` keys after
    const entries = Object.entries(s.controls).sort(([a], [b]) => (a[0] === '_') - (b[0] === '_'));
    for (const [key, c] of entries) {
      if (c.type === 'separator' || c.hidden) continue;
      controls[key] = {
        type: c.type,
        label: c.label,
        ...(c.options && !Array.isArray(c.options) && { options: Object.keys(c.options) }),
        ...(c.units && { units: Object.keys(c.units) }),
        ...(c.default !== undefined && { default: c.default }),
      };
    }
    return { ...s, controls };
  }));

await server.connect(new StdioServerTransport());
