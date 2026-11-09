// Masonry and shape dividers. Controls are on layout elements in includes/elements/base.php.
// A normal grid is still _display grid. These two settings are only for a drawn masonry
// stack or a drawn edge shape. Columns and the shape name come from the frame, not a default.

const SHAPES = [
  'custom', 'cloud', 'drops', 'grid-round', 'grid-square', 'round', 'square', 'stroke', 'stroke-2',
  'tilt', 'triangle', 'triangle-concave', 'triangle-convex', 'triangle-double', 'wave', 'waves',
  'wave-brush', 'zigzag', 'vertical-cloud', 'vertical-drops', 'vertical-pixels', 'vertical-stroke',
  'vertical-stroke-2', 'vertical-tilt', 'vertical-triangle', 'vertical-triangle-double',
  'vertical-wave', 'vertical-waves', 'vertical-wave-brush', 'vertical-zigzag',
];

export const SHAPE_NAMES = SHAPES;

export function masonrySettings({ columns, gutter } = {}) {
  const count = Number(columns);
  if (!Number.isInteger(count) || count < 1) throw new Error('masonry needs columns from the frame');
  const settings = { _useMasonry: true, _masonryColumn: count };
  if (gutter != null) settings._masonryGutter = gutter;
  return settings;
}

export function shapeDivider({ shape, fill } = {}) {
  if (!SHAPES.includes(shape)) throw new Error(`${shape} is not a shape divider in Bricks 1.12.3`);
  const row = { shape };
  if (fill) row.fill = fill;
  return { _shapeDividers: [row] };
}
