// Project policy (process/policy.json): the few global choices that change how Figma numbers are written. Loaded once.
import { readFileSync } from 'node:fs';

export const policy = JSON.parse(readFileSync(new URL('../policy.json', import.meta.url), 'utf8'));

// line-height in px as Figma lays it out (policy.lineHeight.mode: 'figma-round' | 'exact')
export const lineHeightPx = (v) => (policy.lineHeight?.mode === 'exact' ? v : Math.round(v));
