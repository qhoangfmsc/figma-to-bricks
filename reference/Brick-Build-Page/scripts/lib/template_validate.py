"""G1/G2 validation helpers for Figma → Bricks review gates."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable

from scripts.lib.figma_spec import ASSET_PLACEHOLDER, FIGMA_MCP_ASSET_RE

ELEMENT_ID_RE = re.compile(r"^[a-zA-Z0-9]{6}$")
CHILD_SELECTOR_RE = re.compile(r"#[a-zA-Z0-9_-]+\s*>")
URL_IN_TEXT_RE = re.compile(r"https?://[^\s\"'()<>\\]+")


@dataclass
class ValidationIssue:
    gate: str
    level: str  # error | warn
    element_id: str
    message: str


@dataclass
class GateResult:
    gate: str
    passed: bool
    issues: list[ValidationIssue] = field(default_factory=list)

    def add(self, level: str, element_id: str, message: str) -> None:
        self.issues.append(ValidationIssue(self.gate, level, element_id, message))
        if level == "error":
            self.passed = False


def _elements_by_id(elements: list[dict]) -> dict[str, dict]:
    return {el["id"]: el for el in elements if el.get("id")}


def validate_element_tree(elements: list[dict]) -> GateResult:
    """G1 — parent/children consistency and basic structure."""
    result = GateResult(gate="G1", passed=True)
    by_id = _elements_by_id(elements)

    for el in elements:
        eid = el.get("id", "")
        if not eid or not ELEMENT_ID_RE.match(eid):
            result.add("error", eid or "?", f"Invalid element id (need exactly 6 alphanumeric): {eid!r}")

    seen: dict[str, str] = {}
    for el in elements:
        eid = el.get("id", "")
        if not eid or not ELEMENT_ID_RE.match(eid):
            continue
        if eid in seen:
            result.add("error", eid, f"duplicate element id (also on {seen[eid]})")
        else:
            seen[eid] = el.get("name") or "?"

    for el in elements:
        eid = el.get("id", "")
        parent = el.get("parent", 0)
        if parent not in (0, "0", None):
            parent_str = str(parent)
            if parent_str not in by_id:
                result.add("error", eid, f"parent {parent_str} not found")
            else:
                parent_children = by_id[parent_str].get("children") or []
                if eid not in parent_children:
                    result.add("error", eid, f"not listed in parent {parent_str} children")

        for child_id in el.get("children") or []:
            if child_id not in by_id:
                result.add("error", eid, f"child {child_id} not found")
            elif str(by_id[child_id].get("parent")) != str(eid):
                result.add("error", eid, f"child {child_id} parent mismatch")

        name = el.get("name", "")
        if name == "section":
            for child_id in el.get("children") or []:
                child = by_id.get(child_id, {})
                if child.get("name") in ("heading", "text-basic", "image", "button"):
                    result.add("error", eid, f"leaf {child_id} ({child.get('name')}) directly under section")

    return result


def validate_css_custom_blocks(elements: list[dict], *, strict: bool = True) -> GateResult:
    """G1 — _cssCustom syntax and element-type patterns."""
    result = GateResult(gate="G1", passed=True)

    for el in elements:
        eid = el.get("id", "")
        settings = el.get("settings") or {}
        css = settings.get("_cssCustom") or ""
        name = el.get("name", "")

        # --- CSS syntax checks ---
        if css and isinstance(css, str):
            if css.count("{") != css.count("}"):
                msg = "_cssCustom unbalanced braces: {=%d }=%d" % (css.count("{"), css.count("}"))
                result.add("error", eid, msg)

            if "{{" in css or "}}" in css:
                level = "error" if strict else "warn"
                result.add(
                    level,
                    eid,
                    "_cssCustom contains {{ or }} — invalid before upload (strict G1 on --json)",
                )

            if name == "container" and CHILD_SELECTOR_RE.search(css):
                result.add(
                    "warn",
                    eid,
                    "container + child selector (>) often fails to compile — prefer div/text-basic",
                )

        # --- Section gradient without _cssCustom mirror ---
        if name == "section":
            bg = settings.get("_background") or {}
            gradient = bg.get("gradient") or {}
            has_gradient_setting = bool(gradient.get("colors") or gradient.get("stops"))
            has_gradient_css = css and "gradient" in css.lower()
            if has_gradient_setting and not has_gradient_css:
                result.add(
                    "warn",
                    eid,
                    "section has _background.gradient but no gradient in _cssCustom — "
                    "Bricks may not compile gradient to external CSS. Mirror in _cssCustom.",
                )

        # --- div/block with flex settings but no display:flex in _cssCustom ---
        if name in ("div", "block"):
            has_flex_settings = bool(
                settings.get("_direction")
                or settings.get("_justifyContent")
                or settings.get("_alignItems")
            )
            has_display_flex = css and "display" in css and "flex" in css
            has_display_setting = bool(settings.get("_display"))
            if has_flex_settings and not has_display_flex and not has_display_setting:
                result.add(
                    "warn",
                    eid,
                    f"{name} has _direction/_justifyContent but no display:flex — "
                    "flex properties may not take effect. Add _display:'flex' or "
                    "display:flex in _cssCustom.",
                )

    return result


def _strings_in(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings_in(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings_in(item)


def validate_asset_urls(elements: list[dict], bound_urls: set[str] | None = None) -> GateResult:
    """G1 — Figma assets must be remote MCP URLs taken from the resolved node map.

    URLs are never re-fetched (rule 2): correctness is enforced statically instead.
    `bound_urls` = values of scripts/data/<slug>/assets.json; when given, a Figma URL
    outside it was typed or copied by hand and may point at another node's asset.
    """
    result = GateResult(gate="G1", passed=True)
    for el in elements:
        eid = el.get("id", "")
        for text in _strings_in(el.get("settings") or {}):
            if ASSET_PLACEHOLDER in text:
                result.add("error", eid, f"unresolved asset placeholder: {text[:80]}")
            for url in URL_IN_TEXT_RE.findall(text):
                if "localhost:3845" in url:
                    result.add("error", eid, f"localhost Figma asset (rule 2 dùng URL Figma MCP): {url}")
                elif "figma.com/api/mcp/asset" in url:
                    if not FIGMA_MCP_ASSET_RE.match(url):
                        result.add("error", eid, f"malformed Figma MCP asset URL: {url}")
                    elif bound_urls is not None and url not in bound_urls:
                        result.add("error", eid, f"Figma asset not bound to any node in assets.json: {url}")
    return result


def merge_gate_results(*results: GateResult) -> GateResult:
    merged = GateResult(gate=results[0].gate if results else "G1", passed=True)
    for r in results:
        merged.gate = r.gate
        merged.issues.extend(r.issues)
        if not r.passed:
            merged.passed = False
    return merged


def run_g1(
    elements: list[dict],
    *,
    strict_css: bool = True,
    bound_asset_urls: set[str] | None = None,
) -> GateResult:
    tree = validate_element_tree(elements)
    tree.gate = "G1"
    css = validate_css_custom_blocks(elements, strict=strict_css)
    css.gate = "G1"
    assets = validate_asset_urls(elements, bound_asset_urls)
    return merge_gate_results(tree, css, assets)


def collect_css_custom_snippets(elements: list[dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for el in elements:
        css = (el.get("settings") or {}).get("_cssCustom") or ""
        if css.strip():
            out[el["id"]] = css
    return out


def extract_rule_needles(css: str) -> list[str]:
    """Non-comment fragments likely to appear in compiled CSS."""
    needles: list[str] = []
    for block in css.split("}"):
        block = block.strip()
        if not block or block.startswith("/*"):
            continue
        if "{" in block:
            _, rules = block.split("{", 1)
        else:
            rules = block
        for part in rules.split(";"):
            part = part.strip()
            if part and not part.startswith("/*"):
                needles.append(part)
    return needles


def critical_needles_from_elements(
    elements: list[dict],
    extra_rules: Iterable[str] | None = None,
) -> list[tuple[str, str]]:
    """Return (element_id, rule_fragment) pairs that must appear in compiled output."""
    pairs: list[tuple[str, str]] = []
    for eid, css in collect_css_custom_snippets(elements).items():
        for needle in extract_rule_needles(css):
            if len(needle) >= 8 or ":" in needle:
                pairs.append((eid, needle))
    if extra_rules:
        for rule in extra_rules:
            rule = rule.strip()
            if rule:
                pairs.append(("spec", rule))
    return pairs


def validate_compiled_css(
    elements: list[dict],
    compiled: str,
    *,
    extra_rules: Iterable[str] | None = None,
) -> GateResult:
    """G2 — intent (_cssCustom) vs compiled CSS text."""
    result = GateResult(gate="G2", passed=True)
    if not compiled.strip():
        if collect_css_custom_snippets(elements):
            result.add("error", "-", "compiled CSS empty but template has _cssCustom")
        return result

    def css_norm(text: str) -> str:
        text = re.sub(r"\s+", " ", text)
        return re.sub(r":\s+", ":", text)

    compiled_norm = css_norm(compiled)

    for eid, css in collect_css_custom_snippets(elements).items():
        selector_hits = re.findall(r"(#brxe-[a-zA-Z0-9_-]+)", css)
        for sel in set(selector_hits):
            if sel not in compiled and sel.replace("#brxe-", "") not in compiled:
                result.add("warn", eid, f"selector {sel} not found in compiled CSS")

    for eid, needle in critical_needles_from_elements(elements, extra_rules):
        needle_norm = css_norm(needle)
        if needle_norm not in compiled_norm and needle not in compiled:
            result.add("error", eid, f"missing compiled rule: {needle!r}")

    return result
