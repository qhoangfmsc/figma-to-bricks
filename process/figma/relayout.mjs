// Stale boxes inside component instances.
// Figma stores the geometry of an instance's inner nodes as laid out for the MAIN component. When an instance overrides the text, hides an icon or swaps a
// size, the text node itself is updated ("Đăng ký ngay" 117×30) but the frames around it keep the old box (the default "Button" label: 99×40), and their
// x / y keep the old positions. Figma's own render uses the live layout (213×54), a browser flexbox does too, so only the numbers in tree.json were wrong.
// The live layout is a function of attributes that ARE in the tree (sizing, padding, gap, alignment, the sizes of the children), so it is recomputed here:
// bottom-up, for the auto-layout nodes inside an INSTANCE only (HUG sizes, and the x / y of every child), nothing outside an instance is touched.
// Then, top-down, the FILL children take what their parent gives them (counter axis: the parent's inner size; primary axis: an equal share of what the fixed
// siblings leave): "Main Image" FILL/FILL stored as 316×316 inside a 270×285 card is 270×285.
// Not handled (left as Figma stored it): wrap, grid, an axis on which a FILL child sits in a HUG parent, text nodes (their own box is already live).
const EPS = 0.5;
const flowOf = (n) => (n.children ?? []).filter((c) => c.visible !== false && c.place !== 'ABSOLUTE');

function shift(n, dx, dy) {
  n.box.absX += dx; n.box.absY += dy;
  for (const c of n.children ?? []) shift(c, dx, dy);
}

function place(c, x, y) {
  const dx = x - c.box.x, dy = y - c.box.y;
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return false; // a stored position within half a pixel is Figma's own rounding
  c.box.x = x; c.box.y = y;
  shift(c, dx, dy);
  return true;
}

function layoutOne(n, force = false) {
  const L = n.layout;
  if (!L || L.wrap || L.mode === 'GRID' || (L.mode !== 'HORIZONTAL' && L.mode !== 'VERTICAL')) return;
  const kids = flowOf(n);
  if (!kids.length) return;
  const horiz = L.mode === 'HORIZONTAL';
  const P = horiz ? 'w' : 'h', C = horiz ? 'h' : 'w';                  // primary / counter size keys
  const sk = (axisKey) => (axisKey === 'w' ? 'h' : 'v');               // sizing.h is the horizontal axis, sizing.v the vertical one
  const padP = horiz ? L.padding.left + L.padding.right : L.padding.top + L.padding.bottom;
  const padC = horiz ? L.padding.top + L.padding.bottom : L.padding.left + L.padding.right;
  const startP = horiz ? L.padding.left : L.padding.top, startC = horiz ? L.padding.top : L.padding.left;
  const fillOn = (axisKey) => kids.some((c) => c.sizing?.[sk(axisKey)] === 'FILL');

  let changed = false;
  // a hugging node is as big as its content, but never outside its own min / max (the period-bar items: stored 122, minWidth 150)
  const clamp = (axisKey, v) => {
    const lo = n.limits?.[axisKey === 'w' ? 'minWidth' : 'minHeight'], hi = n.limits?.[axisKey === 'w' ? 'maxWidth' : 'maxHeight'];
    return Math.min(hi ?? Infinity, Math.max(lo ?? 0, v));
  };
  const total = clamp(P, kids.reduce((a, c) => a + c.box[P], 0) + L.gap * (kids.length - 1) + padP);
  const maxC = clamp(C, Math.max(...kids.map((c) => c.box[C])) + padC);
  if (n.sizing?.[sk(P)] === 'HUG' && !fillOn(P) && Math.abs(n.box[P] - total) > EPS) { n.box[P] = total; changed = true; }
  if (n.sizing?.[sk(C)] === 'HUG' && !fillOn(C) && Math.abs(n.box[C] - maxC) > EPS) { n.box[C] = maxC; changed = true; }

  // positions of the children inside the (new) box
  const sum = kids.reduce((a, c) => a + c.box[P], 0);
  const innerP = n.box[P] - padP, innerC = n.box[C] - padC;
  let gap = L.gap, off = 0;
  if (L.primaryAlign === 'SPACE_BETWEEN' && kids.length > 1) gap = (innerP - sum) / (kids.length - 1);
  else if (L.primaryAlign === 'CENTER') off = (innerP - (sum + gap * (kids.length - 1))) / 2;
  else if (L.primaryAlign === 'MAX') off = innerP - (sum + gap * (kids.length - 1));
  let cur = startP + off, moved = false;
  for (const c of kids) {
    let cc = startC;
    if (L.counterAlign === 'CENTER') cc = startC + (innerC - c.box[C]) / 2;
    else if (L.counterAlign === 'MAX') cc = startC + innerC - c.box[C];
    const [x, y] = horiz ? [cur, cc] : [cc, cur];
    if (place(c, x, y)) moved = true;
    cur += c.box[P] + gap;
  }
  if (changed || moved) n.__relaid = true;
}

// FILL children of a node whose own size is final; returns true when a child changed size
function resolveFill(n) {
  const L = n.layout;
  if (!L || L.wrap || L.mode === 'GRID' || (L.mode !== 'HORIZONTAL' && L.mode !== 'VERTICAL')) return;
  const kids = flowOf(n);
  const horiz = L.mode === 'HORIZONTAL';
  const P = horiz ? 'w' : 'h', C = horiz ? 'h' : 'w';
  const sk = (axisKey) => (axisKey === 'w' ? 'h' : 'v');
  const padP = horiz ? L.padding.left + L.padding.right : L.padding.top + L.padding.bottom;
  const padC = horiz ? L.padding.top + L.padding.bottom : L.padding.left + L.padding.right;
  let changed = false;
  for (const c of kids) {
    if (c.type === 'TEXT' || c.sizing?.[sk(C)] !== 'FILL') continue;
    const want = n.box[C] - padC;
    if (Math.abs(c.box[C] - want) > EPS) { c.box[C] = want; c.__resized = true; changed = true; }
  }
  const fills = kids.filter((c) => c.sizing?.[sk(P)] === 'FILL');
  if (fills.length && !fills.some((c) => c.type === 'TEXT') && n.sizing?.[sk(P)] !== 'HUG') {
    const fixed = kids.filter((c) => !fills.includes(c)).reduce((a, c) => a + c.box[P], 0);
    // SPACE_BETWEEN leaves no free space once a child fills it, and Figma then ignores itemSpacing (it stays stored, stale: faq row 124)
    const gap = L.primaryAlign === 'SPACE_BETWEEN' ? 0 : L.gap;
    const share = (n.box[P] - padP - fixed - gap * (kids.length - 1)) / fills.length;
    if (share >= 0) for (const c of fills) if (Math.abs(c.box[P] - share) > EPS) { c.box[P] = share; c.__resized = true; changed = true; }
  }
  if (changed) layoutOne(n, true);
}

function fillWalk(n, inside) {
  const inst = inside || n.type === 'INSTANCE';
  if (inst) resolveFill(n);
  // this node was resized by its parent's FILL a moment ago: its children were placed for the old size (stored for another breakpoint), place them again
  if (inst && n.__resized) { layoutOne(n, true); delete n.__resized; }
  for (const c of n.children ?? []) fillWalk(c, inst);
}

function walk(n, inside) {
  const inst = inside || n.type === 'INSTANCE';
  for (const c of n.children ?? []) walk(c, inst);
  if (inst) layoutOne(n);
}

// returns the number of nodes whose box was recomputed (for the report)
export function relayoutInstances(root) {
  walk(root, false);
  fillWalk(root, false);
  let n = 0;
  (function clean(x) { if (x.__relaid) { n++; delete x.__relaid; } delete x.__resized; (x.children ?? []).forEach(clean); })(root);
  return n;
}
