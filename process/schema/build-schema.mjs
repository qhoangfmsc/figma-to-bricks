#!/usr/bin/env node
// Figma's own description of what a node can carry -> process/schema/figma-nodes.schema.json
//   node process/schema/build-schema.mjs            reads schema/source/figma-openapi-<version>.yaml (the file Figma publishes: github.com/figma/rest-api-spec)
// Output: for every node type (FRAME, TEXT, VECTOR, ...) the full list of properties with their type / enum values, resolved through allOf and $ref,
// and the same for every object a property points to (Paint, Effect, TypeStyle, LayoutConstraint, ...). This is the REFERENCE of the pipeline: what Figma
// can send, not what the three designs so far happened to use. `coverage.mjs` compares it with what the pipeline handles.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseYaml } from './yaml-lite.mjs';

const dir = fileURLToPath(new URL('./', import.meta.url));
export function buildSchema() {
const file = readdirSync(join(dir, 'source')).filter((f) => /^figma-openapi-.*\.yaml$/.test(f)).sort().pop();
const text = readFileSync(join(dir, 'source', file), 'utf8');
const doc = parseYaml(text);
const schemas = doc.components.schemas;

const refName = (r) => r.replace('#/components/schemas/', '');

// the type of one property, short and stable: 'string' | 'number' | 'boolean' | 'object' | 'array<X>' | '<SchemaName>'
function typeOf(p) {
  if (!p) return 'unknown';
  if (p.$ref) return refName(p.$ref);
  if (p.type === 'array') return `array<${typeOf(p.items)}>`;
  if (p.allOf) return p.allOf.map(typeOf).join('&');
  if (p.oneOf || p.anyOf) return (p.oneOf ?? p.anyOf).map(typeOf).join('|');
  if (Array.isArray(p.type)) return p.type.join('|'); // OpenAPI 3.1: type: [string, null]
  return p.type ?? (p.enum ? 'string' : 'unknown');
}

// flatten a schema: properties merged over allOf / $ref, each with where it came from
function flatten(name, seen = new Set()) {
  const s = schemas[name];
  if (!s || seen.has(name)) return { properties: {}, required: new Set() };
  seen.add(name);
  const out = { properties: {}, required: new Set() };
  const merge = (part, origin) => {
    if (!part) return;
    if (part.$ref) { const f = flatten(refName(part.$ref), seen); for (const [k, v] of Object.entries(f.properties)) out.properties[k] = { ...v, ...(out.properties[k]?.enum && !v.enum && { enum: out.properties[k].enum }) }; f.required.forEach((r) => out.required.add(r)); return; }
    for (const [k, v] of Object.entries(part.properties ?? {})) {
      const en = v.enum ?? v.items?.enum ?? out.properties[k]?.enum; // allOf is an intersection: an enum given by one part stays when another part only says `string`
      out.properties[k] = { type: typeOf(v) === 'string' && out.properties[k]?.type ? out.properties[k].type : typeOf(v), ...(en && { enum: en }), from: out.properties[k]?.from ?? origin };
    }
    (part.required ?? []).forEach((r) => out.required.add(r));
    for (const a of part.allOf ?? []) merge(a, origin);
    for (const a of part.oneOf ?? part.anyOf ?? []) { if (a.$ref) { /* a union member: its own entry is listed under objects */ } else merge(a, origin); }
  };
  merge(s, name);
  return out;
}

// node types: every schema whose `type` property is an enum with a single value (FrameNode -> FRAME)
const nodeTypes = {};
for (const [name, s] of Object.entries(schemas)) {
  if (!/Node$/.test(name)) continue;
  const f = flatten(name);
  const t = f.properties.type?.enum;
  if (!t || t.length !== 1) continue;
  nodeTypes[t[0]] = { schema: name, properties: Object.fromEntries(Object.entries(f.properties).sort(([a], [b]) => a.localeCompare(b))), required: [...f.required].sort() };
}

// the objects a node property points to (Paint, Effect, TypeStyle...): one level, every schema that is referenced by a node property type
const wanted = new Set();
const collect = (type) => { for (const m of type.matchAll(/[A-Z][A-Za-z0-9]+/g)) if (schemas[m[0]]) wanted.add(m[0]); };
for (const n of Object.values(nodeTypes)) for (const p of Object.values(n.properties)) collect(p.type);
for (let round = 0; round < 3; round++) for (const name of [...wanted]) for (const p of Object.values(flatten(name).properties)) collect(p.type);
const objects = {};
for (const name of [...wanted].sort()) {
  const f = flatten(name);
  const props = Object.fromEntries(Object.entries(f.properties).sort(([a], [b]) => a.localeCompare(b)));
  const s = schemas[name];
  objects[name] = { properties: props, ...(s.enum && { enum: s.enum }), ...(s.oneOf && { oneOf: s.oneOf.map(typeOf) }) };
}
// plain string enums that a property refers to by name (e.g. BlendMode, StrokeAlign...)
const enums = Object.fromEntries(Object.entries(schemas).filter(([, s]) => Array.isArray(s.enum)).map(([k, s]) => [k, s.enum]));

const out = { specVersion: doc.info.version, source: file, nodeTypes, objects, enums };
return out;
}

export const SCHEMA_FILE = join(dir, 'figma-nodes.schema.json');
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildSchema();
  writeFileSync(SCHEMA_FILE, JSON.stringify(out, null, 1));
  const all = new Set(Object.values(out.nodeTypes).flatMap((n) => Object.keys(n.properties)));
  console.log(`spec ${out.specVersion}: ${Object.keys(out.nodeTypes).length} node types, ${all.size} distinct node properties, ${Object.keys(out.objects).length} referenced objects, ${Object.keys(out.enums).length} named enums -> ${SCHEMA_FILE}`);
}
