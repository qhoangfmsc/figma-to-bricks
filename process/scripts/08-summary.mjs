#!/usr/bin/env node
// STEP 8  Collect what the previous steps found into one status table (summary.md). Pure code.
//   node process/scripts/08-summary.mjs <figma-url | workspace-dir>
import { resolveWorkspace } from '../shared/workspace.mjs';
import { stats } from '../figma/tree-md.mjs';

const clip = (s, n = 70) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const table = (head, rows) => rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') : '_none_';

export function summaryStep(urlOrDir) {
  const ws = resolveWorkspace(urlOrDir);
  const tree = ws.readJson('tree.json');
  const mapping = ws.readJson('mapping.json');
  const bricks = ws.readJson('bricks.json');
  const warnings = ws.readJson('warnings.json', []);
  const overrides = ws.readJson('overrides.json', { nodes: {} }).nodes ?? {};
  const state = ws.readJson('state.json', {});
  const detections = ws.readJson('detections.json', null);
  const verify = ws.has('verify.json') ? ws.readJson('verify.json') : null;
  // breakpoint variants (responsive.json): the same template measured at each frame's width
  const variantChecks = ws.readJson('responsive.json', { variants: [] }).variants.filter((v) => ws.has(`verify.${v.key}.json`)).map((v) => {
    const r = ws.readJson(`verify.${v.key}.json`);
    return { key: v.key, width: ws.readJson(`../${v.workspace}/tree.json`).box.w, total: r.total, bad: r.bad.length, file: `verify.${v.key}.md` };
  });
  const st = stats(tree);

  const nameOf = (id) => bricks.content.find((e) => e.id === mapping[id]?.bricksId)?.label ?? id;
  const nodes = [];
  (function rec(n) { nodes.push(n); n.children?.forEach(rec); })(tree);
  // a node under a hidden / skipped / svg parent was never reachable: not "missing"
  const unreachable = new Set();
  (function rec(n, dead) {
    if (dead) unreachable.add(n.id);
    const m = mapping[n.id];
    n.children?.forEach((c) => rec(c, dead || !!m?.skipped));
  })(tree, false);

  const built = Object.entries(mapping).filter(([, m]) => m.bricksId && !m.bricksId.startsWith('#'));
  const byElement = {};
  for (const [, m] of built) byElement[m.element] = (byElement[m.element] ?? 0) + 1;
  const skipped = Object.entries(mapping).filter(([, m]) => m.skipped);
  const missing = nodes.filter((n) => !mapping[n.id] && !unreachable.has(n.id));
  const unverified = built.filter(([, m]) => m.verify === false && !m.expect).length + skipped.filter(([, m]) => !m.skipped.startsWith('hidden')).length;

  const wrongByNode = {};
  for (const r of verify?.bad ?? []) (wrongByNode[r.label] ??= []).push(r);

  // severity tiers (shared/severity.mjs): FAIL = a blocker or major difference; tier 3 minor and tier 4 negligible are listed, they do not fail
  const tiers = verify?.tiers ?? { 1: 0, 2: verify?.bad?.length ?? 0, 3: 0, 4: 0 };
  const verdict = !verify ? 'NOT VERIFIED (step 5 not run)'
    : tiers[1] || tiers[2] ? `FAIL: ${tiers[1]} blocker and ${tiers[2]} major difference(s) from Figma`
      : tiers[3] ? `PASS WITH MINOR: ${tiers[3]} minor difference(s), ${tiers[4]} negligible (see below)`
        : !warnings.length && !st.unhandled.size && !missing.length ? `PASS: every checked value matches Figma within the negligible class (${tiers[4]} listed), nothing unmapped`
          : 'PASS WITH GAPS: values match, but some things are not built/approximated (see below)';

  const md = [
    `# Summary: ${tree.name} [${tree.id}]`, '',
    `**${verdict}**`, '',
    `Template: ${state.builderUrl ?? 'not pushed'}`, '',
    '## Overview', '',
    table(['', 'count'], [
      ['Figma nodes', st.nodes],
      ['Built as Bricks elements', `${built.length} (${Object.entries(byElement).map(([k, v]) => `${k} ${v}`).join(', ')})`],
      ['Skipped', skipped.length],
      ['Missing (no mapping, not skipped)', missing.length],
      ['Warnings (approximated / unsupported)', warnings.length],
      ['Unhandled Figma properties', st.unhandled.size],
      ['Checks measured in the browser', verify ? `${verify.total - verify.bad.length}/${verify.total} match` : 'not run'],
      ...variantChecks.map((v) => [`Checks at ${v.width}px (${v.key})`, `${v.total - v.bad} / ${v.total} match · ${v.file}`]),
    ]), '',
    '## ✅ Done', '',
    table(['Figma node', 'Bricks element'], built.slice(0, 60).map(([id, m]) => [`${clip(nameOf(id), 40)} \`${id}\``, m.element])),
    built.length > 60 ? `\n_… ${built.length - 60} more in report.md_` : '', '',
    '## 🧩 Components (approved detections)', '',
    table(['Figma node', 'Component', 'Detection'], built.filter(([, m]) => m.component).map(([id, m]) => [`${clip(nameOf(id), 40)} \`${id}\``, m.component, m.detection])),
    detections ? `\n${detections.components.filter((c) => c.status === 'proposed').length} candidate(s) still waiting for review in detections.md (they stay blocks).` : '\n_detect step not run: nothing was classified as a component._', '',
    '## ⏭ Skipped on purpose', '',
    table(['Figma node', 'Why'], skipped.map(([id, m]) => [`${clip(tree.id === id ? tree.name : (nodes.find((n) => n.id === id)?.name ?? id), 40)} \`${id}\``, clip(overrides[id]?.reason ?? m.skipped, 110)])), '',
    '## ✗ Wrong (rendered ≠ Figma)', '',
    table(['Node', 'Check', 'Figma', 'Rendered'], (verify?.bad ?? []).map((r) => [r.label, r.check, r.want, r.got])), '',
    '## ❓ Missing (visible in Figma, not in Bricks)', '',
    table(['Figma node', 'Type'], missing.map((n) => [`${clip(n.name, 40)} \`${n.id}\``, n.type])), '',
    '## ⚠ Not supported / approximated', '',
    table(['Figma node', 'Issue'], warnings.map((w) => [`${clip(w.name, 40)} \`${w.node}\``, clip(w.msg, 120)])), '',
    '## ❗ Unhandled Figma properties', '',
    st.unhandled.size ? [...st.unhandled].map((u) => `- ${u}`).join('\n') : '_none_', '',
    '## ◌ Not measured by verify', '',
    `${unverified} node(s) skipped or excluded from the browser check (skipped nodes, \`verify:false\`). Image content and the look of slider internals are never compared.`, '',
    '## Assets and fonts', '',
    `- Images uploaded: ${Object.keys(ws.readJson('assets/manifest.json', { images: {} }).images).length} · inline SVG: ${st.svgs}`,
    `- Fonts to have on the site: ${[...st.fonts].join(', ') || '-'}`,
    '',
  ].join('\n');

  ws.writeText('summary.md', md);
  console.log(`\n  summary.md → ${verdict}`);
  return { verdict, md };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { md } = summaryStep(process.argv[2]);
  console.log('\n' + md);
}
