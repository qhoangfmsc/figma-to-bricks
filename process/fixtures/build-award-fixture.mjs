// Builds fixtures/award/ : a SYNTHETIC copy of Figma node 1586:393 (Pagepeed-Landingapge / "Award"),
// shaped like the REST API (/v1/files/:key/nodes) and reproducing the values reported by Figma's
// get_design_context for that node. It exists so the offline steps (02-05) can be tested without a token.
// Real runs never use it: 01-fetch pulls the true raw JSON.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const OUT = fileURLToPath(new URL('./award/', import.meta.url));
const UPLOADS = fileURLToPath(new URL('../../wp-content/uploads/2026/10/', import.meta.url));
mkdirSync(join(OUT, 'images'), { recursive: true });
mkdirSync(join(OUT, 'svg'), { recursive: true });

const INK = { r: 0x28 / 255, g: 0x28 / 255, b: 0x29 / 255, a: 1 };
const solid = (c, opacity) => ({ type: 'SOLID', visible: true, opacity, blendMode: 'NORMAL', color: c });
const noise = { scrollBehavior: 'SCROLLS', interactions: [], exportSettings: [] };

// node(spec, parentAbs): spec.box is parent-relative {x,y,w,h}
function node(spec, parentAbs) {
  const { box, children = [], ...rest } = spec;
  const abs = { x: parentAbs.x + box.x, y: parentAbs.y + box.y, width: box.w, height: box.h };
  return { ...rest, ...noise, absoluteBoundingBox: abs, absoluteRenderBounds: abs, children: children.map((c) => node(c, abs)) };
}

const auto = (mode, extra) => ({ layoutMode: mode, primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED', itemSpacing: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN', ...extra });
const textStyle = (size, line, weight, styleName, extra = {}) => ({
  fontFamily: 'Inter', fontPostScriptName: `Inter-${styleName}`, fontStyle: styleName, fontWeight: weight, fontSize: size, lineHeightPx: line,
  lineHeightPercentFontSize: (line / size) * 100, lineHeightUnit: 'PIXELS', letterSpacing: 0, textAlignHorizontal: 'CENTER', textAlignVertical: 'TOP', textAutoResize: 'HEIGHT', ...extra,
});

// NOTE: line counts below are what Inter 16px actually wraps to in a 188px box (verified in Chrome). The real file may differ;
// the live fetch (01-fetch) is the only source of truth.
// ---- image assets (original 16:9 sources already downloaded from Figma during the first manual run)
const IMG = {
  trophy1: ['award-top10-brand-2023.png', 'ref0000000000000000000000000000000000trophy1'],
  cert1: ['award-iso-security-raw.jpg', 'ref0000000000000000000000000000000000cert001'],
  trophy2: ['award-top10-digital-economy.png', 'ref0000000000000000000000000000000000trophy2'],
  cert2: ['award-iso-quality.png', 'ref0000000000000000000000000000000000cert002'],
  trophy3: ['award-top5-brand.png', 'ref0000000000000000000000000000000000trophy3'],
};
for (const [file, ref] of Object.values(IMG)) copyFileSync(join(UPLOADS, file), join(OUT, 'images', `${ref}.${file.split('.').pop()}`));
const imgFill = (key, scaleMode, imageTransform) => ({ type: 'IMAGE', visible: true, opacity: 1, blendMode: 'NORMAL', scaleMode, imageRef: IMG[key][1], ...(imageTransform && { imageTransform }) });

const TALLEST = 2; // lines in the tallest card title
const CARD_H = 125 + 16 + TALLEST * 24;
const card = (idBase, x, w, imgSpec, text, textLines, stretch) => ({
  id: `I1586:402;${idBase}`, name: `_award-card ${idBase}`, type: 'FRAME', box: { x, y: 0, w: 212, h: CARD_H },
  ...auto('VERTICAL', { counterAxisAlignItems: 'CENTER', paddingLeft: 12, paddingRight: 12 }),
  layoutSizingHorizontal: 'FILL', layoutSizingVertical: stretch ? 'FILL' : 'HUG', layoutGrow: 1, ...(stretch && { layoutAlign: 'STRETCH' }),
  cornerRadius: 12, clipsContent: true, fills: [], strokes: [], effects: [],
  children: [
    { ...imgSpec, box: { x: (212 - imgSpec.box.w) / 2, y: 0, w: imgSpec.box.w, h: 125 } },
    {
      id: `I1586:402;${idBase}:title`, name: 'Title', type: 'FRAME', box: { x: 12, y: 125, w: 188, h: 16 + textLines * 24 },
      ...auto('HORIZONTAL', { primaryAxisAlignItems: 'CENTER', paddingTop: 16 }),
      layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', fills: [], clipsContent: false,
      children: [{
        id: `I1586:402;${idBase}:text`, name: text.split('\n')[0], type: 'TEXT', box: { x: 0, y: 16, w: 188, h: textLines * 24 },
        characters: text, fills: [solid(INK)], layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', layoutGrow: 1,
        style: textStyle(16, 24, 400, 'Regular'), styles: { text: 'S:body' },
      }],
    },
  ],
});
const picture = (id, w, fill) => ({ id, name: `img ${id}`, type: 'RECTANGLE', box: { w }, fills: [fill], strokes: [], effects: [], layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED' });

const dash = (i, w) => ({
  id: `I1586:403;dash${i}`, name: `Pagination Item Dash 0${i}`, type: 'FRAME', box: { x: 0, y: 0, w, h: 4 }, layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', clipsContent: true, fills: [],
  children: [{ id: `I1586:403;dash${i}:v`, name: 'Vector 2 (Stroke)', type: 'VECTOR', box: { x: 0, y: 0, w, h: 4 }, fills: [solid(INK, i === 4 ? 1 : 0.24)], strokes: [] }],
});
const widths = [20, 20, 20, 32, 20, 20, 20];
let dx = 0;
const dashes = widths.map((w, i) => { const d = dash(i + 1, w); d.box.x = dx; dx += w + 8; return d; });

const root = {
  id: '1586:393', name: 'Award', type: 'FRAME', box: { x: 0, y: 572, w: 1440, h: 48 + 88 + CARD_H + 24 + 4 + 48 },
  ...auto('VERTICAL', { counterAxisAlignItems: 'CENTER', paddingTop: 48, paddingBottom: 48 }),
  primaryAxisSizingMode: 'AUTO', layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'HUG',
  fills: [solid({ r: 1, g: 1, b: 1, a: 1 })], strokes: [], effects: [], clipsContent: true,
  children: [
    {
      id: '1586:394', name: '_Title', type: 'FRAME', box: { x: 150, y: 48, w: 1140, h: 88 },
      ...auto('VERTICAL', { counterAxisAlignItems: 'CENTER', paddingBottom: 40 }), primaryAxisSizingMode: 'AUTO',
      layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'HUG', fills: [], clipsContent: false,
      children: [
        {
          id: '1586:395', name: 'Content Item/Header', type: 'FRAME', box: { x: 0, y: 0, w: 1140, h: 48 },
          ...auto('VERTICAL', { primaryAxisAlignItems: 'CENTER' }), primaryAxisSizingMode: 'AUTO', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', fills: [],
          children: [
            { id: '1586:396', name: 'Pading Top', type: 'FRAME', visible: false, box: { x: 0, y: 0, w: 250, h: 24 }, fills: [], children: [] },
            {
              id: '1586:398', name: 'Heading text', type: 'TEXT', box: { x: 0, y: 0, w: 1140, h: 48 },
              characters: 'GIẢI THƯỞNG VÀ DANH  HIỆU VIETNIX ĐÃ ĐẠT ĐƯỢC', fills: [solid(INK)],
              layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', style: textStyle(36, 48, 700, 'Bold'), styles: { text: 'S:h4' },
              boundVariables: { fills: [{ type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' }] },
            },
            { id: '1586:399', name: 'Padding Bottom', type: 'FRAME', visible: false, box: { x: 0, y: 32, w: 250, h: 12 }, fills: [], children: [] },
          ],
        },
        { id: '1586:401', name: 'Content Item/Paragraph', type: 'INSTANCE', componentId: 'C:para', visible: false, box: { x: 0, y: 64, w: 1200, h: 140 }, fills: [], children: [] },
      ],
    },
    {
      id: '1586:402', name: 'award-vnx', type: 'INSTANCE', componentId: 'C:award', box: { x: 150, y: 136, w: 1140, h: CARD_H + 24 },
      ...auto('HORIZONTAL', { itemSpacing: 20, paddingBottom: 24 }), primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'AUTO',
      layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'HUG', fills: [], clipsContent: false,
      children: [
        card('c1', 0, 61.141, picture('I1586:402;1095:30399', 61.141, imgFill('trophy1', 'FILL')), 'Top 10 Thương hiệu hàng đầu Việt Nam 2023', 2, false),
        card('c2', 232, 89.592, picture('I1586:402;1095:30407', 89.592, imgFill('cert1', 'CROP', [[0.34, 0, 0.5944], [0, 0.8433, 0.0722]])), 'Chứng Nhận Bảo Mật', 1, true),
        card('c3', 464, 61.141, picture('I1586:402;1095:30395', 61.141, imgFill('trophy2', 'FILL')), 'Top 10 Thương hiệu uy tín thời đại kinh tế số', 2, true),
        card('c4', 696, 89.592, picture('I1586:402;1373:58', 89.592, imgFill('cert2', 'FILL')), 'Chứng Nhận Chất Lượng', 1, true),
        card('c5', 928, 61.141, picture('I1586:402;1095:30403', 61.141, imgFill('trophy3', 'FILL')), 'Top 5\nThương Hiệu Uy Tín', 2, true),
      ],
    },
    {
      id: '1586:403', name: 'Pagination', type: 'INSTANCE', componentId: 'C:pagination', box: { x: 620, y: 136 + CARD_H + 24, w: 200, h: 4 },
      ...auto('HORIZONTAL', { itemSpacing: 8 }), primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO',
      layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG', fills: [], children: dashes,
    },
  ],
};

const raw = {
  name: 'Pagepeed-Landingapge (fixture)', version: 'fixture', lastModified: '2026-10-26T00:00:00Z',
  nodes: {
    '1586:393': {
      document: node(root, { x: 0, y: 572 - 572 }),
      components: { 'C:para': { name: 'Content Item/Paragraph' }, 'C:award': { name: 'award-vnx' }, 'C:pagination': { name: 'Pagination' } },
      styles: { 'S:h4': { name: 'H4/Bold', styleType: 'TEXT' }, 'S:body': { name: 'Body-text-lg/Regular', styleType: 'TEXT' } },
    },
  },
};
// root keeps its real canvas position
raw.nodes['1586:393'].document = node(root, { x: 0, y: 0 });
writeFileSync(join(OUT, 'raw.json'), JSON.stringify(raw, null, 2) + '\n');

// pagination SVG as Figma would render it (200x4, seven rounded dashes)
let x = 0;
const rects = widths.map((w, i) => { const r = `<rect x="${x}" y="0" width="${w}" height="4" rx="2" fill="#282829"${i === 3 ? '' : ' fill-opacity="0.24"'}/>`; x += w + 8; return r; }).join('');
writeFileSync(join(OUT, 'svg', '1586_403.svg'), `<svg width="200" height="4" viewBox="0 0 200 4" fill="none" xmlns="http://www.w3.org/2000/svg">${rects}</svg>\n`);
console.log('fixture written to', OUT);
