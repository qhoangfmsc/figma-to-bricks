// tree.json -> tree.md : the human-readable twin of the tree. Every value that the build uses is printed here.
const n = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000));
const paintStr = (p) => {
  if (p.type === 'SOLID') return `${p.hex}${p.alpha !== 1 ? ` @${p.alpha}` : ''}`;
  if (p.type === 'IMAGE') return `IMAGE ${p.scaleMode} ref=${p.imageRef}${p.asset ? ` (${p.asset.width ?? '?'}x${p.asset.height ?? '?'} ${p.asset.file})` : ''}${p.imageTransform ? ` transform=${JSON.stringify(p.imageTransform)}` : ''}`;
  if (p.type?.startsWith('GRADIENT')) return `${p.type} ${p.stops.map((s) => `${s.hex}@${s.position}`).join(' > ')}`;
  return p.type;
};

export function nodeLines(node, depth = 0) {
  const ind = '  '.repeat(depth);
  const pad = `${ind}    `;
  const L = [];
  const head = `${ind}- ${node.type} "${node.name}" [${node.id}]  ${n(node.box.w)}×${n(node.box.h)}  @${n(node.box.x)},${n(node.box.y)}${node.visible === false ? '  (HIDDEN: not built)' : ''}`;
  L.push(head);
  const add = (label, text) => L.push(`${pad}· ${label.padEnd(7)} ${text}`);

  if (node.component) add('comp', `${node.componentSet ? node.componentSet + ' › ' : ''}${node.component}`);
  if (node.props) add('props', Object.entries(node.props).map(([k, v]) => `${k}=${v}`).join('  '));
  if (node.interactions) add('proto', node.interactions.map((i) => `${i.trigger} → ${i.action}${i.navigation ? ' ' + i.navigation : ''}${i.dest ? ' ' + i.dest : ''}${i.url ? ' ' + i.url : ''}`).join('; '));
  if (node.styleRefs) add('styles', Object.entries(node.styleRefs).map(([k, v]) => `${k}=${v}`).join('  '));
  add('size', `w ${node.sizing.h}  h ${node.sizing.v}${node.limits ? '  ' + Object.entries(node.limits).map(([k, v]) => `${k}=${n(v)}`).join(' ') : ''}`);
  if (node.layout) {
    const l = node.layout;
    add('layout', `${l.mode}${l.wrap ? ' WRAP' : ''}  gap ${n(l.gap)}${l.counterGap != null ? `/${n(l.counterGap)}` : ''}  pad T${n(l.padding.top)} R${n(l.padding.right)} B${n(l.padding.bottom)} L${n(l.padding.left)}  primary ${l.primaryAlign}  counter ${l.counterAlign}`);
  }
  if (node.place) add('place', `${node.place}${node.selfAlign ? ` selfAlign=${node.selfAlign}` : ''}${node.grow ? ` grow=${node.grow}` : ''}${node.constraints ? ` constraints=${node.constraints.horizontal}/${node.constraints.vertical}` : ''}`);
  if (node.rotation) add('rotate', n(node.rotation));
  if (node.fills) add('fill', node.fills.map(paintStr).join(' | '));
  if (node.stroke) {
    const s = node.stroke;
    add('stroke', `${s.paints.map(paintStr).join(' | ')}  weight ${s.weights ? `T${n(s.weights.top)} R${n(s.weights.right)} B${n(s.weights.bottom)} L${n(s.weights.left)}` : n(s.weight)}  align ${s.align}${s.dashes ? ` dashes=${s.dashes}` : ''}`);
  }
  if (node.radius) add('radius', `TL${n(node.radius[0])} TR${n(node.radius[1])} BR${n(node.radius[2])} BL${n(node.radius[3])}`);
  if (node.effects) add('effect', node.effects.map((e) => (e.hex ? `${e.type} ${e.hex}@${e.alpha} x${n(e.x)} y${n(e.y)} blur${n(e.blur)} spread${n(e.spread)}` : `${e.type} ${n(e.radius)}`)).join(' | '));
  if (node.opacity != null) add('opacity', n(node.opacity));
  if (node.clip) add('clip', 'true');
  if (node.blendMode) add('blend', node.blendMode);
  if (node.isMask) add('mask', 'true');
  if (node.text) {
    const t = node.text;
    add('text', JSON.stringify(t.characters));
    add('font', `${t.fontFamily} ${t.fontStyle} (w${t.fontWeight}${t.italic ? ' italic' : ''})  ${n(t.fontSize)}px  line ${n(t.lineHeightPx)}px  letter ${n(t.letterSpacing)}px  align ${t.align}/${t.valign}  case ${t.case}  deco ${t.decoration}  resize ${t.autoResize}`);
    if (t.runs) t.runs.forEach((r, i) => add(`run${i}`, `${JSON.stringify(r.text)}${r.style ? ' ' + JSON.stringify(r.style) : ''}`));
  }
  if (node.svg) add('svg', `${node.svg.file} (replaces ${node.svgOfChildren ?? 0} child nodes)`);
  if (node.variables) add('vars', Object.keys(node.variables).join(','));
  if (node.unhandled) add('!UNHANDLED', node.unhandled.join(', '));
  for (const c of node.children ?? []) L.push(...nodeLines(c, depth + 1));
  return L;
}

export function stats(root) {
  const s = { nodes: 0, hidden: 0, text: 0, images: 0, svgs: 0, unhandled: new Set(), fonts: new Set() };
  (function rec(x) {
    s.nodes++;
    if (x.visible === false) s.hidden++;
    if (x.text && !x.svg) { s.text++; s.fonts.add(`${x.text.fontFamily} ${x.text.fontStyle}`); }
    if (x.fills?.some((f) => f.type === 'IMAGE')) s.images++;
    if (x.svg) s.svgs++;
    x.unhandled?.forEach((u) => s.unhandled.add(u));
    x.children?.forEach(rec);
  })(root);
  return s;
}

export function renderTreeMd(root, meta) {
  const s = stats(root);
  return [
    `# Figma tree: ${root.name} [${root.id}]`,
    '',
    `Source: ${meta.fileName ?? ''} (${meta.fileKey ?? ''}) · version ${meta.version ?? '?'} · fetched from raw.json`,
    `Nodes ${s.nodes} (hidden ${s.hidden}) · text ${s.text} · image fills ${s.images} · svg ${s.svgs}`,
    `Fonts: ${[...s.fonts].join(', ') || '-'}`,
    s.unhandled.size ? `**Unhandled raw keys: ${[...s.unhandled].join(', ')}**` : 'Unhandled raw keys: none',
    '',
    'Coordinates are relative to the parent node. `w/h` sizing: FIXED = px value, HUG = fit content, FILL = fill parent.',
    '',
    ...nodeLines(root),
    '',
  ].join('\n');
}
