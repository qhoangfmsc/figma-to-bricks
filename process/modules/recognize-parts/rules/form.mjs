// Candidate forms: a container with a button-like child (the submit) and two or more fields.
// A field is either an input-like frame itself, or a row that holds one: a label, a filled box (placeholder text plus icon instances) and a helper line.
// Consent rows (a small checkbox + a statement) between them become checkbox fields.
// Params for components/form.mjs: fields [{ node, type, label, placeholder, required }] in drawing order, submit (node id). Types are inferred from
// the visible text only (e-mail / phone words). Submit stores the entry (save-submission). The form name is filled at build from the Figma file, the section and this frame.
const HOLDERS = new Set(['FRAME', 'INSTANCE', 'COMPONENT']);
const BUTTON = /\b(button|btn|cta)\b/i;
const kidsOf = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const textsOf = (n, out = []) => { if (n.visible === false) return out; if (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim()) out.push(n); kidsOf(n).forEach((c) => textsOf(c, out)); return out; };
const hasSvg = (n) => n.visible !== false && (!!n.svg || kidsOf(n).some(hasSvg));
const has = (n, re) => re.test(n.name ?? '') || kidsOf(n).some((c) => has(c, re));

export const isInputLike = (n) => {
  if (!HOLDERS.has(n.type) || n.visible === false || !n.fills?.some((f) => f.type === 'SOLID')) return false;
  if (n.box.h < 28 || n.box.h > 140 || n.box.w < 120) return false;
  const kids = kidsOf(n);
  const texts = kids.filter((k) => k.type === 'TEXT' && !k.svg);
  // icon instances sit in the same box as the placeholder and hold no text of their own
  return texts.length === 1 && kids.every((k) => k === texts[0] || hasSvg(k) || textsOf(k).length === 0) && texts[0].text.characters.length <= 120;
};
export const isButtonLike = (n) => {
  if (!HOLDERS.has(n.type) || n.visible === false || textsOf(n).length !== 1) return false;
  if (BUTTON.test(n.name ?? '') || BUTTON.test(n.componentSet ?? n.component ?? '')) return true;
  const kids = kidsOf(n);
  const texts = kids.filter((k) => k.type === 'TEXT' && !k.svg);
  const icons = kids.filter((k) => texts[0] && k !== texts[0] && hasSvg(k));
  const oneLabel = texts.length === 1 && kids.length === 1 + icons.length && icons.length <= 1;
  const h = n.box?.h ?? 0;
  // a consent row has a checkbox beside the sentence; a filled placeholder is a field
  return oneLabel && h >= 32 && h <= 72 && !isInputLike(n);
};
export const isConsent = (n) => HOLDERS.has(n.type) && n.visible !== false && n.box.h <= 140 && has(n, /check\s?box|consent/i) && textsOf(n).length >= 1;

function fieldType(text, node, textNode) {
  if (/e-?mail/i.test(text)) return 'email';
  if (/điện thoại|dien thoai|phone|zalo|\btel\b|sđt/i.test(text)) return 'tel';
  if (/select|dropdown|combo|\bchọn\b/i.test(`${node.name ?? ''} ${node.component ?? ''}`)) return 'select';
  if (/\bradio\b/i.test(`${node.name ?? ''} ${node.component ?? ''}`)) return 'radio';
  if (/datepicker|calendar|\bdate\b|ngày sinh|ngay sinh/i.test(`${text} ${node.name ?? ''}`)) return 'datepicker';
  // a placeholder Figma wraps over two or more lines needs a multi-line control (an input shows one line)
  const lines = textNode?.text?.lineHeightPx ? Math.round(textNode.box.h / textNode.text.lineHeightPx) : 1;
  if (/lời nhắn|nội dung|ghi chú|message|comment/i.test(text) || node.box.h > 100 || lines >= 2) return 'textarea';
  return 'text';
}

const containsId = (n, id) => n.id === id || kidsOf(n).some((c) => containsId(c, id));

function inputBoxes(n) {
  const boxes = [];
  (function walk(x) {
    if (x !== n && isInputLike(x)) { boxes.push(x); return; }
    kidsOf(x).forEach(walk);
  })(n);
  return boxes;
}

function labelFor(wrap, box) {
  const outside = textsOf(wrap).filter((t) => !containsId(box, t.id) && t.text.characters.trim() !== '*');
  return outside.find((t) => /label/i.test(t.name ?? ''))
    ?? outside.find((t) => !/helper/i.test(t.name ?? '') && (t.box?.y ?? 0) <= (box.box?.y ?? Infinity));
}

function fieldFromBox(box, wrap) {
  const raw = textsOf(box)[0].text.characters.trim().replace(/\s+/g, ' ');
  const labelNode = wrap && wrap !== box ? labelFor(wrap, box) : null;
  const label = labelNode ? labelNode.text.characters.trim().replace(/\s+/g, ' ') : '';
  const starred = textsOf(wrap ?? box).some((t) => t.text.characters.trim() === '*');
  return {
    node: box.id,
    type: fieldType(`${label} ${raw}`, box, textsOf(box)[0]),
    ...(label && { label, labelNode: labelNode.id }),
    placeholder: raw,
    required: /\*/.test(`${label} ${raw}`) || starred,
  };
}

export function detectForms(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    const kids = kidsOf(n);
    const submit = kids.find(isButtonLike);
    // The submit control is often a filled frame with one text, so it also looks like an input. It is the button, not a field.
    const direct = kids.filter((k) => k !== submit && isInputLike(k));
    const grouped = direct.length >= 2 ? [] : kids.filter((k) => k !== submit).flatMap((k) => {
      const boxes = inputBoxes(k);
      return boxes.length === 1 ? [{ wrap: k, box: boxes[0] }] : [];
    });
    const useDirect = direct.length >= 2 && submit;
    const useGrouped = !useDirect && grouped.length >= 2 && submit;
    if (useDirect || useGrouped) {
      const fields = [];
      const firstBox = useDirect ? direct[0] : grouped[0].box;
      if (useDirect) {
        for (const k of kids) {
          if (k !== submit && isInputLike(k)) fields.push(fieldFromBox(k, k));
          else if (isConsent(k)) {
            const statement = [...textsOf(k)].sort((a, b) => b.text.characters.length - a.text.characters.length)[0];
            fields.push({ node: k.id, type: 'checkbox', label: statement.text.characters.trim().replace(/\s+/g, ' '), labelNode: statement.id, required: false });
          }
        }
      } else {
        for (const k of kids) {
          const group = grouped.find((g) => g.wrap === k);
          if (group) fields.push(fieldFromBox(group.box, group.wrap));
          else if (k !== submit && isConsent(k)) {
            const statement = [...textsOf(k)].sort((a, b) => b.text.characters.length - a.text.characters.length)[0];
            fields.push({ node: k.id, type: 'checkbox', label: statement.text.characters.trim().replace(/\s+/g, ' '), labelNode: statement.id, required: false });
          }
        }
      }
      const count = useDirect ? direct.length : grouped.length;
      found.push({
        component: 'form', node: n.id, level: 'E2', confidence: count >= 3 ? 'high' : 'medium',
        cite: [{ node: n.id, field: 'name', equals: n.name }, { node: firstBox.id, field: 'type', equals: firstBox.type }, { node: submit.id, field: 'type', equals: submit.type }],
        evidence: `${n.type} "${n.name}": ${count} input-like frame(s) (light fill + one placeholder text) and a button "${textsOf(submit)[0].text.characters.trim().slice(0, 40)}"`,
        params: { fields, submit: submit.id, actions: ['save-submission'] },
        note: 'submit saves the entry (Bricks Save submission). Form name is the Figma file, the section and this frame. The site setting Save form submissions in database has to be on',
      });
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
