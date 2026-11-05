// Helpers over RAW Figma node JSON (as returned by the REST API).

export const SHAPE_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'LINE', 'ELLIPSE', 'RECTANGLE']);
export const TRUE_VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'LINE']);
export const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET', 'SECTION']);

// Icon fonts (Font Awesome ligatures etc.): the text is a glyph name, only Figma knows how it looks -> export as SVG
export const ICON_FONT = /font ?awesome|material (icons|symbols)|icomoon|phosphor|remixicon|bootstrap-icons|ionicons/i;
export const isIconText = (n) => n.type === 'TEXT' && ICON_FONT.test(n.style?.fontFamily ?? '');

export const isVisible = (n) => n.visible !== false;
export const visibleFills = (n) => (n.fills ?? []).filter((f) => f.visible !== false);
export const hasImageFill = (n) => visibleFills(n).some((f) => f.type === 'IMAGE');

export function walk(node, fn, { includeHidden = false } = {}) {
  if (!includeHidden && !isVisible(node)) return;
  fn(node);
  for (const c of node.children ?? []) walk(c, fn, { includeHidden });
}

// A subtree that is only vector shapes: export as one SVG instead of rebuilding it
function onlyShapes(node) {
  if (!isVisible(node)) return true;
  if (hasImageFill(node) || node.type === 'TEXT') return false;
  if (node.children?.length) return node.children.every(onlyShapes);
  return SHAPE_TYPES.has(node.type);
}

function hasTrueVector(node) {
  if (!isVisible(node)) return false;
  return TRUE_VECTOR_TYPES.has(node.type) || (node.children ?? []).some(hasTrueVector);
}

// A horizontal or vertical row of frames (the logo cards under a tab) stays a layout.
// Each card is still its own svg. Collapsing the row into one picture drops the cards from the tree.
export function isLayoutRow(node) {
  const mode = node?.layoutMode ?? node?.layout?.mode;
  if (!mode || mode === 'NONE') return false;
  const cards = (node.children ?? []).filter((c) => isVisible(c) && CONTAINER_TYPES.has(c.type));
  return cards.length >= 2;
}

export function isSvgRoot(node) {
  if (!isVisible(node)) return false;
  if (isIconText(node)) return true;
  if (TRUE_VECTOR_TYPES.has(node.type) && node.type !== 'LINE') return true;
  if (isLayoutRow(node)) return false;
  return CONTAINER_TYPES.has(node.type) && !!node.children?.length && onlyShapes(node) && hasTrueVector(node);
}

// Top-most svg roots of a subtree (never descends into one)
export function collectSvgRoots(root) {
  const out = [];
  (function rec(n) {
    if (!isVisible(n)) return;
    if (isSvgRoot(n)) return void out.push(n);
    for (const c of n.children ?? []) rec(c);
  })(root);
  return out;
}

export function collectImageRefs(root) {
  const refs = new Set();
  walk(root, (n) => {
    for (const f of visibleFills(n)) if (f.type === 'IMAGE' && f.imageRef) refs.add(f.imageRef);
  });
  return [...refs];
}
