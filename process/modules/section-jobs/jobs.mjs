// One section of a page, in the shape /generate-template-from-figma already reads.
// Desktop is the section. Tablet and mobile are the twins discoverVariants found.
// Landscape and widescreen stay blank when the file has no matching frame. Nothing here invents a link.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function figmaUrl(fileKey, id) {
  return `https://www.figma.com/design/${fileKey}/x?node-id=${String(id).replace(':', '-')}`;
}

const fileName = (id) => `${String(id).replace(':', '-')}.json`;

export function sectionJob({ fileKey, section, title, variants = [] }) {
  const by = Object.fromEntries(variants.map((v) => [v.key, v]));
  const link = (v) => (v?.id ? figmaUrl(fileKey, v.id) : '');
  return {
    id: section.id,
    name: section.name,
    title: title || section.name,
    firstSection: !!section.firstSection,
    desktop: figmaUrl(fileKey, section.id),
    widescreen: '',
    tablet: link(by.tablet_portrait),
    landscape: '',
    mobile: link(by.mobile_portrait),
  };
}

export function writeSectionJob(dir, job) {
  const folder = join(dir, 'jobs');
  mkdirSync(folder, { recursive: true });
  const file = join(folder, fileName(job.id));
  writeFileSync(file, `${JSON.stringify(job, null, 2)}\n`);
  return file;
}

export function writeJobIndex(dir, jobs) {
  const folder = join(dir, 'jobs');
  mkdirSync(folder, { recursive: true });
  const file = join(folder, 'index.json');
  writeFileSync(file, `${JSON.stringify({ sections: jobs }, null, 2)}\n`);
  return file;
}
