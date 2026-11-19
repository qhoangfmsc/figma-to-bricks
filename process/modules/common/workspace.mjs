// Scratch for one Figma node lives in history/runs inside this repo (gitignored).
// A run creates history/runs/{timestamp}-{frame-name}/. Spaces in the frame name become hyphens.
// The Figma file key stays in meta.json. File-level files (baseline, progress) live in history/runs/.files/<fileKey>/.
// The same frame keeps that folder. The node id is not the folder name.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import { parseFigmaUrl } from '../read-figma/url.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

export function workRoot() {
  const dir = join(REPO, 'history', 'runs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

const WORK = workRoot();

export const legacyRunDir = (nodeId) => String(nodeId).replace(':', '-');

// "{timestamp}-{name}". Spaces become one hyphen so the folder is one token. A slash would become another folder.
export function runDirName(name, now = Date.now()) {
  const clean = String(name ?? '').replace(/[\\/\0]/g, ' ').trim().replace(/\s+/g, '-');
  if (!clean || !Number.isFinite(now)) return '';
  return `${now}-${clean}`;
}

function readMeta(dir) {
  const file = join(dir, 'meta.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function listRunDirs(root = WORK) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((entry) => !entry.startsWith('.'))
    .map((entry) => join(root, entry))
    .filter((dir) => {
      try { return statSync(dir).isDirectory(); } catch { return false; }
    });
}

export function runsOfFile(fileKey, root = WORK) {
  return listRunDirs(root).filter((dir) => readMeta(dir)?.fileKey === fileKey);
}

export function fileShelf(fileKey, root = WORK) {
  const dir = join(root, '.files', fileKey);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function findRunDir(root, fileKey, nodeId) {
  const legacy = legacyRunDir(nodeId);
  const hits = listRunDirs(root).filter((dir) => {
    const meta = readMeta(dir);
    if (meta?.fileKey && meta.fileKey !== fileKey) return false;
    if (meta?.nodeId === nodeId) return true;
    return basename(dir) === legacy;
  });
  return hits.find((dir) => basename(dir) !== legacy) ?? hits[0] ?? '';
}

export function resolveWorkspace(arg, root = WORK) {
  if (!arg) throw new Error('Pass a Figma URL or a workspace directory');
  let dir, ref = null;
  if (/^https?:\/\//.test(arg)) {
    ref = parseFigmaUrl(arg);
    dir = findRunDir(root, ref.fileKey, ref.nodeId) || join(root, legacyRunDir(ref.nodeId));
  } else {
    dir = resolve(arg);
    if (!existsSync(dir)) throw new Error(`Workspace not found: ${dir}`);
  }
  mkdirSync(dir, { recursive: true });
  if (!ref && existsSync(join(dir, 'meta.json'))) ref = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const file = (name) => join(dir, name);
  return {
    dir, ref, file,
    has: (name) => existsSync(file(name)),
    readJson: (name, fallback) => {
      if (!existsSync(file(name))) {
        if (fallback !== undefined) return fallback;
        throw new Error(`Missing ${name} in ${dir}. Run the previous step first.`);
      }
      return JSON.parse(readFileSync(file(name), 'utf8'));
    },
    writeJson: (name, data) => writeFileSync(file(name), JSON.stringify(data, null, 2) + '\n'),
    writeText: (name, text) => writeFileSync(file(name), text),
  };
}

// The first fetch names the folder. A later fetch of the same frame keeps it.
export function nameWorkspace(ws, name, now = Date.now()) {
  const legacy = ws.ref?.nodeId ? legacyRunDir(ws.ref.nodeId) : '';
  const folder = runDirName(name, now);
  if (!legacy || !folder || basename(ws.dir) !== legacy) return ws;
  let dest = join(dirname(ws.dir), folder);
  let stamp = now;
  while (existsSync(dest)) dest = join(dirname(ws.dir), runDirName(name, stamp += 1));
  renameSync(ws.dir, dest);
  return resolveWorkspace(dest);
}

export const safeId = (id) => id.replace(/[^A-Za-z0-9_-]/g, '_');
