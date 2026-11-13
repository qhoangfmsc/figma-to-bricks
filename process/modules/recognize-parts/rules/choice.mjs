// A checkbox is a small square beside one label. A switch is a pill track with one knob beside one label.
// The layer name is a hint. The shape is the evidence. A row already inside a form stays a form field.
import { detectForms } from './form.mjs';
import { isIconMark } from './shape.mjs';

const HOLDERS = new Set(['FRAME', 'INSTANCE', 'COMPONENT', 'GROUP']);
const CHECK_NAME = /\b(checkbox|check box)\b/i;
const SWITCH_NAME = /\b(switch|toggle)\b/i;
const RADIO_NAME = /\b(radio)\b/i;

const kids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function contains(n, id) {
  return n.id === id || kids(n).some((c) => contains(c, id));
}

function radiusMin(n) {
  return Array.isArray(n.radius) && n.radius.length ? Math.min(...n.radius) : 0;
}

function labelOf(n) {
  if (!n || n.visible === false) return null;
  if (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim()) return n;
  const inner = kids(n);
  if (inner.length === 1) return labelOf(inner[0]);
  return null;
}

function isSquare(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  return HOLDERS.has(n.type) && w >= 12 && w <= 32 && h >= 12 && h <= 32 && Math.abs(w - h) <= 4;
}

function isCircle(n) {
  const h = n.box?.h ?? 0;
  return isSquare(n) && radiusMin(n) >= h / 2 - 1;
}

function isTrack(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (!HOLDERS.has(n.type) || h < 16 || h > 44 || w < h * 1.55 || w > h * 2.9) return false;
  return radiusMin(n) >= h / 2 - 1;
}

function knobOf(track) {
  return kids(track).find((c) => {
    const w = c.box?.w ?? 0;
    const h = c.box?.h ?? 0;
    const th = track.box?.h ?? 0;
    return Math.abs(w - h) <= 4 && w >= th * 0.45 && w <= th;
  });
}

function checkedSquare(box) {
  return kids(box).length > 0;
}

function checkedTrack(track, knob) {
  const center = (knob.box?.x ?? 0) + (knob.box?.w ?? 0) / 2;
  return center > (track.box?.w ?? 0) / 2;
}

function classify(n) {
  const direct = kids(n);
  const track = direct.find((c) => isTrack(c) && !isIconMark(c));
  const knob = track ? knobOf(track) : null;
  const square = direct.find((c) => isSquare(c) && !isIconMark(c) && !c.svg);
  const circle = square && isCircle(square) ? square : null;
  const mark = knob ? track : square;
  if (!mark) return null;
  const labelNode = direct.filter((c) => c !== mark).map(labelOf).find(Boolean);
  const extras = direct.filter((c) => c !== mark && labelOf(c) !== labelNode);
  const labelHolder = direct.find((c) => c !== mark && labelOf(c) === labelNode);
  const onMark = labelHolder?.box && mark?.box
    && labelHolder.box.w <= mark.box.w + 4 && labelHolder.box.h <= mark.box.h + 4
    && labelHolder.box.x + labelHolder.box.w / 2 >= mark.box.x
    && labelHolder.box.x + labelHolder.box.w / 2 <= mark.box.x + mark.box.w
    && labelHolder.box.y + labelHolder.box.h / 2 >= mark.box.y
    && labelHolder.box.y + labelHolder.box.h / 2 <= mark.box.y + mark.box.h;
  if (!labelNode || extras.length || onMark) return null;
  if (knob) {
    const named = SWITCH_NAME.test(n.name ?? '') || SWITCH_NAME.test(n.component ?? '') || SWITCH_NAME.test(track.name ?? '');
    return {
      component: 'switch',
      confidence: 'high',
      checked: checkedTrack(track, knob),
      labelNode,
      mark,
      evidence: `${n.type} "${n.name}" is a pill ${Math.round(track.box.w)}×${Math.round(track.box.h)} with a knob ${checkedTrack(track, knob) ? 'on the end' : 'at the start'} and the label "${labelNode.text.characters.trim()}"${named ? '' : ' (shape only)'}`,
    };
  }
  if (circle) {
    const named = RADIO_NAME.test(n.name ?? '') || RADIO_NAME.test(n.component ?? '') || RADIO_NAME.test(circle.name ?? '');
    const on = checkedSquare(circle);
    return {
      component: 'radio',
      confidence: named || on ? 'high' : 'medium',
      checked: on,
      labelNode,
      mark: circle,
      evidence: `${n.type} "${n.name}" is a ${Math.round(circle.box.w)}px circle ${on ? 'with a mark' : 'empty'} beside "${labelNode.text.characters.trim()}"${named || on ? '' : ' (shape only)'}`,
    };
  }
  const named = CHECK_NAME.test(n.name ?? '') || CHECK_NAME.test(n.component ?? '') || CHECK_NAME.test(square.name ?? '');
  const on = checkedSquare(square);
  return {
    component: 'checkbox',
    confidence: named || on ? 'high' : 'medium',
    checked: on,
    labelNode,
    mark: square,
    evidence: `${n.type} "${n.name}" is a ${Math.round(square.box.w)}px square ${on ? 'with a mark' : 'empty'} beside "${labelNode.text.characters.trim()}"${named || on ? '' : ' (shape only)'}`,
  };
}

export function classifyChoice(n) {
  return classify(n);
}

export function detectChoices(tree) {
  const formIds = new Set(detectForms(tree).map((f) => f.node));
  const found = [];
  (function walk(n) {
    if (!n || n.visible === false || formIds.has(n.id)) return;
    const hit = classify(n);
    if (hit) {
      const label = hit.labelNode.text.characters.trim().replace(/\s+/g, ' ');
      found.push({
        component: hit.component,
        node: n.id,
        level: hit.confidence === 'high' ? 'E2' : 'E3',
        confidence: hit.confidence,
        cite: [
          { node: hit.mark.id, field: 'type', equals: hit.mark.type },
          { node: hit.labelNode.id, field: 'type', equals: 'TEXT' },
        ],
        evidence: hit.evidence,
        params: {
          label,
          labelNode: hit.labelNode.id,
          checked: hit.checked,
          markNode: hit.mark.id,
          markW: Math.round(hit.mark.box.w),
          markH: Math.round(hit.mark.box.h),
          markRadius: Math.round(radiusMin(hit.mark)),
        },
        note: null,
      });
      return;
    }
    kids(n).forEach(walk);
  })(tree);
  return found.filter((c) => !found.some((other) => other.node !== c.node && contains(find(tree, other.node) ?? {}, c.node)));
}

function find(n, id) {
  if (!n) return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
}
