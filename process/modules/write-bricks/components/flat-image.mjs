import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
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
import { addHoverFade } from '../../write-bricks/render/utils/interactions.mjs';
import { px } from '../../write-bricks/render/utils/css.mjs';

const visibleTexts = (n, out = []) => {
  if (n.visible === false) return out;
  if (n.type === 'TEXT' && n.text?.characters?.trim()) out.push(n.text.characters.trim().replace(/\s+/g, ' '));
  (n.children ?? []).forEach((c) => visibleTexts(c, out));
  return out;
};

export const defaultAlt = (node) => [...new Set(visibleTexts(node))].join(' ');

function ancestors(root, id) {
  const path = [];
  (function walk(n, stack) {
    if (n.id === id) { path.push(...stack); return true; }
    for (const c of n.children ?? []) if (c && walk(c, [...stack, n])) return true;
    return false;
  })(root, []);
  return path;
}

// Figma's render of a node inside a clipping frame is the part that stays inside that frame.
export function clippedBox(root, node) {
  if (!root?.box || !node?.box) return null;
  let box = { x: node.box.absX, y: node.box.absY, w: node.box.w, h: node.box.h };
  let clipped = false;
  for (const frame of ancestors(root, node.id)) {
    if (!frame.clip || !frame.box) continue;
    const x = Math.max(box.x, frame.box.absX);
    const y = Math.max(box.y, frame.box.absY);
    const right = Math.min(box.x + box.w, frame.box.absX + frame.box.w);
    const bottom = Math.min(box.y + box.h, frame.box.absY + frame.box.h);
    if (right - x < 1 || bottom - y < 1) return null;
    if (Math.abs(right - x - box.w) > 1 || Math.abs(bottom - y - box.h) > 1) clipped = true;
    box = { x, y, w: right - x, h: bottom - y };
  }
  return clipped ? box : null;
}

// approved flat-image detections -> what step 4 must export
export const exportJobs = (detections) => (detections?.components ?? [])
  .filter((c) => c.status === 'approved' && isKind(c, PartKind.FLAT_IMAGE))
  .map((c) => ({ node: c.node, scale: Number(c.params?.scale) || 2 }));

export default {
  id: PartKind.FLAT_IMAGE,
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
    if (Math.abs(w - node.box.w) <= 1 && Math.abs(h - node.box.h) <= 1) return { ok: true };
    const clip = clippedBox(env.root, node);
    if (clip && Math.abs(w - clip.w) <= 1 && Math.abs(h - clip.h) <= 1) return { ok: true };
    return { ok: false, reason: `the Figma export is ${w}×${h}px but the node box is ${node.box.w}×${node.box.h}px (effects spill outside the box)` };
  },

  apply({ node, s, flats, root, parent }, det) {
    const f = flats[node.id];
    s.image = { $asset: f.file, size: 'full' };
    s.altText = det.params?.alt ?? defaultAlt(node);
    s._objectFit = 'fill'; // the div is the box; the picture fills it. No crop, no custom CSS: Figma already drew the stack.
    const clip = clippedBox(root, node);
    const w = f.width / f.scale, h = f.height / f.scale;
    if (clip && parent?.box && Math.abs(w - clip.w) <= 1 && Math.abs(h - clip.h) <= 1) {
      Object.assign(s, {
        _position: 'absolute',
        _left: px(clip.x - parent.box.absX),
        _top: px(clip.y - parent.box.absY),
        _width: px(clip.w),
        _height: px(clip.h),
        _widthMax: 'none',
      });
    }
    if (det.params?.link) { Object.assign(s, { link: 'url', url: { type: 'external', url: det.params.link } }); addHoverFade(s); }
  },
};
