// Candidate flat images. A front-end dev ships a pile of pictures as ONE picture, and does not rebuild it with CSS.
//   * a container with any image and no text (a background of a photo plus gradients): one Figma render
//   * a hand-placed banner: >= 5 art layers, art at least half of the leaves
// Auto layout stays real elements (a logo grid, an icon row). The innermost matching container is proposed.
const SHAPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'LINE', 'ELLIPSE', 'RECTANGLE']);
const CONTAINERS = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT']);
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function stats(n, acc = { art: 0, text: 0, images: 0, vectors: 0, rotated: 0, blurred: 0 }) {
  if (n.visible === false) return acc;
  const kids = visibleKids(n);
  const isArt = n.type !== 'TEXT' && (!kids.length || n.svg) && (SHAPES.has(n.type) || n.svg || n.fills?.some((f) => f.type === 'IMAGE'));
  if (isArt) {
    acc.art++;
    if (n.fills?.some((f) => f.type === 'IMAGE')) acc.images++; else acc.vectors++;
  } else if (n.type === 'TEXT' && !n.svg) acc.text++;
  if (n.rotation) acc.rotated++;
  if (n.effects?.some((e) => e.type === 'LAYER_BLUR')) acc.blurred++;
  if (!n.svg) for (const c of kids) stats(c, acc); // an svg root is one art layer, its parts are not counted
  return acc;
}

export function detectFlatImages(tree) {
  const found = [];
  (function walk(n, isRoot) {
    if (n.visible === false) return;
    const before = found.length;
    for (const c of visibleKids(n)) walk(c, false);
    if (found.length > before || isRoot || !CONTAINERS.has(n.type) || n.layout) return; // a deeper match wins
    const s = stats(n);
    const pictures = s.images >= 1 && s.text === 0;
    const banner = s.art >= 5 && s.art / (s.art + s.text) >= 0.5;
    if (pictures || banner) {
      found.push({
        component: 'flat-image', node: n.id, level: 'E2', cite: [{ node: n.id, field: 'type', equals: n.type }], confidence: s.rotated || s.blurred ? 'high' : 'medium',
        evidence: `${n.type} "${n.name}" ${Math.round(n.box.w)}×${Math.round(n.box.h)} hand-placed (no auto layout): ${s.art} art layers (${s.images} images, ${s.vectors} vectors/shapes; ${s.rotated} rotated, ${s.blurred} blurred) vs ${s.text} texts: looks like one banner picture`,
        params: { alt: null, link: null, scale: 2 },
        note: 'a front-end dev would ship this as one image. alt defaults to the visible texts; if the banner is clickable set params.link (not in Figma)',
      });
    }
  })(tree, true);
  return found;
}
