import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRunDir, workRoot } from '../../modules/common/workspace.mjs';

// The saved frames. The folder name is not the identity. meta.json holds the file and the node.
export const SavedRun = {
  PRICE_DESKTOP: { fileKey: 'iQlAPdkcVQvKplkaXBrZGf', nodeId: '13680:1397' },
  PRICE_MOBILE: { fileKey: 'iQlAPdkcVQvKplkaXBrZGf', nodeId: '13777:20738' },
  SECTION_DESKTOP: { fileKey: 'l8aNcrS7ekxROSiJbV3Y17', nodeId: '4299:84767' },
  SECTION_MOBILE: { fileKey: 'l8aNcrS7ekxROSiJbV3Y17', nodeId: '4299:85986' },
};

export function savedRun(entry) {
  const dir = findRunDir(workRoot(), entry.fileKey, entry.nodeId);
  if (!dir) throw new Error(`No saved run for ${entry.nodeId}`);
  const tree = JSON.parse(readFileSync(join(dir, 'tree.json'), 'utf8'));
  return { ...entry, dir, tree };
}
