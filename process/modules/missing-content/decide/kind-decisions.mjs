import { closedItems, drawnAnswer, syncNotes } from '../../write-bricks/components/accordion.mjs';
import { visibleKids, firstText } from '../../write-bricks/components/helpers.mjs';
import { MISSING } from '../choices.mjs';
import { tabInventory } from '../../write-bricks/components/tabs.mjs';
import { switchInventory, tabQuestions } from '../../write-bricks/components/tab-switch.mjs';
import { paneQuestionLabel } from '../pane-label.mjs';
import { menuLabels } from '../../write-bricks/components/menu.mjs';
import { PartKind, isKind, isAnyKind, isSignal, isPaginationHint, WidgetKind, ChoiceKind, TabKind, MenuKind } from '../../recognize-parts/kinds.mjs';
import { decideForm } from './form-decision.mjs';

const high = (entry) => entry.confidence === 'high';
const low = (entry) => entry.confidence === 'low';

function approve(entry, note) {
  entry.status = 'approved';
  entry.note = note;
}

function keepProposed(entry, note) {
  entry.status = 'proposed';
  entry.note = note;
}

function decideSearch(entry, node, { ask, log }) {
  if (!isKind(entry, PartKind.SEARCH)) return false;
  if (high(entry)) {
    approve(entry, 'autopilot: a search field. The form uses the WordPress home URL');
    log(PartKind.SEARCH, node, 'approved', entry.evidence ?? '', 'high');
    return true;
  }
  keepProposed(entry, 'autopilot: shape only, the plan asks before it becomes a search field');
  ask('confirm', entry.node, `Ô "${node.name}" là ô tìm kiếm?`, '');
  log(PartKind.SEARCH, node, 'proposed (shape only)', entry.evidence ?? '', entry.confidence ?? 'medium');
  return true;
}

function decideVideo(entry, node, { ask, log }) {
  if (!isKind(entry, PartKind.VIDEO)) return false;
  if (entry.params?.url) {
    approve(entry, 'autopilot: a video, the address came from the plan');
    log(PartKind.VIDEO, node, 'approved', entry.evidence ?? '', 'high');
    return true;
  }
  keepProposed(entry, 'autopilot: the picture stays until the plan has a video address');
  ask('video', entry.node, node.name || 'Video', '');
  log(PartKind.VIDEO, node, 'proposed (no address)', entry.evidence ?? '', 'high');
  return true;
}

function decideDivider(entry, node, { log }) {
  if (!isKind(entry, PartKind.DIVIDER)) return false;
  approve(entry, 'autopilot: a line, the divider element');
  log(PartKind.DIVIDER, node, 'approved', entry.evidence ?? '', 'high');
  return true;
}

function decideFlatImage(entry, node, { log, hasText, textsIn }) {
  if (!isKind(entry, PartKind.FLAT_IMAGE)) return false;
  if (hasText(node)) {
    entry.status = 'rejected';
    entry.note = 'autopilot: the subtree holds real text, so it is not a picture';
    log(PartKind.FLAT_IMAGE, node, 'rejected', `contains ${textsIn(node).length} visible text(s): text must stay selectable`);
    return true;
  }
  approve(entry, 'autopilot: decoration without text, exported as one picture by Figma');
  log(PartKind.FLAT_IMAGE, node, 'approved', 'art layers without text: one picture rendered by Figma is exact', 'medium');
  return true;
}

function decideChoice(entry, node, { log }) {
  if (!isAnyKind(entry, ChoiceKind)) return false;
  if (high(entry)) {
    approve(entry, `autopilot: a ${entry.component}, native form field`);
    log(entry.component, node, 'approved', entry.evidence ?? '', 'high');
    return true;
  }
  keepProposed(entry, 'autopilot: shape only, the plan asks before it becomes a control');
  log(entry.component, node, 'proposed (shape only)', entry.evidence ?? '', entry.confidence ?? 'medium');
  return true;
}

function buttonLabel(node, textsIn) {
  return textsIn(node)[0]?.text.characters.trim().slice(0, 40) ?? node.name;
}

function decideButton(entry, node, { ask, log, designer, textsIn }) {
  if (!isKind(entry, PartKind.BUTTON)) return false;
  const label = buttonLabel(node, textsIn);
  if (entry.params?.role === 'layout') {
    approve(entry, 'autopilot: layout only. Domain search and price tables are not actions in this project');
    log(PartKind.BUTTON, node, 'approved (layout)', `label "${label}"`, 'high');
    return true;
  }
  if (entry.params?.role === 'close' || entry.params?.role === 'action') {
    approve(entry, 'autopilot: this button closes the popup. It is a button element, not a link');
    log(PartKind.BUTTON, node, 'approved (close)', `label "${label}"`, 'high');
    return true;
  }
  if (low(entry)) {
    keepProposed(entry, 'autopilot: button shape only, the plan asks before it becomes a button');
    log(PartKind.BUTTON, node, 'proposed (shape only)', `label "${label}"`, 'low');
    ask('confirm', node.id, `Nút "${label}"`);
    return true;
  }
  approve(entry, 'autopilot: button, link "#" until the designer gives the URL');
  log(PartKind.BUTTON, node, 'approved', `label "${label}" with a frame look`);
  designer.push(`Link URL (and target) of the button "${label}" [${node.id}]`);
  ask('link', node.id, `Nút "${label}"`);
  return true;
}

function decideAccordion(entry, node, { ask, log, designer, kids }) {
  if (!isKind(entry, PartKind.ACCORDION)) return false;
  const guess = low(entry);
  const closed = closedItems(node);
  entry.status = guess ? 'proposed' : 'approved';
  entry.note = guess
    ? 'autopilot: found by its shape only: the Plan asks whether it is an accordion'
    : 'autopilot: an FAQ / accordion, structure from Figma; the answers of the closed items come from the Plan';
  log(PartKind.ACCORDION, node, guess ? 'proposed (shape only: asked in the Plan)' : `approved (${kids(node).length} items, ${closed.length} closed)`, entry.evidence ?? '', guess ? 'low' : entry.confidence ?? 'medium');
  for (const item of visibleKids(node)) {
    const question = (firstText(visibleKids(item)[0])?.text?.characters ?? item.name).replace(/\s+/g, ' ').trim();
    const drawn = drawnAnswer(item);
    ask('answer', item.id, `"${question.slice(0, 90)}"`, drawn || MISSING);
    if (!drawn) designer.push(`Answer to the FAQ question "${question.slice(0, 60)}" [${item.id}]`);
  }
  const notes = syncNotes(node);
  if (notes.length) ask('sync', node.id, `"${node.name}": ${notes.join('; ')}`);
  if (guess) ask('confirm', node.id, `"${node.name}" (${kids(node).length} mục)`);
  return true;
}

function decideTabs(entry, node, { ask, log, designer }) {
  if (!isAnyKind(entry, TabKind)) return false;
  if (low(entry)) {
    keepProposed(entry, 'autopilot: tab shape only, the plan asks');
    log(entry.component, node, 'proposed (shape only)', entry.evidence ?? '', 'low');
    ask('confirm', node.id, `Tabs "${node.name}"`);
    return true;
  }
  const rows = isKind(entry, PartKind.TAB_SWITCH) ? switchInventory(node) : tabInventory(node);
  const missing = rows.filter((row) => !row.drawn);
  approve(entry, 'autopilot: every tab is listed on the screen with the content Figma drew; a Figma link replaces that pane, typed text fills a pane Figma does not draw');
  log(entry.component, node, `approved (${rows.length} tab(s), ${missing.length} not drawn)`, entry.evidence ?? '', entry.confidence ?? (isKind(entry, PartKind.TAB_SWITCH) ? 'high' : 'medium'));
  for (const row of rows) ask('pane', row.title.id, paneQuestionLabel(row));
  for (const question of tabQuestions(node)) ask(question.group, node.id, question.label);
  for (const row of missing) designer.push(`Content of the tab "${String(row.label).slice(0, 60)}" [${row.title.id}]`);
  return true;
}

function decideMenu(entry, node, { ask, log, designer }) {
  if (!isAnyKind(entry, MenuKind)) return false;
  if (low(entry)) {
    keepProposed(entry, 'autopilot: menu shape only, the plan asks');
    log(entry.component, node, 'proposed (shape only)', entry.evidence ?? '', 'low');
    ask('confirm', node.id, `Menu "${node.name}"`);
    return true;
  }
  const labels = menuLabels(node);
  const slider = isKind(entry, PartKind.MENU_SLIDER);
  approve(entry, slider
    ? 'autopilot: a menu slider (drag and arrows, no loop, no autoplay); the URLs come from the Plan'
    : 'autopilot: a menu, nav > ul > li > text-link; the URLs come from the Plan');
  log(entry.component, node, `approved (${labels.length} items${slider ? ', menu slider' : ''})`, entry.evidence ?? '', entry.confidence ?? 'medium');
  for (const label of labels) ask('link', label.id, `Mục menu "${label.text.characters.trim().slice(0, 40)}"`);
  designer.push(`Link URLs of the ${labels.length} menu items in "${node.name}" (${labels.slice(0, 12).map((label) => label.text.characters.trim()).join(', ')}), written as "#"`);
  return true;
}

function decideSelect(entry, node, { ask, log, textsIn }) {
  if (!isKind(entry, PartKind.SELECT)) return false;
  const label = textsIn(node)[0]?.text.characters.trim().slice(0, 40) ?? node.name;
  approve(entry, 'autopilot: a closed dropdown. The option list comes from the plan');
  log(PartKind.SELECT, node, 'approved', entry.evidence ?? '', 'high');
  ask('options', node.id, `Dropdown "${label}"`);
  return true;
}

function decideWidget(entry, node, { ask, log }) {
  if (!isAnyKind(entry, WidgetKind)) return false;
  if (high(entry)) {
    approve(entry, `autopilot: ${entry.component}, from the production widget map and the 1.12.3 element`);
    log(entry.component, node, 'approved', entry.evidence ?? '', 'high');
    return true;
  }
  keepProposed(entry, 'autopilot: shape only, the plan asks');
  ask('confirm', node.id, `${entry.component} "${node.name}"`);
  log(entry.component, node, 'proposed (shape only)', entry.evidence ?? '', entry.confidence ?? 'medium');
  return true;
}

function decideReadmore(entry, node, { log }) {
  if (!isKind(entry, PartKind.READMORE)) return false;
  approve(entry, 'autopilot: "Xem thêm" opens the clipped text (a click toggles a class, no JS); nothing to ask');
  log(PartKind.READMORE, node, 'approved', entry.evidence ?? '', entry.confidence ?? 'medium');
  return true;
}

function decideSignal(entry, node, { log }) {
  if (!isSignal(entry.component) && !isPaginationHint(entry)) return false;
  keepProposed(entry, 'autopilot: a hint for the component it belongs to, not an element');
  log(entry.component, node, 'hint', entry.evidence ?? '', entry.confidence ?? 'high');
  return true;
}

function slideCount(node, entry, kids) {
  const control = new Set([entry.params?.pagination, entry.params?.prev, entry.params?.next, ...(entry.params?.controls ?? [])].filter(Boolean));
  return Math.max(1, kids(node).filter((child) => !control.has(child.id)).length);
}

function decideCarousel(entry, node, { ask, log, kids }) {
  if (!isKind(entry, PartKind.CAROUSEL)) return false;
  if (low(entry)) {
    keepProposed(entry, 'autopilot: slider shape only, the plan asks');
    log(PartKind.CAROUSEL, node, 'proposed (shape only)', entry.evidence ?? '', 'low');
    ask('confirm', node.id, `Slider "${node.name}"`);
    return true;
  }
  approve(entry, 'autopilot: a slider (Bricks slider-nested), always loop and autoplay; dashes follow the items and the active dash follows the slide that is in front; the Plan sets the item count and the full set');
  log(PartKind.CAROUSEL, node, 'approved', entry.evidence ?? '', entry.confidence ?? 'medium');
  ask('autoplay', node.id, `Slider "${node.name}"`);
  ask('count', node.id, `Slider "${node.name}"`, String(slideCount(node, entry, kids)));
  ask('items', node.id, `Slider "${node.name}"`);
  ask('mobileform', node.id, `Slider "${node.name}"`, 'slider');
  return true;
}

const deciders = [
  decideSearch,
  decideVideo,
  decideDivider,
  decideFlatImage,
  decideChoice,
  decideButton,
  decideForm,
  decideAccordion,
  decideTabs,
  decideMenu,
  decideSelect,
  decideWidget,
  decideReadmore,
  decideSignal,
  decideCarousel,
];

export function decideCandidate(entry, node, tools) {
  return deciders.some((decide) => decide(entry, node, tools));
}
