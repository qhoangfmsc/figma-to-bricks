import { PartKind, isKind } from '../recognize-parts/kinds.mjs';
import { SubmitChoice } from './choices.mjs';

const liveForm = (components, node) => components.find((item) => isKind(item, PartKind.FORM) && item.node === node && item.status !== 'rejected');

function rejectForm(entry) {
  entry.status = 'rejected';
  entry.note = 'the owner said this is not a form';
}

function keepSubmitText(entry, picked) {
  if (picked.choice === SubmitChoice.TEXT && picked.text) entry.params = { ...(entry.params ?? {}), submitText: picked.text };
  entry.status = 'approved';
}

export function applySubmitChoice(components, node, picked) {
  const entry = liveForm(components, node);
  if (!entry) return false;
  if (picked.choice === SubmitChoice.DROP) rejectForm(entry);
  else keepSubmitText(entry, picked);
  return true;
}
