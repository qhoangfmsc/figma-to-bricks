// One line per read failure, appended for the whole repo. The workflow keeps going.
// history/notes is the place a miss is recorded. The line is the error text, the step, and the node.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '../../../history/notes/read-errors.md');

export function noteReadError({ step, node, fileKey, error }) {
  mkdirSync(dirname(file), { recursive: true });
  const when = new Date().toISOString();
  const where = [fileKey, node].filter(Boolean).join(' ');
  appendFileSync(file, `- ${when} \`${step}\` ${where}: ${String(error).replace(/\s+/g, ' ')}\n`);
}
