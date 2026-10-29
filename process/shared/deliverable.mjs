// The deliverable of a run: one Bricks template per section, named "<design name> - <section>", plus ONE page that holds those templates in page order.
//   sections-<node>.json (written by auto.mjs from the page plan): { designName, key, sections: [{ id, name, title, dir }] }
//   assemblePage() reads the template id of every section from its workspace (state.json), creates / updates the page through the bridge and moves
//   the temporary preview page(s) of the verify step to the trash, so that the page is the only page the run leaves behind.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridge } from '../bricks/bridge.mjs';

const WORK = fileURLToPath(new URL('../work/', import.meta.url));
export const plansFile = (fileKey, node) => join(WORK, fileKey, `sections-${node.replace(':', '-')}.json`);

// "<design> - <section>"; a section name that repeats on the page ("f-w", "vnx-service") gets its number: "f-w 1", "f-w 2"
export function sectionTitles(designName, sections) {
  const count = {};
  for (const s of sections) count[s.name] = (count[s.name] ?? 0) + 1;
  const seen = {};
  return sections.map((s) => `${designName} - ${count[s.name] > 1 ? `${s.name} ${(seen[s.name] = (seen[s.name] ?? 0) + 1)}` : s.name}`);
}

export function writePlan(fileKey, node, designName, sections) {
  const titles = sectionTitles(designName, sections);
  const plan = { designName, key: `${fileKey}-${node.replace(':', '-')}`, sections: sections.map((s, i) => ({ id: s.id, name: s.name, title: titles[i], dir: s.id.replace(':', '-') })) };
  mkdirSync(join(WORK, fileKey), { recursive: true }); // first run of a new Figma file: its work folder does not exist yet
  writeFileSync(plansFile(fileKey, node), JSON.stringify(plan, null, 2));
  return plan;
}

export async function assemblePage(fileKey, node, { final = false } = {}) {
  const file = plansFile(fileKey, node);
  if (!existsSync(file)) throw new Error(`no section plan for ${fileKey} ${node}: run auto.mjs first`);
  const plan = JSON.parse(readFileSync(file, 'utf8'));
  const ids = [], missing = [];
  for (const s of plan.sections) {
    const st = join(WORK, fileKey, s.dir, 'state.json');
    const id = existsSync(st) ? JSON.parse(readFileSync(st, 'utf8')).templateId : null;
    if (id) ids.push(id); else missing.push(s.title);
  }
  const page = await bridge('POST', '/page', { key: plan.key, title: plan.designName, template_ids: ids });
  const trashed = (await bridge('DELETE', '/preview')).trashed?.length ?? 0;
  console.log(`[giai đoạn 8] page "${plan.designName}" (id ${page.pageId}) có ${ids.length}/${plan.sections.length} template theo thứ tự trang: ${page.url}${missing.length ? ` · THIẾU: ${missing.join(', ')}` : ''} · page preview tạm đã xóa (${trashed})`);
  if (final) {
    console.log(`\n[HOÀN TẤT] ${plan.designName}: ${ids.length}/${plan.sections.length} template + 1 page. Page: ${page.url}`);
    for (const [i, s] of plan.sections.entries()) console.log(`   ${i + 1}. ${s.title}`);
  }
  return { page, ids, missing, plan };
}
