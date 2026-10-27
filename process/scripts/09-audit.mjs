#!/usr/bin/env node
// STEP 9  Usable-output audit (SEMANTICS.md section 5): what a developer gets, counted from bricks.json, not from pixels.
//   node process/scripts/09-audit.mjs <figma-url | workspace-dir>
// Writes audit.md: element counts, semantic tags, links (and how many are "#"), images and their alt, heading outline / H1 count,
// lists, sliders, accordions, forms, counters, and the blocks that still carry text without any semantic tag.
import { writeFileSync } from 'node:fs';
import { resolveWorkspace } from '../shared/workspace.mjs';

const TAGS = ['ul', 'ol', 'li', 'dl', 'nav', 'figure', 'article', 'a', 'section', 'header', 'footer'];
const count = (arr) => arr.reduce((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
const tagOf = (e) => (e.settings?.tag === 'custom' ? e.settings.customTag : e.settings?.tag);

export function auditStep(urlOrDir) {
  const ws = resolveWorkspace(urlOrDir);
  const { content: els, title } = ws.readJson('bricks.json');
  const byParent = new Map();
  for (const e of els) (byParent.get(e.parent) ?? byParent.set(e.parent, []).get(e.parent)).push(e);

  const kinds = count(els.map((e) => e.name));
  const tags = count(els.map(tagOf).filter(Boolean));
  const links = els.filter((e) => e.settings?.link?.url !== undefined);
  const placeholderLinks = links.filter((e) => e.settings.link.url === '#');
  const anchors = links.filter((e) => String(e.settings.link.url).startsWith('#') && e.settings.link.url !== '#');
  const images = els.filter((e) => e.name === 'image');
  const noAlt = images.filter((e) => !e.settings.altText);
  const headings = els.filter((e) => e.name === 'heading').map((e) => ({ tag: e.settings.tag, text: String(e.settings.text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) }));
  const h1 = headings.filter((h) => h.tag === 'h1').length;
  let prev = 0; const skipped = [];
  for (const h of headings) { const n = Number(h.tag?.[1]); if (n && prev && n > prev + 1) skipped.push(`${h.tag} after h${prev}: ${h.text}`); if (n) prev = n; }
  const plainBlocksWithText = els.filter((e) => e.name === 'block' && !tagOf(e) && (byParent.get(e.id) ?? []).some((c) => c.name === 'text-basic' || c.name === 'heading')).length;
  const lines = [
    `# Usable-output audit: ${title}`, '',
    '| check | result |', '|---|---|',
    `| elements | ${els.length} (${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}) |`,
    `| semantic tags | ${TAGS.filter((t) => tags[t]).map((t) => `${t} ${tags[t]}`).join(', ') || 'none'}${Object.keys(tags).filter((t) => !TAGS.includes(t)).length ? `; other: ${Object.keys(tags).filter((t) => !TAGS.includes(t)).map((t) => `${t} ${tags[t]}`).join(', ')}` : ''} |`,
    `| links | ${links.length} (buttons ${kinds.button ?? 0}); **${placeholderLinks.length} are "#"** (URL missing: designer list), ${anchors.length} are page anchors |`,
    `| images | ${images.length}; **${noAlt.length} without alt** (empty alt, designer list) |`,
    `| headings | ${headings.length}; **h1 count: ${h1}** ${h1 === 1 ? '(ok)' : '(must be 1)'}; skipped levels: ${skipped.length ? skipped.join(' | ') : 'none'} |`,
    `| components | list ${kinds.list ?? 0}, breadcrumbs ${kinds.breadcrumbs ?? 0}, counter ${kinds.counter ?? 0}, slider ${kinds['slider-nested'] ?? 0}, accordion ${kinds['accordion-nested'] ?? 0}, tabs ${kinds['tabs-nested'] ?? 0}, form ${kinds.form ?? 0} |`,
    `| plain blocks holding text/heading directly (no tag) | ${plainBlocksWithText} (layout wrappers; not counted as defects) |`,
    '', '## Heading outline', '', ...headings.map((h) => `- ${h.tag}: ${h.text}`), '',
  ];
  writeFileSync(ws.file('audit.md'), lines.join('\n'));
  // list for the designer (SEMANTICS.md Q57): everything the build had to leave empty or write as "#"
  const label = (e) => `${e.label ?? e.name} (${e.id})`;
  const tooltips = els.filter((e) => (e.settings?._attributes ?? []).some((a) => a.name === 'data-balloon' && a.value === ''));
  const designer = [
    `# For the designer: ${title}`, '',
    `## Links without URL (${placeholderLinks.length}, written as "#")`, '', ...placeholderLinks.map((e) => `- ${label(e)}${e.settings.text ? `: ${String(e.settings.text).replace(/<[^>]+>/g, '').slice(0, 50)}` : ''}`), '',
    `## Images without alt text (${noAlt.length})`, '', ...noAlt.map((e) => `- ${label(e)}`), '',
    `## Tooltips without text (${tooltips.length})`, '', ...tooltips.map((e) => `- ${label(e)}`), '',
    '## Form', '', '- action / recipient / success and error messages are not in Figma (Bricks defaults).', '',
  ];
  writeFileSync(ws.file('designer-list.md'), designer.join('\n'));
  console.log(`  audit: ${els.length} elements · ${links.length} links (${placeholderLinks.length} "#") · ${images.length} images (${noAlt.length} no alt) · h1 ×${h1}${skipped.length ? ` · ${skipped.length} skipped heading level(s)` : ''}`);
  return { kinds, tags, links: links.length, placeholderLinks: placeholderLinks.length, images: images.length, noAlt: noAlt.length, h1, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) auditStep(process.argv[2]);
