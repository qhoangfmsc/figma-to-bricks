// The contract between Figma's property list and the pipeline: schema/handling.json says, for every property a node (or a text style) can carry,
// whether it is read, ignored for a stated reason, or a visual property the build does not reproduce. Nothing in normalize.mjs decides this on its own.
import { readFileSync } from 'node:fs';

const table = JSON.parse(readFileSync(new URL('./handling.json', import.meta.url), 'utf8'));
export const HANDLING = table;

const near = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.01 : JSON.stringify(a) === JSON.stringify(b));
// is `value` the default of a property (so there is nothing to report)? An array default [x] means "every element is x", [] means "empty"
export function isDefault(value, def) {
  if (def === undefined) return value === undefined || value === null;
  if (Array.isArray(def)) return Array.isArray(value) && (def.length === 0 ? value.length === 0 : value.every((v) => near(v, def[0])));
  if (def && typeof def === 'object') return value && typeof value === 'object' && Object.keys(def).length === 0 ? Object.keys(value).length === 0 : near(value, def);
  return near(value, def);
}

const short = (v) => { const t = typeof v === 'string' ? v : JSON.stringify(v); return t.length > 40 ? `${t.slice(0, 37)}...` : t; };
const flagger = (section) => (key, value) => {
  const e = table[section][key];
  if (!e) return `${key}: NOT CLASSIFIED (add it to process/schema/handling.json)`;
  if (e.status === 'read' || e.status === 'ignored') return null;
  if (isDefault(value, e.default)) return null; // a limit / gap property only matters when the node really uses it
  return `${key}=${short(value)} [${e.status}]: ${e.why}`;
};
export const nodeFlag = flagger('node');
export const textFlag = flagger('textStyle');
export const sectionOf = (section, status) => new Set(Object.entries(table[section]).filter(([, v]) => v.status === status).map(([k]) => k));

// a VALUE of a property that is read, but that no rule maps (textCase SMALL_CAPS, textAutoResize TRUNCATE...): reported when a node really has it
export function enumFlag(key, value) {
  const e = table.enums?.[key]?.[value];
  return e && (e.status === 'gap' || e.status === 'limit') ? `${key}=${value} [${e.status}]: ${e.why}` : null;
}
