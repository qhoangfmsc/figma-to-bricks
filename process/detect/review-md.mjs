// detections.json + facts -> detections.md: THE sheet the owner reads against the Figma file before anything is built.
// Pure formatting. Repeated candidates (55 tooltips from one designer flag) are shown as one group; the ids stay in detections.json.
import { COMPONENTS } from '../bricks/components/index.mjs';
import { findNode, nodePath } from './index.mjs';
import { DEFAULTS } from '../bricks/defaults.mjs';

const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const params = (p) => (p && Object.keys(p).length ? '`' + cell(JSON.stringify(p)) + '`' : '');
const LEVEL = { E1: 'E1 designer-declared', E2: 'E2 structure', E3: 'E3 shape / name' };

export function renderReview(tree, det, problems, facts, { fileKey } = {}) {
  const link = (id) => (fileKey ? `[open in Figma](https://www.figma.com/design/${fileKey}/?node-id=${id.replace(/^I/, '').split(';')[0].replace(':', '-')})` : '');
  const sectionOf = (id) => det.sections.find((s) => findNode(findNode(tree, s.node) ?? {}, id)) ?? null;
  const row = (c) => {
    const n = findNode(tree, c.node);
    const comp = COMPONENTS[c.component];
    const where = (nodePath(tree, c.node) ?? []).slice(-3).join(' › ');
    return `| ${c.id} | **${c.component}**${comp && comp.status !== 'implemented' ? ' (not implemented)' : ''} | ${cell(n?.name)} \`${c.node}\`<br>${cell(where)}<br>${link(c.node)} | ${cell(c.evidence)} | ${LEVEL[c.level] ?? '-'} · ${c.source}/${c.confidence ?? '-'} | ${params(c.params)} ${cell(c.note)} |`;
  };
  const head = ['| id | component | Figma node | why (cited from the tree) | evidence | params / note |', '|---|---|---|---|---|---|'];

  // group identical patterns: same component + same evidence level + same source + same note
  const group = (status) => {
    const list = det.components.filter((c) => c.status === status);
    if (!list.length) return ['_none_', ''];
    const groups = new Map();
    for (const c of list) { const k = [c.component, c.level, c.source, c.confidence, c.note ?? ''].join('|'); (groups.get(k) ?? groups.set(k, []).get(k)).push(c); }
    const out = [];
    for (const items of groups.values()) {
      const f = items[0];
      const sec = [...new Set(items.map((c) => sectionOf(c.node)?.name ?? '(no section)'))].join(', ');
      out.push(`**${items.length} × ${f.component}** · ${LEVEL[f.level] ?? '-'} · ${f.source}/${f.confidence ?? '-'} · section: ${sec} · ids ${items.length > 3 ? `${items[0].id} … ${items.at(-1).id}` : items.map((c) => c.id).join(', ')}`, '', ...head, ...items.slice(0, 3).map(row));
      if (items.length > 3) out.push(`| … | | ${items.length - 3} more with the same pattern (full list in detections.json) | | | |`);
      out.push('');
    }
    return out;
  };

  // what the front end still needs from the designer / is not built yet
  const missing = [];
  const noText = det.components.filter((c) => c.component === 'tooltip' && c.status !== 'rejected' && !c.params?.text && !c.params?.popup);
  if (noText.length) missing.push(`**${noText.length} tooltip text(s)**: the icons exist (${noText.slice(0, 3).map((c) => c.id).join(', ')}…) but the copy is not in Figma. Ask the designer, then \`review.mjs <ws> set <id> text="…"\`.`);
  for (const c of det.components.filter((x) => x.component === 'flat-image' && x.status !== 'rejected' && !x.params?.link)) missing.push(`**link of the banner ${c.id}** (\`${c.node}\`): Figma has no URL; if the banner is clickable set \`link=\`.`);
  for (const c of det.components.filter((x) => x.component === 'tooltip' && x.params?.popup && x.node === x.params.popup && x.status !== 'rejected')) missing.push(`**trigger of the loose tooltip bubble ${c.id}**: which icon shows "${cell(c.evidence.match(/text "([^"]+)"/)?.[1] ?? '')}"? (\`review.mjs <ws> set ${c.id} node=<icon id>\`)`);
  const notBuilt = [];
  if (facts?.interactions?.length) notBuilt.push(`**hover** on ${facts.interactions.length} node(s) (${facts.interactions.slice(0, 3).map((i) => `${i.name} \`${i.node}\``).join(', ')}): Figma draws the hover as another variant; ${DEFAULTS.hover ? `the build uses the owner default (opacity ${DEFAULTS.hover.opacity}), not that variant's real values.` : 'the build writes no hover (no default; the variant\'s real values are not read yet).'}`);
  if (facts?.hygiene && facts.hygiene.genericPct >= 10) notBuilt.push(`**layer names**: ${facts.hygiene.genericPct}% are Figma defaults (Frame 1234…), so names were not trusted as evidence.`);

  const counts = (s) => det.components.filter((c) => c.status === s).length;
  return [
    `# Detections: ${tree.name} [${tree.id}]`, '',
    '> **Review gate.** Nothing is exported, built or pushed until the owner has compared this sheet with the Figma file and signed off.',
    '> Decide with `node process/scripts/review.mjs <workspace> approve|reject <ids|component=tooltip|all>`, `set <id> key=value`, then `signoff "<note>"`. Anything still **proposed** at sign-off stays a plain block.', '',
    '## What the front end sees', '',
    ...(facts ? [
      `- Artboard ${facts.container.artboard}px${facts.container.content ? `, content container ${facts.container.content}px` : ''}.`,
      ...facts.components.filter((c) => c.visible).map((c) => `- Designer component **${c.name}**: ${c.visible} visible instance(s)${(() => { const p = Object.entries(c.props).filter(([, v]) => Object.keys(v).length > 1 || /true|false/.test(Object.keys(v)[0])).slice(0, 2).map(([k, v]) => `${k}: ${Object.entries(v).map(([val, n]) => `${val}×${n}`).join('/')}`).join('; '); return p ? ` (${p})` : ''; })()}.`),
      ...facts.repeats.map((r) => `- Repeated structure: ${r.count} × "${r.itemName}" inside "${r.parentName}" (\`${r.parent}\`): a list / grid.`),
    ] : ['_facts not available_']), '',
    '## Sections', '',
    ...(det.sections.length ? ['| id | Figma node | what is inside |', '|---|---|---|', ...det.sections.map((s) => `| ${s.id} | ${cell(s.name)} \`${s.node}\` ${link(s.node)} | ${cell(s.summary ?? '_not described yet (AI pass)_')} |`)] : ['_none_']), '',
    `## ⏳ Waiting for review (${counts('proposed')})`, '', ...group('proposed'),
    `## ✅ Approved (${counts('approved')})`, '', ...group('approved'),
    `## ✖ Rejected, stays a block (${counts('rejected')})`, '', ...group('rejected'),
    '## ❔ Missing from Figma (needs the designer)', '', ...(missing.length ? missing.map((m) => `- ${m}`) : ['- nothing']), '',
    '## 🚧 Seen in Figma but not built yet', '', ...(notBuilt.length ? notBuilt.map((m) => `- ${m}`) : ['- nothing']), '',
    '## ⚠ Problems (the gate stays closed while there are any)', '', ...(problems.length ? problems.map((p) => `- ${p}`) : ['- none']), '',
    '## Components the build knows', '', '| component | status | Figma signal | Bricks output |', '|---|---|---|---|',
    ...Object.values(COMPONENTS).map((c) => `| ${c.id} | ${c.status} | ${cell(c.figma)} | ${cell(c.bricks)} |`), '',
  ].join('\n');
}
