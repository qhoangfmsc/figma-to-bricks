// Small whole-node appearance props: opacity, clip content, blend mode, mask. Rotation has its own module (rotation.mjs).
export function applyAppearance({ node, s, css, warn }) {
  if (node.opacity != null) { s._opacity = node.opacity; css.opacity = String(node.opacity); }
  if (node.clip) { s._overflow = 'hidden'; css.overflow = 'hidden'; }
  if (node.blendMode) s._mixBlendMode = node.blendMode.toLowerCase().replace(/_/g, '-');
  if (node.isMask) warn(node, 'mask layer is not supported');
}
