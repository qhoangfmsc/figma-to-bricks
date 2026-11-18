// Several sections in ONE Bricks template (owner's decision 2026-11-17: a section is "added to" a template
// that already exists). The section that joins writes `into.json` in its own workspace:
//   { "host": "<fileKey>/<node-id>", "order": 1, "reason": "<owner's words>" }
// Each section keeps its own build, assets and verify. Only the push joins them: the host's elements first, then
// every guest by `order`, each as its own root. Pushing any member pushes the whole group to the host's template,
// so rebuilding one section never drops the others.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function hostOf(dir, root) {
  const file = join(dir, 'into.json');
  if (!existsSync(file)) return null;
  const into = readJson(file);
  if (!into?.host) throw new Error(`${file}: "host" (<fileKey>/<node-id>) is required`);
  const host = resolve(root, into.host);
  if (!existsSync(host)) throw new Error(`${file}: host workspace ${into.host} not found`);
  if (existsSync(join(host, 'into.json'))) throw new Error(`${file}: host ${into.host} is itself added to another template`);
  return { host, order: Number(into.order ?? 0) };
}

function guestsOf(host, root) {
  const out = [];
  for (const key of readdirSync(root, { withFileTypes: true })) {
    if (!key.isDirectory()) continue;
    for (const node of readdirSync(join(root, key.name), { withFileTypes: true })) {
      if (!node.isDirectory()) continue;
      const dir = join(root, key.name, node.name);
      const into = existsSync(join(dir, 'into.json')) ? hostOf(dir, root) : null;
      if (into && into.host === host) out.push({ dir, order: into.order });
    }
  }
  return out.sort((a, b) => a.order - b.order || a.dir.localeCompare(b.dir)).map((g) => g.dir);
}

/** The template a workspace is pushed into: host dir + every member dir in push order (host first). */
export function templateGroup(dir, root) {
  const self = resolve(dir);
  const host = hostOf(self, root)?.host ?? self;
  const members = [host, ...guestsOf(host, root)];
  return { host, members, joined: members.length > 1, name: (d) => relative(root, d) };
}

/**
 * One template body from the built members. The host gives title and type. Element ids must not repeat:
 * two sections with the same id would overwrite each other in Bricks, so that stops the push.
 */
export function joinTemplates(parts) {
  const [host] = parts;
  const seen = new Map();
  const content = [];
  for (const { name, template } of parts) {
    for (const el of template.content) {
      if (seen.has(el.id)) throw new Error(`element id ${el.id} is in ${seen.get(el.id)} and ${name}: rebuild one of them with another salt`);
      seen.set(el.id, name);
      content.push(el);
    }
  }
  const scripts = [...new Set(parts.flatMap((p) => (Array.isArray(p.template.scripts) ? p.template.scripts : [])))];
  return { ...host.template, content, ...(scripts.length ? { scripts } : {}) };
}
