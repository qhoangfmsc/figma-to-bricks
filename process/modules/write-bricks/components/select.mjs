// Default select. The closed face is one trigger: label on the left, an optional
// badge, and a chevron only on that trigger. The option list is one block,
// position absolute under the trigger. Items have no border and no chevron.
// The chosen item shows a check. A price table reuses this shell and only
// fills the list with its cycle loop.

import { PartKind } from '../../recognize-parts/kinds.mjs';
import { cssColor } from '../render/utils/css.mjs';

const CHEVRON = 'content: ""; width: 8px; height: 8px; margin-left: 8px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); flex: none;';
const CHECK = 'content: ""; width: 6px; height: 10px; margin-left: 8px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); flex: none;';

export function selectRoot({ trigger = false } = {}) {
  return {
    _hidden: { _cssClasses: trigger ? 'f2b-select f2b-select-trigger' : 'f2b-select' },
    _position: 'relative',
    _overflow: 'visible',
  };
}

export function selectValues() {
  return {
    label: 'Values',
    settings: {
      _hidden: { _cssClasses: 'f2b-select-values' },
      _position: 'absolute',
      _top: '100%',
      _left: '0px',
      _width: '100%',
      _zIndex: 30,
      _display: 'flex',
      _direction: 'column',
    },
  };
}

export function selectTrigger(value = '') {
  return {
    place: 'before',
    name: 'block',
    label: 'Trigger',
    settings: {
      _hidden: { _cssClasses: 'f2b-select-trigger' },
      _display: 'flex',
      _direction: 'row',
      _alignItems: 'center',
      _width: '100%',
    },
    children: [
      { name: 'text-basic', label: 'Value', settings: { text: value, _hidden: { _cssClasses: 'f2b-select-value' } } },
      { name: 'text-basic', label: 'Badge', settings: { text: '', _hidden: { _cssClasses: 'f2b-select-badge' } } },
    ],
  };
}

export function selectShell({ lineWidth, lineColor, lineRadius, padCss, value } = {}) {
  return {
    settings: selectRoot(),
    css: selectCss({ lineWidth, lineColor, lineRadius, padCss }),
    extraChildren: [selectTrigger(value)],
  };
}

export function selectOptionHost() {
  return {
    enclose: selectValues(),
    dropSettings: ['_border'],
    settings: {
      _display: 'flex',
      _direction: 'row',
      _justifyContent: 'flex-start',
      _alignItems: 'center',
      _width: '100%',
    },
  };
}

export function selectCss({ lineWidth = 1, lineColor = 'currentColor', lineRadius = 0, padCss = '' } = {}) {
  return [
    { decl: 'display: flex; flex-direction: column; overflow: visible;', suffix: '' },
    { decl: 'display: none;', suffix: ':not(.is-open) .f2b-select-values' },
    { decl: `display: flex; flex-direction: column; margin-top: 4px; background: #fff; border: ${lineWidth}px solid ${lineColor}; border-radius: ${lineRadius}px; box-shadow: 0 8px 24px rgba(0, 0, 0, .12);`, suffix: '.is-open .f2b-select-values' },
    { decl: 'display: flex; align-items: center; width: 100%; background: transparent; border: none;', suffix: ' .tab-title' },
    { decl: 'display: flex; align-items: center; width: 100%; background: transparent; border: none;', suffix: ' .f2b-select-option' },
    { decl: 'background: rgba(0, 0, 0, .05);', suffix: '.is-open .tab-title.brx-open' },
    { decl: 'background: rgba(0, 0, 0, .05);', suffix: '.is-open .f2b-select-option.is-selected' },
    { decl: 'display: none;', suffix: ' .tab-title .brxe-svg' },
    { decl: 'display: none;', suffix: '.f2b-select-trigger > .brxe-svg' },
    { decl: 'display: none;', suffix: '.f2b-select-trigger > .brxe-block:not(.f2b-select-values)' },
    { decl: CHECK, suffix: '.is-open .tab-title.brx-open::after' },
    { decl: CHECK, suffix: '.is-open .f2b-select-option.is-selected::after' },
    { decl: `display: flex; align-items: center; width: 100%; order: 1; cursor: pointer; border: ${lineWidth}px solid ${lineColor}; border-radius: ${lineRadius}px; ${padCss}`, suffix: ' .f2b-select-trigger' },
    { decl: CHEVRON, suffix: '.f2b-select-trigger::after' },
    { decl: CHEVRON, suffix: ' .f2b-select-trigger::after' },
    { decl: 'margin-right: auto; text-align: left;', suffix: ' .f2b-select-value' },
    { decl: 'margin-right: auto; text-align: left;', suffix: ' > .brxe-text-basic' },
    { decl: 'margin-right: auto; text-align: left;', suffix: ' .tab-title > .brxe-text-basic:first-child' },
    { decl: 'margin-right: auto; text-align: left;', suffix: ' .f2b-select-option > .brxe-text-basic' },
    { decl: 'display: none;', suffix: ' .f2b-select-badge:empty' },
  ];
}

export function selectScript() {
  return '(function(){if(window.__f2bSelect)return;window.__f2bSelect=1;function sync(select){var open=select.querySelector(".tab-title.brx-open")||select.querySelector(".f2b-select-option.is-selected");var value=select.querySelector(".f2b-select-value");var badge=select.querySelector(".f2b-select-badge");if(!open||!value)return;var label=open.querySelector(".brxe-text-basic");var chip=open.querySelector(".f2b-select-badge");if(label)value.textContent=label.textContent.trim();if(badge){var text=chip?chip.textContent.trim():"";badge.textContent=text;badge.style.display=text?"":"none";}}document.addEventListener("click",function(e){var select=e.target.closest&&e.target.closest(".f2b-select");document.querySelectorAll(".f2b-select.is-open").forEach(function(el){if(el!==select)el.classList.remove("is-open");});if(!select)return;var option=e.target.closest(".f2b-select-option,.tab-title");if(option&&select.contains(option)){select.querySelectorAll(".f2b-select-option").forEach(function(el){el.classList.toggle("is-selected",el===option);});setTimeout(function(){sync(select);select.classList.remove("is-open");},0);return;}select.classList.toggle("is-open");});function boot(){document.querySelectorAll(".f2b-select").forEach(sync);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();})();';
}

function valuesPanel(values) {
  return {
    name: 'block',
    label: 'Values',
    settings: selectValues().settings,
    children: values.map((value) => ({
      name: 'block',
      label: value,
      settings: {
        _hidden: { _cssClasses: 'f2b-select-option' },
        _display: 'flex',
        _direction: 'row',
        _justifyContent: 'flex-start',
        _alignItems: 'center',
        _width: '100%',
      },
      children: [{ name: 'text-basic', label: value, settings: { text: value } }],
    })),
  };
}

function padCssOf(node) {
  const pad = node.layout?.padding;
  return pad ? `padding:${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px;` : '';
}

export default {
  id: PartKind.SELECT,
  status: 'implemented',
  label: 'Dropdown',
  figma: 'a short wide bordered control, one value, and a small mark at the end. A label above it is optional',
  bricks: 'block f2b-select. The drawn control is the trigger. The option list is one absolute block under it. Items have no border and no chevron. The chosen item shows a check',
  limits: 'Until the plan lists the values, the control shows the drawn value and has no menu',
  check(_node, det) {
    if (!det?.params?.text) return { ok: false, reason: 'a dropdown needs the value it shows' };
    return { ok: true, warnings: [] };
  },
  apply(ctx) {
    Object.assign(ctx.s, selectRoot({ trigger: true }));
  },
  descendants(node, det) {
    const values = (det?.params?.values ?? []).map((value) => String(value).trim()).filter(Boolean);
    const paint = (node.stroke?.paints ?? []).find((item) => item.visible !== false);
    const valueNode = (node.children ?? []).find((child) => child?.type === 'TEXT' && child.visible !== false);
    return {
      [node.id]: {
        css: selectCss({
          lineWidth: node.stroke?.weight || 1,
          lineColor: paint ? cssColor(paint) : 'currentColor',
          lineRadius: Array.isArray(node.radius) ? node.radius[0] : 0,
          padCss: padCssOf(node),
        }),
        ...(values.length ? { extraChildren: [valuesPanel(values)] } : {}),
      },
      ...(valueNode ? { [valueNode.id]: { settings: { _hidden: { _cssClasses: 'f2b-select-value' } } } } : {}),
    };
  },
  pageScript: selectScript,
};
