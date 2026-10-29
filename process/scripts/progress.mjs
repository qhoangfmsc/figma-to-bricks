#!/usr/bin/env node
// Prints the latest progress file of a run:  node process/scripts/progress.mjs <fileKey> [<node-id>]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [fileKey, node] = process.argv.slice(2);
if (!fileKey) { console.error('usage: node process/scripts/progress.mjs <fileKey> [<node-id>]'); process.exit(1); }
const dir = fileURLToPath(new URL(`../work/${fileKey}/`, import.meta.url));
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^progress-.*\.md$/.test(f) && (!node || f === `progress-${node.replace(':', '-')}.md`)) : [];
if (!files.length) { console.error('no progress file yet'); process.exit(1); }
const latest = files.map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0].f;
console.log(readFileSync(join(dir, latest), 'utf8'));
