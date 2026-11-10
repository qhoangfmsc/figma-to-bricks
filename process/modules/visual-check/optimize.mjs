// png / jpg -> webp on this machine (sharp). Never upscales. SVG is not in the job.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

export async function writeOptimized(files) {
  const out = [];
  for (const file of files) {
    const img = sharp(file.src, { limitInputPixels: false });
    const meta = await img.metadata();
    let pipeline = img;
    const edge = Math.max(meta.width, meta.height);
    if (file.maxEdge && edge > file.maxEdge) {
      pipeline = pipeline.resize({
        width: meta.width >= meta.height ? file.maxEdge : undefined,
        height: meta.height > meta.width ? file.maxEdge : undefined,
        withoutEnlargement: true,
      });
    }
    const info = await pipeline.webp({ quality: file.quality ?? 86, alphaQuality: 100, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true });
    writeFileSync(file.dst, info.data);
    out.push({ src: file.src, dst: file.dst, from: [meta.width, meta.height], to: [info.info.width, info.info.height], bytes: info.data.length });
  }
  return out;
}
