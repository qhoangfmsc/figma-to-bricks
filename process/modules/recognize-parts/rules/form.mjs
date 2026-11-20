// Candidate forms: a container with a button-like child (the submit) and two or more fields.
// One field is enough on a dim overlay, or when a close mark sits in the frame. A dialog of switches stays separate switch rows: one form element would merge the card.
// A field is either an input-like frame itself, or a row that holds one: a label, a filled box (placeholder text plus icon instances) and a helper line.
// Consent rows (a small checkbox + a statement) between them become checkbox fields.
// Params for components/form.mjs: fields [{ node, type, label, placeholder, required }] in drawing order, submit (node id). Types are inferred from
// the visible text only (e-mail / phone words). Submit stores the entry (save-submission). The form name is filled at build from the Figma file, the section and this frame.
import { NodeType, FillType, isType, isText, HolderType } from '../node-type.mjs';
import { isActionBar } from '../../write-bricks/components/tab-switch.mjs';
import { PartKind, isKind } from '../kinds.mjs';
import { classifyChoice } from './choice.mjs';
import { centeredCard, covers, dimFill, hasClose, textsOf, visibleKids } from './shape.mjs';
import { showsPrice } from './layout-only.mjs';
import { shapeRole } from '../node-type.mjs';

const SAVE = /\blưu\b|\bluu\b|\bsave\b/i;
const HOLDERS = new Set(HolderType);
const BUTTON = /\b(button|btn|cta)\b/i;
const kidsOf = visibleKids;
const hasSvg = (n) => n.visible !== false && (!!n.svg || kidsOf(n).some(hasSvg));

export const isInputLike = (n) => {
  if (!HOLDERS.has(n.type) || n.visible === false || !n.fills?.some((f) => isType(f, FillType.SOLID))) return false;
  const kids = kidsOf(n);
  const texts = kids.filter((k) => isText(k) && !k.svg);
  // icon instances sit in the same box as the placeholder and hold no text of their own
  return texts.length === 1 && kids.every((k) => k === texts[0] || hasSvg(k) || textsOf(k).length === 0);
};
export const isButtonLike = (n) => {
  if (!HOLDERS.has(n.type) || n.visible === false || textsOf(n).length !== 1) return false;
  if (BUTTON.test(n.name ?? '') || BUTTON.test(n.componentSet ?? n.component ?? '')) return true;
  const kids = kidsOf(n);
  const texts = kids.filter((k) => isText(k) && !k.svg);
  const icons = kids.filter((k) => texts[0] && k !== texts[0] && hasSvg(k));
  const oneLabel = texts.length === 1 && kids.length === 1 + icons.length && icons.length <= 1;
  // A header puts the title and a corner icon at opposite ends. A button keeps them together.
  const sorted = kids.filter((k) => k.box).sort((a, b) => a.box.x - b.box.x);
  const gap = sorted.length >= 2 ? sorted.at(-1).box.x - (sorted[0].box.x + sorted[0].box.w) : 0;
  const spread = n.box?.w > 0 && gap > n.box.w * 0.4;
  const drawn = (n.fills ?? []).some((fill) => fill.visible !== false) || (n.strokes ?? []).length > 0 || n.radius;
  return oneLabel && drawn && !isInputLike(n) && !spread;
};
// A chip hugs its label. A badge is as tall as it is wide. A field leaves room past one line of text.
export const isFieldBox = (n) => {
  if (!isInputLike(n) || isButtonLike(n)) return false;
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (w <= 0 || h <= 0) return false;
  const text = textsOf(n)[0];
  const lines = text?.text?.lineHeightPx && text.box?.h ? Math.round(text.box.h / text.text.lineHeightPx) : 1;
  if (lines >= 2) return true;
  if (w < h * 1.6) return false;
  const bordered = (n.strokes ?? []).length > 0 || !!n.stroke?.paints?.length;
  if (bordered) return true;
  const textW = text?.box?.w ?? 0;
  return !(textW > w * 0.93);
};
export const isConsent = (n) => {
  if (!HOLDERS.has(n.type) || n.visible === false || textsOf(n).length < 1) return false;
  const statement = textsOf(n)[0];
  return kidsOf(n).some((child) => !isText(child) && (child.box?.w ?? 0) > 0 && (child.box.w < (statement.box?.w ?? Infinity)));
};

function fieldType(_text, node, textNode) {
  const lines = textNode?.text?.lineHeightPx ? Math.round(textNode.box.h / textNode.text.lineHeightPx) : 1;
  if (lines >= 2) return 'textarea';
  return 'text';
}

const containsId = (n, id) => n.id === id || kidsOf(n).some((c) => containsId(c, id));

function inputBoxes(n) {
  const boxes = [];
  (function walk(x) {
    if (x !== n && isFieldBox(x)) { boxes.push(x); return; }
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

function pathTo(root, id, acc = []) {
  if (!root || root.visible === false) return null;
  if (root.id === id) return [...acc, root];
  for (const child of kidsOf(root)) {
    const hit = pathTo(child, id, [...acc, root]);
    if (hit) return hit;
  }
  return null;
}

function parentNode(root, id) {
  const path = pathTo(root, id);
  return path && path.length > 1 ? path[path.length - 2] : null;
}

function buttonText(n) {
  return textsOf(n).map((t) => t.text.characters).join(' ').replace(/\s+/g, ' ').trim();
}

function titleFor(root, row, stateText, stateId) {
  let current = row;
  for (let depth = 0; depth < 8 && current; depth += 1) {
    const title = textsOf(current)
      .filter((t) => t.id !== stateId && t.text.characters.trim().replace(/\s+/g, ' ') !== stateText)
      .map((t) => t.text.characters.trim().replace(/\s+/g, ' '))
      .filter((t) => t && t.length <= 80)
      .sort((a, b) => a.length - b.length)[0];
    if (depth > 0 && title) return title;
    current = parentNode(root, current.id);
  }
  return stateText || 'Switch';
}

function smallestHost(node, saveId, switchIds) {
  for (const child of kidsOf(node)) {
    if (containsId(child, saveId) && switchIds.some((id) => containsId(child, id))) return smallestHost(child, saveId, switchIds);
  }
  return node;
}

// A settings / action popup: switches plus a Lưu / Save button. That button is the submit.
// A popup with no fields is a notice: its confirm button only closes.
export function detectActionForms(tree) {
  const switches = [];
  const saves = [];
  (function walk(n) {
    if (!n || n.visible === false) return;
    const choice = classifyChoice(n);
    if (isKind(choice, PartKind.SWITCH)) {
      switches.push({ node: n, choice });
      return;
    }
    if (isButtonLike(n) && SAVE.test(buttonText(n))) {
      saves.push(n);
      return;
    }
    kidsOf(n).forEach(walk);
  })(tree);
  const claimed = new Set();
  const found = [];
  for (const save of saves) {
    const open = switches.filter((sw) => !claimed.has(sw.node.id));
    if (!open.length) continue;
    const host = smallestHost(tree, save.id, open.map((sw) => sw.node.id));
    const mine = open.filter((sw) => containsId(host, sw.node.id));
    if (!mine.length || host.id === save.id) continue;
    mine.forEach((sw) => claimed.add(sw.node.id));
    mine.sort((a, b) => (a.node.box.absY - b.node.box.absY) || (a.node.box.absX - b.node.box.absX));
    const fields = mine.map((sw) => {
      const stateText = sw.choice.labelNode.text.characters.trim().replace(/\s+/g, ' ');
      return {
        node: sw.node.id,
        type: 'checkbox',
        role: 'switch',
        label: titleFor(tree, sw.node, stateText, sw.choice.labelNode.id),
        labelNode: sw.choice.labelNode.id,
        markNode: sw.choice.mark.id,
        checked: sw.choice.checked === true,
      };
    });
    found.push({
      component: PartKind.FORM,
      node: host.id,
      level: 'E2',
      confidence: 'high',
      cite: [
        { node: host.id, field: 'name', equals: host.name },
        { node: fields[0].node, field: 'type', equals: NodeType.FRAME },
        { node: save.id, field: 'type', equals: save.type },
      ],
      evidence: `${host.type} "${host.name}": action popup, ${fields.length} switch(es) and submit "${buttonText(save).slice(0, 40)}"`,
      params: { kind: 'action', popupKind: 'action', fields, submit: save.id, actions: ['save-submission'] },
      note: 'submit saves the entry (Bricks Save submission). The switch words are the drawn on and off values',
    });
  }
  return found;
}

export function detectForms(tree) {
  const action = detectActionForms(tree);
  const actionNodes = new Set(action.map((form) => form.node));
  const found = [...action];
  (function walk(n, parent) {
    if (!n || n.visible === false) return;
    const kids = kidsOf(n);
    if (actionNodes.has(n.id)) {
      kids.forEach((c) => walk(c, n));
      return;
    }
    // A row of peer chips, one drawn selected, is a tab. The resting chips are not inputs and the selected chip is not a submit.
    if (isActionBar(n)) {
      kids.forEach((c) => walk(c, n));
      return;
    }
    const submit = kids.find(isButtonLike);
    // Three labeled peers in one horizontal row are a bar of choices, not a column of fields.
    const labeled = kids.filter((child) => textsOf(child).length >= 1);
    if (n.layout?.mode === 'HORIZONTAL' && labeled.length >= 3) {
      kids.forEach((c) => walk(c, n));
      return;
    }
    // Peer chips in one horizontal row are one control, not a column of fields.
    const roles = kids.map((child) => shapeRole(child, kidsOf));
    if (n.layout?.mode === 'HORIZONTAL' && kids.length >= 2 && new Set(roles).size === 1) {
      kids.forEach((c) => walk(c, n));
      return;
    }
    // A row of package cards is a price table. Each card is not a field.
    if (kids.filter((child) => showsPrice(child)).length >= 2) {
      kids.forEach((c) => walk(c, n));
      return;
    }
    // The submit control is often a filled frame with one text, so it also looks like an input. It is the button, not a field.
    const direct = kids.filter((k) => k !== submit && isFieldBox(k));
    const grouped = direct.length >= 2 ? [] : kids.filter((k) => k !== submit && !showsPrice(k)).flatMap((k) => {
      const boxes = inputBoxes(k);
      return boxes.length === 1 ? [{ wrap: k, box: boxes[0] }] : [];
    });
    // A dim child, a close mark anywhere in this frame, or this card sitting on a dim parent.
    const overlay = kids.some((k) => covers(k, n) && dimFill(k)) || hasClose(n) || (!!parent && dimFill(parent) && centeredCard(n, parent));
    const minFields = overlay ? 1 : 2;
    const useDirect = direct.length >= minFields && grouped.length < 2;
    const useGrouped = !useDirect && grouped.length >= minFields;
    if (useDirect || useGrouped) {
      const fields = [];
      const firstBox = useDirect ? direct[0] : grouped[0].box;
      if (useDirect) {
        for (const k of kids) {
          if (k !== submit && isFieldBox(k)) fields.push(fieldFromBox(k, k));
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
      const button = submit ? textsOf(submit)[0]?.text?.characters?.trim().slice(0, 40) : '';
      found.push({
        component: PartKind.FORM, node: n.id, level: 'E2', confidence: count >= 3 ? 'high' : 'medium',
        cite: [{ node: n.id, field: 'name', equals: n.name }, { node: firstBox.id, field: 'type', equals: firstBox.type }, ...(submit ? [{ node: submit.id, field: 'type', equals: submit.type }] : [])],
        evidence: `${n.type} "${n.name}": ${count} input-like frame(s) (light fill + one placeholder text)${submit ? ` and a button "${button}"` : ' and no submit button drawn'}`,
        params: { fields, submit: submit?.id ?? null, actions: ['save-submission'], ...(overlay && count < 2 ? { overlay: true } : {}) },
        note: submit
          ? 'submit saves the entry (Bricks Save submission). Form name is the Figma file, the section and this frame. The site setting Save form submissions in database has to be on'
          : 'no submit is drawn, so one is added. The plan asks what it says. Submit saves the entry (Bricks Save submission)',
      });
    }
    kids.forEach((c) => walk(c, n));
  })(tree, null);
  return found;
}
