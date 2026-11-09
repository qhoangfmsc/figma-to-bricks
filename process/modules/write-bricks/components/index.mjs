// Registry of Figma patterns that become a real Bricks component instead of plain blocks.
// Human-readable version with the Figma signals and Bricks output: ./README.md (keep it in sync, a test checks the ids).
// A component module exports { id, status, label, figma, bricks, limits, check(node, det), apply(ctx, det), kind?(), mergesChildren? }.
//   check  -> { ok, reason }: can this node become the component? (if not, the build warns and keeps the block)
//   apply  -> writes the Bricks settings; may return { attrs } (verify checks them in the DOM) or { merged: [nodeIds] }
import tooltip from '../../write-bricks/components/tooltip.mjs';
import button from '../../write-bricks/components/button.mjs';
import flatImage from '../../write-bricks/components/flat-image.mjs';
import carousel from '../../write-bricks/components/carousel.mjs';
import form from '../../write-bricks/components/form.mjs';
import accordion from '../../write-bricks/components/accordion.mjs';
import tabs from '../../write-bricks/components/tabs.mjs';
import tabSwitch from '../../write-bricks/components/tab-switch.mjs';
import link from '../../write-bricks/components/link.mjs';
import semantic from '../../write-bricks/components/semantic.mjs';
import iconList from '../../write-bricks/components/icon-list.mjs';
import breadcrumbs from '../../write-bricks/components/breadcrumbs.mjs';
import counter from '../../write-bricks/components/counter.mjs';
import countdown from '../../write-bricks/components/countdown.mjs';
import tooltipStyle from '../../write-bricks/components/tooltip-style.mjs';
import menu from '../../write-bricks/components/menu.mjs';
import menuSlider from '../../write-bricks/components/menu-slider.mjs';
import readmore from '../../write-bricks/components/readmore.mjs';
import checkbox from '../../write-bricks/components/checkbox.mjs';
import toggleSwitch from '../../write-bricks/components/switch.mjs';
import radio from '../../write-bricks/components/radio.mjs';
import divider from '../../write-bricks/components/divider.mjs';
import search from '../../write-bricks/components/search.mjs';
import video from '../../write-bricks/components/video.mjs';
import { PRODUCTION } from '../../write-bricks/components/production.mjs';

export const COMPONENTS = Object.fromEntries([tooltip, button, flatImage, carousel, form, accordion, tabs, tabSwitch, link, semantic, iconList, breadcrumbs, counter, countdown, tooltipStyle, menu, menuSlider, readmore, checkbox, toggleSwitch, radio, divider, search, video, ...PRODUCTION].map((c) => [c.id, c]));
