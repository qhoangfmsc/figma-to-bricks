// Image optimizer, runs INSIDE the f2b-qa image (sharp):  node /qa/optimize.mjs /job/optimize.json
// job: { files: [{ src: '/assets/images/x.png', dst: '/assets/optimized/<sha>.webp', maxEdge: 1600, quality: 86 }] }
// Photos / artwork -> WebP (alpha kept). Never upscales. SVG is not touched (not in the job).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/qa/');
const sharp = require('sharp');
const job = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = [];
for (const f of job.files) {
  const img = sharp(f.src, { limitInputPixels: false });
  const meta = await img.metadata();
  let p = img;
  const edge = Math.max(meta.width, meta.height);
  if (f.maxEdge && edge > f.maxEdge) p = p.resize({ width: meta.width >= meta.height ? f.maxEdge : undefined, height: meta.height > meta.width ? f.maxEdge : undefined, withoutEnlargement: true });
  const info = await p.webp({ quality: f.quality ?? 86, alphaQuality: 100, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true });
  writeFileSync(f.dst, info.data);
  out.push({ src: f.src, dst: f.dst, from: [meta.width, meta.height], to: [info.info.width, info.info.height], bytes: info.data.length });
}
writeFileSync(process.argv[2].replace(/\.json$/, '.out.json'), JSON.stringify(out));
