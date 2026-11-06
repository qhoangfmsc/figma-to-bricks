import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sectionJob, writeSectionJob, writeJobIndex } from '../modules/section-jobs/jobs.mjs';

test('a section job carries the desktop link and only the breakpoint frames that were found', () => {
  const job = sectionJob({
    fileKey: 'FILE',
    section: { id: '10:20', name: 'Banner', firstSection: true },
    title: 'Speed - Banner',
    variants: [{ key: 'tablet_portrait', id: '10:21', width: 768 }, { key: 'mobile_portrait', id: '10:22', width: 375 }],
  });
  assert.equal(job.desktop, 'https://www.figma.com/design/FILE/x?node-id=10-20');
  assert.equal(job.tablet, 'https://www.figma.com/design/FILE/x?node-id=10-21');
  assert.equal(job.mobile, 'https://www.figma.com/design/FILE/x?node-id=10-22');
  assert.equal(job.landscape, '');
  assert.equal(job.widescreen, '');
  assert.equal(job.firstSection, true);
});

test('jobs land as one json per section plus an index', () => {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-jobs-'));
  const job = sectionJob({ fileKey: 'FILE', section: { id: '1:2', name: 'Hero' }, title: 'Hero' });
  writeSectionJob(dir, job);
  const index = writeJobIndex(dir, [job]);
  assert.equal(JSON.parse(readFileSync(join(dir, 'jobs', '1-2.json'), 'utf8')).name, 'Hero');
  assert.equal(JSON.parse(readFileSync(index, 'utf8')).sections.length, 1);
});
