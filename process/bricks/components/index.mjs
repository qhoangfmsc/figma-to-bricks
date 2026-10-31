// Registry of Figma patterns that become a real Bricks component instead of plain blocks.
// Human-readable version with the Figma signals and Bricks output: ./README.md (keep it in sync, a test checks the ids).
// A component module exports { id, status, label, figma, bricks, limits, check(node, det), apply(ctx, det), kind?(), mergesChildren? }.
//   check  -> { ok, reason }: can this node become the component? (if not, the build warns and keeps the block)
//   apply  -> writes the Bricks settings; may return { attrs } (verify checks them in the DOM) or { merged: [nodeIds] }
import tooltip from './tooltip.mjs';
import button from './button.mjs';
import flatImage from './flat-image.mjs';
import carousel from './carousel.mjs';
import form from './form.mjs';
import accordion from './accordion.mjs';
import tabs from './tabs.mjs';
import link from './link.mjs';
import semantic from './semantic.mjs';
import iconList from './icon-list.mjs';
import breadcrumbs from './breadcrumbs.mjs';
import counter from './counter.mjs';
import countdown from './countdown.mjs';
import tooltipStyle from './tooltip-style.mjs';
import menu from './menu.mjs';
import readmore from './readmore.mjs';

export const COMPONENTS = Object.fromEntries([tooltip, button, flatImage, carousel, form, accordion, tabs, link, semantic, iconList, breadcrumbs, counter, countdown, tooltipStyle, menu, readmore].map((c) => [c.id, c]));
