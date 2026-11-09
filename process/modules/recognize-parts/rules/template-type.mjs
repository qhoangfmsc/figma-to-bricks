// Which Bricks template type this frame is. Stored value is the key in Setup::get_control_options('templateTypes')
// (includes/setup.php): header, footer, content (the UI says Single), section, popup, archive, search, error.
// section is the default. A name is only a hint. A low-confidence guess stays section until the plan says otherwise.
// Popup cases are structural: a dim full-frame backdrop with a centered card, a dim fill on the frame itself
// with a centered card, a close mark on a dialog (the mark may sit inside the card), a picture plus a close mark,
// or a small newsletter card that also has a close mark.
import { centeredCard, covers, dimFill, hasClose, textsOf, visibleKids } from './shape.mjs';

export const TEMPLATE_TYPES = ['header', 'footer', 'content', 'section', 'popup', 'archive', 'search', 'error'];

const ALIAS = {
  single: 'content',
  'search results': 'search',
  'error page': 'error',
  404: 'error',
};

const rank = { high: 3, medium: 2, low: 1 };

const kids = visibleKids;
const fold = (s) => String(s ?? '').trim().toLowerCase();

export function normalizeTemplateType(value) {
  const raw = fold(value).replace(/\s+/g, ' ');
  const key = ALIAS[raw] ?? raw;
  return TEMPLATE_TYPES.includes(key) ? key : '';
}

function nameHint(n, re) {
  return re.test(n?.name ?? '') || re.test(n?.componentSet ?? '') || re.test(n?.component ?? '');
}

function linkTexts(n) {
  const out = [];
  for (const c of kids(n)) {
    if (c.type === 'TEXT' && c.text?.characters?.trim() && c.text.characters.trim().length <= 32) out.push(c);
    else if (c.type !== 'TEXT') {
      const inner = textsOf(c);
      const filled = (c.fills ?? []).some((f) => f.type === 'SOLID' && (f.alpha ?? 1) > 0.9);
      if (inner.length === 1 && inner[0].text.characters.trim().length <= 32 && !filled) out.push(inner[0]);
    }
  }
  return out;
}

function popupCases(tree) {
  const cases = [];
  const direct = kids(tree);
  const scrim = direct.find((c) => covers(c, tree) && dimFill(c));
  const card = direct.find((c) => c !== scrim && centeredCard(c, tree));
  if (scrim && card) {
    cases.push({ type: 'popup', confidence: 'high', id: 'backdrop-card', reason: 'Có lớp phủ mờ kín khung và một thẻ nằm giữa. Đây là popup.' });
  }
  if (dimFill(tree) && direct.some((c) => centeredCard(c, tree))) {
    cases.push({ type: 'popup', confidence: 'high', id: 'root-dim-card', reason: 'Khung gốc phủ mờ và một thẻ nằm giữa. Đây là popup.' });
  }
  if (hasClose(tree) && (tree.box?.w ?? 0) <= 800 && (tree.box?.h ?? 0) >= 160) {
    cases.push({ type: 'popup', confidence: 'high', id: 'close-on-frame', reason: 'Khung có nút đóng ở góc và không phải một dải header. Đây là popup.' });
  }
  for (const c of direct) {
    if (!hasClose(c)) continue;
    if (centeredCard(c, tree) || scrim) {
      cases.push({ type: 'popup', confidence: 'high', id: 'close-on-card', reason: 'Một thẻ nhỏ hơn khung có nút đóng ở góc. Đây là popup.' });
    }
  }
  const picture = direct.find((c) => (c.fills ?? []).some((f) => f.type === 'IMAGE') && covers(c, tree));
  if (picture && hasClose(tree)) {
    cases.push({ type: 'popup', confidence: 'high', id: 'lightbox', reason: 'Một ảnh gần kín khung và một nút đóng. Đây là popup.' });
  }
  const narrow = (tree.box?.w ?? 0) > 0 && tree.box.w <= 640;
  const email = textsOf(tree).some((t) => /e-?mail|newsletter/i.test(t.text.characters));
  if (narrow && email && hasClose(tree)) {
    cases.push({ type: 'popup', confidence: 'high', id: 'newsletter-close', reason: 'Khung hẹp, có chữ email và nút đóng. Đây là popup.' });
  }
  if (nameHint(tree, /\b(popup|modal|dialog|overlay|lightbox)\b/i) && !cases.length) {
    cases.push({ type: 'popup', confidence: 'low', id: 'name-only', reason: 'Tên lớp gợi popup nhưng chưa thấy lớp phủ, thẻ giữa hay nút đóng.' });
  }
  return cases;
}

function headerCase(tree) {
  const h = tree.box?.h ?? 0;
  const w = tree.box?.w ?? 0;
  if (h < 40 || h > 140 || w < 320) {
    if (nameHint(tree, /\b(header|navbar)\b/i)) return { type: 'header', confidence: 'low', id: 'name-only', reason: 'Tên lớp gợi header nhưng khung không phải một thanh ngang ngắn.' };
    return null;
  }
  const links = linkTexts(tree);
  if (links.length >= 3 || (links.length >= 1 && nameHint(tree, /\b(header|navbar|nav)\b/i))) {
    return { type: 'header', confidence: 'high', id: 'top-bar', reason: `Thanh ngang cao ${Math.round(h)}px với các mục chữ. Đây là header.` };
  }
  if (nameHint(tree, /\b(header|navbar)\b/i)) return { type: 'header', confidence: 'medium', id: 'named-bar', reason: 'Thanh ngang ngắn và tên lớp gợi header.' };
  return null;
}

function footerCase(tree) {
  const h = tree.box?.h ?? 0;
  const copy = textsOf(tree).find((t) => /©|copyright|all rights reserved|bản quyền/i.test(t.text.characters));
  if (copy && h > 140) return { type: 'footer', confidence: 'high', id: 'copyright', reason: 'Có dòng bản quyền trong một khung cao hơn header. Đây là footer.' };
  const columns = kids(tree).filter((c) => textsOf(c).length >= 2);
  if (columns.length >= 2 && h >= 180 && nameHint(tree, /\bfooter\b/i)) {
    return { type: 'footer', confidence: 'high', id: 'link-columns', reason: 'Nhiều cột link và tên lớp gợi footer. Đây là footer.' };
  }
  if (columns.length >= 2 && h >= 180) return { type: 'footer', confidence: 'medium', id: 'link-columns', reason: 'Nhiều cột link ở một khung cao. Có thể là footer.' };
  if (nameHint(tree, /\bfooter\b/i)) return { type: 'footer', confidence: 'low', id: 'name-only', reason: 'Tên lớp gợi footer nhưng chưa thấy bản quyền hay cột link.' };
  return null;
}

function pageCases(tree) {
  const cases = [];
  const big404 = textsOf(tree).find((t) => /^(404|page not found|không tìm thấy trang)$/i.test(t.text.characters.trim()) && ((t.text.fontSize ?? 0) >= 32 || (t.box?.h ?? 0) >= 48));
  if (big404) cases.push({ type: 'error', confidence: 'high', id: 'error-title', reason: 'Có tiêu đề 404 hoặc không tìm thấy trang. Đây là error page.' });
  else if (nameHint(tree, /\b(404|error)\b/i)) cases.push({ type: 'error', confidence: 'low', id: 'name-only', reason: 'Tên lớp gợi trang lỗi nhưng chưa thấy tiêu đề 404.' });
  const searchWord = textsOf(tree).some((t) => /search|tìm kiếm/i.test(t.text.characters));
  if (searchWord && nameHint(tree, /\bsearch\b/i)) cases.push({ type: 'search', confidence: 'medium', id: 'search-field', reason: 'Có chữ tìm kiếm và tên lớp gợi trang kết quả tìm kiếm.' });
  else if (nameHint(tree, /\bsearch results?\b/i)) cases.push({ type: 'search', confidence: 'low', id: 'name-only', reason: 'Tên lớp gợi search results nhưng chưa thấy ô tìm kiếm.' });
  const cards = kids(tree).filter((c) => (c.box?.h ?? 0) >= 80);
  if (cards.length >= 3 && nameHint(tree, /\b(archive|blog|listing)\b/i)) {
    cases.push({ type: 'archive', confidence: 'medium', id: 'card-list', reason: 'Nhiều thẻ lặp và tên lớp gợi archive.' });
  } else if (nameHint(tree, /\barchive\b/i)) {
    cases.push({ type: 'archive', confidence: 'low', id: 'name-only', reason: 'Tên lớp gợi archive nhưng chưa thấy danh sách thẻ.' });
  }
  if (nameHint(tree, /\b(single|article)\b/i)) {
    cases.push({ type: 'content', confidence: 'low', id: 'name-only', reason: 'Tên lớp gợi Single. Một section cũng có thể trông như vậy, nên giữ section nếu chưa chắc.' });
  }
  return cases;
}

export function detectTemplateType(tree) {
  const cases = [...popupCases(tree), headerCase(tree), footerCase(tree), ...pageCases(tree)].filter(Boolean);
  const ranked = [...cases].sort((a, b) => rank[b.confidence] - rank[a.confidence]);
  const top = ranked[0];
  if (!top) {
    return { type: 'section', confidence: 'high', reason: 'Không thấy header, footer, popup, archive, search hay error. Giữ section.', cases };
  }
  const clash = ranked.filter((c) => c.confidence === top.confidence && c.type !== top.type);
  if (clash.length) {
    const names = [top.type, ...new Set(clash.map((c) => c.type))].join(', ');
    return { type: 'section', confidence: 'low', reason: `Thấy cùng lúc ${names}. Giữ section cho đến khi chọn một loại.`, cases };
  }
  if (top.confidence === 'low') {
    return { type: 'section', confidence: 'low', reason: `Đoán ${top.type}: ${top.reason} Chưa đủ chắc, giữ section.`, cases };
  }
  return { type: top.type, confidence: top.confidence, reason: top.reason, cases };
}
