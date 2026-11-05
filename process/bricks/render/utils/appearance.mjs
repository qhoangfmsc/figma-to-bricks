// Small whole-node appearance props: opacity, clip content, blend mode, mask. Rotation has its own module (rotation.mjs).

// Figma clips at the frame edge. CSS overflow hidden clips at the padding edge, so a fixed child
// that is centered across the padding (still inside the frame) would lose both ends.
function crossesPaddingInsideFrame(node) {
  const box = node.box;
  const pad = node.layout?.padding;
  if (!box || !pad) return false;
  const left = pad.left ?? 0, right = pad.right ?? 0, top = pad.top ?? 0, bottom = pad.bottom ?? 0;
  if (left <= 0 && right <= 0 && top <= 0 && bottom <= 0) return false;
  return (node.children ?? []).some((c) => {
    if (c.visible === false || !c.box) return false;
    const b = c.box;
    const inFrame = b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= box.w + 0.5 && b.y + b.h <= box.h + 0.5;
    const pastPad = b.x < left - 0.5 || b.y < top - 0.5 || b.x + b.w > box.w - right + 0.5 || b.y + b.h > box.h - bottom + 0.5;
    return inFrame && pastPad;
  });
}

export function applyAppearance({ node, s, css, warn }) {
  if (node.opacity != null) { s._opacity = node.opacity; css.opacity = String(node.opacity); }
  if (node.clip && !crossesPaddingInsideFrame(node)) { s._overflow = 'hidden'; css.overflow = 'hidden'; }
  if (node.blendMode) s._mixBlendMode = node.blendMode.toLowerCase().replace(/_/g, '-');
  if (node.isMask) warn(node, 'mask layer is not supported');
}
