// Candidate forms: a container whose visible children include two or more input-like frames (a light solid fill, one placeholder text, input height)
// and a button-like child (the submit). Consent rows (a small checkbox + a statement) between them become checkbox fields.
// Params for components/form.mjs: fields [{ node, type, label, placeholder, required }] in drawing order, submit (node id). Types are inferred from
// the visible text only (e-mail / phone words); nothing about what the form DOES (action, recipient) is invented: it goes to the designer list.
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
  return texts.length === 1 && kids.every((k) => k === texts[0] || hasSvg(k)) && texts[0].text.characters.length <= 120;
};
export const isButtonLike = (n) => HOLDERS.has(n.type) && n.visible !== false && (BUTTON.test(n.name ?? '') || BUTTON.test(n.componentSet ?? n.component ?? '')) && textsOf(n).length === 1;
export const isConsent = (n) => HOLDERS.has(n.type) && n.visible !== false && n.box.h <= 140 && has(n, /check\s?box|consent/i) && textsOf(n).length >= 1;

function fieldType(text, node, textNode) {
  if (/e-?mail/i.test(text)) return 'email';
  if (/điện thoại|dien thoai|phone|zalo|\btel\b|sđt/i.test(text)) return 'tel';
  // a placeholder Figma wraps over two or more lines needs a multi-line control (an input shows one line)
  const lines = textNode?.text?.lineHeightPx ? Math.round(textNode.box.h / textNode.text.lineHeightPx) : 1;
  if (/lời nhắn|nội dung|ghi chú|message|comment/i.test(text) || node.box.h > 100 || lines >= 2) return 'textarea';
  return 'text';
}

export function detectForms(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    const kids = kidsOf(n);
    const inputs = kids.filter(isInputLike);
    const submit = kids.find(isButtonLike);
    if (inputs.length >= 2 && submit) {
      const fields = [];
      for (const k of kids) {
        if (isInputLike(k)) {
          const raw = textsOf(k)[0].text.characters.trim().replace(/\s+/g, ' ');
          // the placeholder is kept AS DRAWN ("Họ và Tên*"): Bricks would otherwise append its own " *" to a required field
          fields.push({ node: k.id, type: fieldType(raw, k, textsOf(k)[0]), placeholder: raw, required: /\*/.test(raw) });
        } else if (isConsent(k)) {
          const statement = [...textsOf(k)].sort((a, b) => b.text.characters.length - a.text.characters.length)[0];
          fields.push({ node: k.id, type: 'checkbox', label: statement.text.characters.trim().replace(/\s+/g, ' '), labelNode: statement.id, required: false });
        }
      }
      found.push({
        component: 'form', node: n.id, level: 'E2', confidence: inputs.length >= 3 ? 'high' : 'medium',
        cite: [{ node: n.id, field: 'name', equals: n.name }, { node: inputs[0].id, field: 'type', equals: inputs[0].type }, { node: submit.id, field: 'type', equals: submit.type }],
        evidence: `${n.type} "${n.name}": ${inputs.length} input-like frame(s) (light fill + one placeholder text) and a button "${textsOf(submit)[0].text.characters.trim().slice(0, 40)}"`,
        params: { fields, submit: submit.id }, note: 'what the form does (action, recipient, success message) is not in Figma: designer list',
      });
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
