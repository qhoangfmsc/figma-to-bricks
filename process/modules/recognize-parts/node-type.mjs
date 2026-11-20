// Figma node, fill, and effect types. The string lives here. A check uses isType or isAnyType.

export const NodeType = {
  FRAME: 'FRAME',
  GROUP: 'GROUP',
  INSTANCE: 'INSTANCE',
  COMPONENT: 'COMPONENT',
  SECTION: 'SECTION',
  TEXT: 'TEXT',
  RECTANGLE: 'RECTANGLE',
  ELLIPSE: 'ELLIPSE',
  VECTOR: 'VECTOR',
  LINE: 'LINE',
  STAR: 'STAR',
  POLYGON: 'POLYGON',
  REGULAR_POLYGON: 'REGULAR_POLYGON',
  BOOLEAN_OPERATION: 'BOOLEAN_OPERATION',
};

export const FillType = {
  SOLID: 'SOLID',
  IMAGE: 'IMAGE',
  GRADIENT_LINEAR: 'GRADIENT_LINEAR',
  GRADIENT_RADIAL: 'GRADIENT_RADIAL',
};

export const EffectType = {
  LAYER_BLUR: 'LAYER_BLUR',
};

export const BoxType = [NodeType.FRAME, NodeType.GROUP, NodeType.INSTANCE, NodeType.COMPONENT];
export const HolderType = [NodeType.FRAME, NodeType.INSTANCE, NodeType.COMPONENT];
export const ShapeType = [NodeType.RECTANGLE, NodeType.ELLIPSE, NodeType.FRAME, NodeType.VECTOR, NodeType.COMPONENT, NodeType.INSTANCE, NodeType.LINE];
export const ArtType = [NodeType.VECTOR, NodeType.BOOLEAN_OPERATION, NodeType.STAR, NodeType.POLYGON, NodeType.REGULAR_POLYGON, NodeType.LINE, NodeType.ELLIPSE, NodeType.RECTANGLE];
export const LineType = [NodeType.FRAME, NodeType.RECTANGLE, NodeType.LINE, NodeType.VECTOR, NodeType.INSTANCE, NodeType.COMPONENT, NodeType.GROUP];
export const SectionType = [NodeType.FRAME, NodeType.GROUP, NodeType.INSTANCE, NodeType.COMPONENT, NodeType.SECTION];

export const isType = (node, type) => node?.type === type;
export const isAnyType = (node, types) => types.includes(node?.type);
export const isText = (node) => isType(node, NodeType.TEXT);

function hairline(node) {
  const w = node?.box?.w ?? 0;
  const h = node?.box?.h ?? 0;
  const thin = Math.min(w, h);
  const long = Math.max(w, h);
  return long > 0 && thin / long <= 0.08;
}

// A leaf picture is the same slot whether Figma typed it as a frame or a rectangle.
// A hairline drawn on one copy does not make that copy a different card.
export function shapeRole(node, kidsOf) {
  const kids = kidsOf(node).filter((child) => !hairline(child));
  if (isText(node)) return 'text';
  if (!kids.length) return 'mark';
  return `box[${kids.map((child) => shapeRole(child, kidsOf)).join(',')}]`;
}
