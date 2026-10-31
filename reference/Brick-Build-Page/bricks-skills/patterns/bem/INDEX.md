# BEM patterns

These three files demonstrate the class-first workflow: **zero visual settings on elements** — every style lives in a BEM-named global class (`block__element--modifier`), applied via `_cssGlobalClasses`. Modifiers are extra class ids stacked after the base (`["bmcard", "bmcftd"]` → `card card--featured`), placed later in the `globalClasses` array so equal-specificity CSS wins. Element `label`s show the intended class names for inspection in the structure panel. Paste any two BEM files into the same site and identically named classes dedupe by name, keeping styles in sync.

| File | Format | Demonstrates |
|------|--------|--------------|
| [bem-hero.json](bem-hero.json) | clipboard | **BEM test**: all styling in `hero`/`hero__*` classes + shared `btn` base with `btn--primary`/`btn--ghost` modifiers; elements carry only content |
| [bem-card-grid.json](bem-card-grid.json) | clipboard | **BEM test**: `card` base + `card--featured` modifier (stacked class ids), descendant styling via class `_cssCustom`, responsive grid inside `cards__grid` class |
| [bem-pricing.json](bem-pricing.json) | clipboard | **BEM test**: `plan`/`plan--featured`, `plan__cta`/`plan__cta--solid`, inline `<span class="plan__period">` styled from the parent class |
