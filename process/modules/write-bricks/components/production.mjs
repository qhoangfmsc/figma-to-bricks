// Widgets this project owns, written with the Bricks 1.12.3 control keys.
// includes/elements/image-gallery.php, progress-bar.php, rating.php, alert.php, logo.php, toggle.php, dropdown.php, offcanvas.php.
import { colorObj, px } from '../render/utils/css.mjs';

const ok = { ok: true, warnings: [] };

export const gallery = {
  id: 'gallery',
  status: 'implemented',
  label: 'Gallery',
  figma: 'three or more pictures of one size and no arrows (`rules/production-widgets.mjs`)',
  bricks: '`image-gallery`. items.images, layout grid, columns, gutter, imageHeight from the drawn pictures',
  limits: 'Masonry and metro are not guessed. A row with arrows stays a slider',
  mergesChildren: true,
  kind: () => 'image-gallery',
  check(_node, det) {
    if (!det.params?.images || det.params.images.length < 3) return { ok: false, reason: 'a gallery needs at least three picture files' };
    return ok;
  },
  apply(ctx, det) {
    const { s } = ctx;
    s.items = { images: det.params.images.map((file) => ({ $asset: file, size: 'full' })), size: 'full' };
    s.layout = 'grid';
    s.columns = det.params.columns;
    s.gutter = px(det.params.gutter ?? 0);
    s.imageHeight = px(det.params.height);
  },
};

export const progress = {
  id: 'progress',
  status: 'implemented',
  label: 'Progress',
  figma: 'a track with a shorter fill. The fill width is the percent',
  bricks: '`progress-bar`. bars[].title, percentage, color, and height',
  limits: 'A percent written as text is used. Otherwise the percent is the fill width divided by the track width',
  mergesChildren: true,
  kind: () => 'progress-bar',
  check(_node, det) {
    if (!det.params?.bars?.length) return { ok: false, reason: 'no bar was measured' };
    return ok;
  },
  apply(ctx, det) {
    const { s } = ctx;
    s.bars = det.params.bars.map((bar) => ({
      title: bar.title ?? '',
      percentage: bar.percentage,
      ...(bar.color?.hex && { color: colorObj(bar.color) }),
    }));
    s.height = px(det.params.height ?? 8);
    if (det.params.showPercentage) s.showPercentage = true;
  },
};

export const rating = {
  id: 'rating',
  status: 'implemented',
  label: 'Rating',
  figma: 'a row of the same star mark',
  bricks: '`rating`. rating, maxRating, gap, iconSize, iconColorFull. The icon picker is left empty',
  limits: 'The star glyph stays the Bricks default. A row of different icons is not a rating',
  mergesChildren: true,
  kind: () => 'rating',
  check(_node, det) {
    if (!det.params?.maxRating) return { ok: false, reason: 'maxRating is missing' };
    return ok;
  },
  apply(ctx, det) {
    const { s } = ctx;
    s.rating = det.params.rating;
    s.maxRating = det.params.maxRating;
    s.gap = px(det.params.gap ?? 0);
    s.iconSize = px(det.params.iconSize);
    if (det.params.color?.hex) s.iconColorFull = colorObj(det.params.color);
  },
};

export const alert = {
  id: 'alert',
  status: 'implemented',
  label: 'Alert',
  figma: 'a short tinted bar with one icon and one sentence',
  bricks: '`alert`. content is the sentence. dismissable when a close mark is drawn',
  limits: 'type is not set. info, success, warning, and danger are not guessed from the fill',
  mergesChildren: true,
  kind: () => 'alert',
  check(_node, det) {
    if (!det.params?.content) return { ok: false, reason: 'the alert has no sentence' };
    return ok;
  },
  apply(ctx, det) {
    ctx.s.content = det.params.content;
    if (det.params.dismissable) ctx.s.dismissable = true;
  },
};

export const logo = {
  id: 'logo',
  status: 'implemented',
  label: 'Logo',
  figma: 'the first picture in a short wide bar that also has links',
  bricks: '`logo`. logo, logoWidth, logoHeight',
  limits: 'logoUrl is not invented. Bricks uses the site address until the plan has a link',
  mergesChildren: true,
  kind: () => 'logo',
  check(_node, det) {
    if (!det.params?.file) return { ok: false, reason: 'the logo file is missing' };
    return ok;
  },
  apply(ctx, det) {
    const { s } = ctx;
    s.logo = { $asset: det.params.file, size: 'full' };
    s.logoWidth = px(det.params.width);
    s.logoHeight = px(det.params.height);
  },
};

export const hamburger = {
  id: 'hamburger',
  status: 'implemented',
  label: 'Hamburger',
  figma: 'three stacked lines in a small square',
  bricks: '`toggle`. The element draws the bars. This is not a switch',
  limits: 'The three drawn lines are replaced by the Bricks toggle bars',
  mergesChildren: true,
  kind: () => 'toggle',
  check() {
    return ok;
  },
  apply() {},
};

export const dropdown = {
  id: 'dropdown',
  status: 'implemented',
  label: 'Dropdown',
  figma: 'one short label, one small chevron, and a vertical list',
  bricks: '`dropdown`. text is the label. The list gets brx-dropdown-content',
  limits: 'Item URLs are # until the plan has them. The chevron stays the Bricks caret',
  kind: () => 'dropdown',
  check(_node, det) {
    if (!det.params?.text || !det.params?.list) return { ok: false, reason: 'a dropdown needs a label and a list' };
    return ok;
  },
  apply(ctx, det) {
    ctx.s.text = det.params.text;
  },
  descendants(_node, det) {
    return {
      [det.params.list]: { settings: { tag: 'ul', _hidden: { _cssClasses: 'brx-dropdown-content' } } },
    };
  },
};

export const offcanvas = {
  id: 'offcanvas',
  status: 'implemented',
  label: 'Offcanvas',
  figma: 'a tall panel against the left or right edge, with a close mark',
  bricks: '`offcanvas`. direction and width. The first child is brx-offcanvas-inner',
  limits: 'Effect stays the Bricks slide. A centered card is a popup, not this panel',
  kind: () => 'offcanvas',
  check(_node, det) {
    if (det.params?.direction !== 'left' && det.params?.direction !== 'right') return { ok: false, reason: 'direction must be left or right' };
    return ok;
  },
  apply(ctx, det) {
    ctx.s.direction = det.params.direction;
    ctx.s.width = px(det.params.width);
    ctx.s.closeOn = 'backdrop';
  },
  descendants(node) {
    const first = (node.children ?? []).find((c) => c.visible !== false);
    if (!first) return {};
    return { [first.id]: { settings: { _hidden: { _cssClasses: 'brx-offcanvas-inner' } } } };
  },
};

export const PRODUCTION = [gallery, progress, rating, alert, logo, hamburger, dropdown, offcanvas];
