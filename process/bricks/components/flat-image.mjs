// COMPONENT flat-image: a whole node (banner, hero art, illustration) shipped as ONE picture rendered by Figma.
// Why: a front-end developer does not rebuild a banner from 100 layers (rotated blurred images, vectors, 3 copies of a heading
// to fake a 3D effect). They put one image there. Figma renders it, so rotation / blur / opacity / rounded corners are exact.
// Figma side: any container whose children are mostly artwork. The whole subtree (text and buttons included) is swallowed.
// Bricks 1.9.8: `image` element (altText, optional link). Source: includes/elements/image.php (link: 'url' + url).
// Needs step 4 (export) to have downloaded the picture (assets/flat/*.png, manifest.flats).
// params: alt (default: the visible texts of the node, duplicates removed, in tree order) · link (optional url: the whole
//         image is a link, e.g. a banner that is the sign-up button) · scale (default 2, the PNG is exported at 2x)
// Limits: the picture is not editable and its text is not selectable; node effects that spill outside the box (drop shadow,
// blur) make the export larger than the box, in which case the detection is not applied (kept as block, with the reason).
import { addHoverFade } from '../render/utils/interactions.mjs';

const visibleTexts = (n, out = []) => {
  if (n.visible === false) return out;
  if (n.type === 'TEXT' && n.text?.characters?.trim()) out.push(n.text.characters.trim().replace(/\s+/g, ' '));
  (n.children ?? []).forEach((c) => visibleTexts(c, out));
  return out;
};

export const defaultAlt = (node) => [...new Set(visibleTexts(node))].join(' ');

// approved flat-image detections -> what step 4 must export
export const exportJobs = (detections) => (detections?.components ?? [])
  .filter((c) => c.status === 'approved' && c.component === 'flat-image')
  .map((c) => ({ node: c.node, scale: Number(c.params?.scale) || 2 }));

export default {
  id: 'flat-image',
  status: 'implemented',
  label: 'Flat image (banner / artwork)',
  figma: 'container made mostly of images, vectors and decoration (rotation, blur), possibly with text and a button drawn inside',
  bricks: '`image` element with one PNG exported from Figma (alt from the texts, optional link); the whole subtree is merged',
  limits: 'not editable, text inside is not selectable; effects spilling outside the node box are not supported',
  mergesChildren: true,
  kind: () => 'image',
  skipsStyle: true, // fill, stroke, radius, opacity are already inside the picture
  intrinsic: true, // the box is the Figma box, never "hug content"

  check(node, det, env) {
    const f = env.flats?.[node.id];
    if (!f) return { ok: false, reason: 'not exported yet: run the export step (--from=export)' };
    const w = f.width / f.scale, h = f.height / f.scale;
    if (Math.abs(w - node.box.w) > 1 || Math.abs(h - node.box.h) > 1) return { ok: false, reason: `the Figma export is ${w}×${h}px but the node box is ${node.box.w}×${node.box.h}px (effects spill outside the box)` };
    return { ok: true };
  },

  apply({ node, s, flats }, det) {
    const f = flats[node.id];
    s.image = { $asset: f.file, size: 'full' };
    s.altText = det.params?.alt ?? defaultAlt(node);
    s._objectFit = 'fill';
    if (det.params?.link) { Object.assign(s, { link: 'url', url: { type: 'external', url: det.params.link } }); addHoverFade(s); }
  },
};
