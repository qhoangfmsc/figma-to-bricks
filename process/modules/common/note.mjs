// A workflow run records a gap here. It does not edit process/ to fit one file.
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const NOTES = fileURLToPath(new URL('../../../history/notes/', import.meta.url));

export function appendNote(title, body) {
  mkdirSync(NOTES, { recursive: true });
  const file = join(NOTES, 'gaps.md');
  const block = `\n## ${new Date().toISOString().slice(0, 16)} — ${title}\n\n${String(body).trim()}\n`;
  appendFileSync(file, block);
  return file;
}
