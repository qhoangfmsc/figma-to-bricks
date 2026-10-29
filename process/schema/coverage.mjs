#!/usr/bin/env node
// What the pipeline does with everything Figma can send -> process/schema/COVERAGE.md (read by the owner, regenerated, never edited by hand)
//   node process/schema/coverage.mjs
// Sources: figma-nodes.schema.json (the published REST spec) + handling.json (the decision for every property) + the enum values the code never names.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('./', import.meta.url));
const schema = JSON.parse(readFileSync(join(dir, 'figma-nodes.schema.json'), 'utf8'));
const h = JSON.parse(readFileSync(join(dir, 'handling.json'), 'utf8'));

const walk = (p) => readdirSync(p, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'work' || e.name === 'test' || e.name === 'schema' || e.name === 'fixtures' ? [] : walk(join(p, e.name))) : /\.mjs$/.test(e.name) ? [readFileSync(join(p, e.name), 'utf8')] : []));
const code = ['figma', 'bricks', 'responsive', 'scripts'].flatMap((d) => walk(join(dir, '..', d))).join('\n');
const named = (v) => new RegExp(`(^|[^A-Za-z0-9_])${v.replace(/[%]/g, '\\$&')}([^A-Za-z0-9_]|$)`).test(code);

const count = (t) => Object.values(t).reduce((a, v) => ((a[v.status] = (a[v.status] ?? 0) + 1), a), {});
const rows = (t, status) => Object.entries(t).filter(([, v]) => v.status === status).sort(([a], [b]) => a.localeCompare(b));

const lines = ['# What the pipeline does with every property Figma can send', '',
  `Generated from the Figma REST spec ${schema.specVersion} (\`${schema.source}\`) and \`handling.json\`. The test \`handling: every property ... is classified\` fails when a property is missing here.`, '',
  `| | read | ignored (with reason) | limit | gap |`, '|---|---|---|---|---|'];
for (const [name, t] of [['node properties', h.node], ['text style properties', h.textStyle]]) {
  const c = count(t);
  lines.push(`| ${name} (${Object.keys(t).length}) | ${c.read ?? 0} | ${c.ignored ?? 0} | ${c.limit ?? 0} | ${c.gap ?? 0} |`);
}
lines.push('', '`limit` = visual, cannot be reproduced exactly, reported when a node really uses it. `gap` = visual and reproducible, not built yet, reported the same way.', '');
for (const [title, t] of [['Node', h.node], ['Text style', h.textStyle]]) {
  for (const status of ['gap', 'limit']) {
    const r = rows(t, status);
    if (!r.length) continue;
    lines.push(`## ${title}: ${status === 'gap' ? 'gaps (to build)' : 'limits (reported)'}`, '', '| property | default | why |', '|---|---|---|');
    for (const [k, v] of r) lines.push(`| \`${k}\` | ${v.default === undefined ? '(absent)' : `\`${JSON.stringify(v.default)}\``} | ${v.why} |`);
    lines.push('');
  }
}
// enum values of properties that change the look and that no code names: a value the build may not know what to do with
const watch = ['strokeAlign', 'strokeCap', 'strokeJoin', 'blendMode', 'textCase', 'textDecoration', 'textAutoResize', 'textTruncation', 'layoutMode', 'layoutAlign', 'layoutPositioning',
  'layoutSizingHorizontal', 'layoutSizingVertical', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'textAlignHorizontal', 'textAlignVertical', 'scaleMode', 'constraintType', 'maskType'];
const enumFor = (k) => {
  for (const n of Object.values(schema.nodeTypes)) if (n.properties[k]?.enum) return n.properties[k].enum;
  for (const o of Object.values(schema.objects)) if (o.properties?.[k]?.enum) return o.properties[k].enum;
  return null;
};
const gapsEnum = watch.map((k) => [k, enumFor(k)]).filter(([, v]) => v).map(([k, v]) => [k, v.filter((x) => !named(x) && !h.enums?.[k]?.[x])]).filter(([, v]) => v.length); // a value with an entry in handling.json.enums is decided
lines.push('## Enum values with a decision (reported when a node has them)', '', '| value | status | why |', '|---|---|---|');
for (const [k, vals] of Object.entries(h.enums ?? {})) for (const [v, e] of Object.entries(vals)) lines.push(`| \`${k}\` = ${v} | ${e.status} | ${e.why} |`);
lines.push('');
lines.push('## Enum values that no code names', '', 'A value listed here is not mapped anywhere: when a design uses it the build does what it does for an unknown value. Each needs a rule or a `limit` entry.', '', '| property | values |', '|---|---|');
for (const [k, v] of gapsEnum) lines.push(`| \`${k}\` | ${v.join(', ')} |`);
lines.push('');
writeFileSync(join(dir, 'COVERAGE.md'), lines.join('\n'));
console.log(`COVERAGE.md: node ${JSON.stringify(count(h.node))} · text ${JSON.stringify(count(h.textStyle))} · ${gapsEnum.length} properties with enum values no code names`);
