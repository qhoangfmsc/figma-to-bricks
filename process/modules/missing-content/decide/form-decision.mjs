import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
import { MISSING, PlanGroup } from '../choices.mjs';

export const isForm = (entry) => isKind(entry, PartKind.FORM);

const fieldsOf = (entry) => entry?.params?.fields ?? [];

const enoughFields = (entry) => {
  const count = fieldsOf(entry).length;
  if (entry?.params?.overlay === true) return count >= 1;
  return count >= 2;
};

const drawnSubmit = (entry) => entry?.params?.submit;

function approveAddedSubmit(entry, node, ask, log) {
  entry.status = 'approved';
  entry.note = 'autopilot: the fields are a form. A submit button is added. The plan asks its label.';
  log(PartKind.FORM, node, `approved (${fieldsOf(entry).length} fields, submit added)`, entry.evidence ?? '', 'medium');
  ask(PlanGroup.SUBMIT, node.id, `Nút gửi của "${node.name}"`, MISSING);
}

function proposeShapeOnly(entry, node, ask, log) {
  entry.status = 'proposed';
  entry.note = 'autopilot: form shape only, the plan asks';
  log(PartKind.FORM, node, 'proposed (shape only)', entry.evidence ?? '', 'low');
  ask('confirm', node.id, `Form "${node.name}"`);
}

const fieldStem = (findNode, field) => (findNode(field.node)?.name ?? '').replace(/^.*\/\s*/, '').trim().toLowerCase();

function attachDrawnErrors(entry, node, findNode, formErrors, log, designer) {
  const stem = (field) => fieldStem(findNode, field);
  for (const field of fieldsOf(entry)) {
    const drawn = field.type !== 'checkbox' && formErrors[stem(field)];
    if (!drawn) continue;
    field.error = drawn.text;
    field.errorNode = drawn.node;
    entry.params.errorStyle ??= { ...drawn.style, gap: drawn.gap };
  }
  const withError = fieldsOf(entry).filter((field) => field.error);
  const without = fieldsOf(entry).filter((field) => !field.error && field.type !== 'checkbox');
  if (withError.length) log(PartKind.FORM, node, `error messages from Figma on ${withError.length} field(s)`, withError.map((field) => `${stem(field)} [${field.errorNode}]`).join(', '), 'high');
  designer.push(`Form "${node.name}" [${node.id}]: submit saves the entry (Save submission). No email recipient${without.length ? `. error messages for the fields Figma has no error frame for (${without.map(stem).join(', ')})` : ''}`);
}

function approveDrawnSubmit(entry, node, findNode, formErrors, log, designer) {
  entry.status = 'approved';
  entry.note = 'autopilot: a real Bricks form; submit saves the entry (Save submission)';
  log(PartKind.FORM, node, `approved (${fieldsOf(entry).length} fields, submit ${drawnSubmit(entry)})`, `input-like frames with placeholders and a submit button; types from their texts: ${fieldsOf(entry).map((field) => field.type).join(', ')}`, 'medium');
  attachDrawnErrors(entry, node, findNode, formErrors, log, designer);
}

export function decideForm(entry, node, tools) {
  if (!isForm(entry) || !enoughFields(entry)) return false;
  if (!drawnSubmit(entry)) {
    approveAddedSubmit(entry, node, tools.ask, tools.log);
    return true;
  }
  if (entry.confidence === 'low') {
    proposeShapeOnly(entry, node, tools.ask, tools.log);
    return true;
  }
  approveDrawnSubmit(entry, node, tools.findNode, tools.formErrors, tools.log, tools.designer);
  return true;
}
