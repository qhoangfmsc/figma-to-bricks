#!/usr/bin/env python3
"""
Structural integrity check for Bricks pattern files (clipboard + template export formats).

Usage:
  python3 scripts/validate_pattern.py patterns/                 # every *.json under the folder
  python3 scripts/validate_pattern.py patterns/sections/cta-section.json
  python3 scripts/validate_pattern.py patterns/ --bricks-source /path/to/wp-content/themes/bricks

Checks:
  - JSON parses; format keys match clipboard (`source: bricksCopiedElements`) or template export (`type`)
  - element ids unique, `settings` is an object, `parent`/`children` reciprocal, single tree with roots at parent 0
  - element `name` exists in the registry of references/elements.md (or is a registered WooCommerce element)
  - every `_cssGlobalClasses` id is embedded in globalClasses / global_classes
  - `filterQueryId` / `queryId` / `syncQuery` point at an element that has `hasLoop` (or is a posts/carousel element)
  - with `--bricks-source`: every element-specific setting key (not `_` universal keys) appears in that
    element's PHP source, its parents (`base.php`, `filter-base.php`, `custom-render-element.php`) or the query
    controls. Catches invented or misspelled control keys; values are not checked.

Exit code 1 when any file fails.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
ELEMENTS_REFERENCE = SKILL_ROOT / "references" / "elements.md"

TEMPLATE_ELEMENT_KEY_BY_TYPE = {"header": "header", "footer": "footer"}
QUERY_REFERENCE_KEYS = ("filterQueryId", "queryId", "syncQuery")
# Elements that own a query without the `hasLoop` flag.
QUERY_OWNER_ELEMENTS = {"posts", "carousel", "related-posts"}


def load_registry() -> set[str]:
    """Element names come from the Registry section so the reference stays the single source of truth."""
    text = ELEMENTS_REFERENCE.read_text()
    registry_section = text.split("## Registry", 1)[1].split("\n## ", 1)[0]
    names: set[str] = set()
    for line in registry_section.splitlines():
        if line.startswith("**"):
            names.update(re.findall(r"`([a-z][a-z0-9-]*)`", line))
    return names


def detect_elements(data: dict) -> tuple[str, list[dict], list[dict], list[str]]:
    errors: list[str] = []
    if data.get("source") == "bricksCopiedElements":
        for key in ("content", "version", "globalClasses"):
            if key not in data:
                errors.append(f"clipboard format missing `{key}`")
        return "clipboard", data.get("content", []), data.get("globalClasses", []), errors

    template_type = data.get("type")
    if template_type:
        for key in ("name", "title", "templateSettings"):
            if key not in data:
                errors.append(f"template format missing `{key}`")
        element_key = TEMPLATE_ELEMENT_KEY_BY_TYPE.get(template_type, "content")
        if element_key not in data:
            errors.append(f"template type `{template_type}` must store elements in `{element_key}`")
        return f"template ({template_type})", data.get(element_key, []), data.get("global_classes", []), errors

    return "unknown", [], [], ["neither clipboard (`source`) nor template (`type`) format"]


def check_tree(elements: list[dict], registry: set[str]) -> list[str]:
    errors: list[str] = []
    by_id: dict[str, dict] = {}
    for element in elements:
        element_id = element.get("id")
        if element_id in by_id:
            errors.append(f"duplicate id `{element_id}`")
        by_id[element_id] = element
        for key in ("id", "name", "parent", "children", "settings"):
            if key not in element:
                errors.append(f"`{element_id}` missing `{key}`")
        if not isinstance(element.get("settings"), dict):
            errors.append(f"`{element_id}` settings must be an object")
        name = element.get("name", "")
        if name not in registry and not name.startswith("woocommerce-") and not name.startswith("product-"):
            errors.append(f"`{element_id}` unknown element name `{name}`")

    if not any(element.get("parent") == 0 for element in elements):
        errors.append("no root element (parent 0)")

    for element in elements:
        element_id = element.get("id")
        parent_id = element.get("parent")
        if parent_id != 0:
            parent = by_id.get(parent_id)
            if parent is None:
                errors.append(f"`{element_id}` orphan parent `{parent_id}`")
            elif element_id not in parent.get("children", []):
                errors.append(f"`{element_id}` not listed in children of `{parent_id}`")
        for child_id in element.get("children", []):
            child = by_id.get(child_id)
            if child is None:
                errors.append(f"`{element_id}` missing child `{child_id}`")
            elif child.get("parent") != element_id:
                errors.append(f"`{child_id}` parent is `{child.get('parent')}`, expected `{element_id}`")
    return errors


def check_classes(elements: list[dict], global_classes: list[dict]) -> list[str]:
    available = {global_class.get("id") for global_class in global_classes}
    errors = []
    for element in elements:
        for class_id in element.get("settings", {}).get("_cssGlobalClasses") or []:
            if class_id not in available:
                errors.append(f"`{element['id']}` references missing global class `{class_id}`")
    return errors


def check_query_references(elements: list[dict]) -> list[str]:
    query_owners = {
        element["id"]
        for element in elements
        if element.get("settings", {}).get("hasLoop") or element.get("name") in QUERY_OWNER_ELEMENTS
    }
    errors = []
    for element in elements:
        settings = element.get("settings", {})
        for key in QUERY_REFERENCE_KEYS:
            target = settings.get(key)
            # Main-query pagination on archive templates has no queryId on purpose.
            if target and target not in query_owners:
                errors.append(f"`{element['id']}` {key} `{target}` is not a query loop in this file")
    return errors


class BricksSourceIndex:
    """Lazily reads element PHP files so a key lookup is a plain substring search per element."""

    SHARED_SOURCES = ("base.php", "filter-base.php", "custom-render-element.php")
    # Settings consumed by the builder/query engine rather than declared as element controls.
    BUILDER_KEYS = {"hasLoop", "query", "label"}

    def __init__(self, theme_root: Path):
        self.elements_dir = theme_root / "includes" / "elements"
        if not self.elements_dir.is_dir():
            raise SystemExit(f"--bricks-source: {self.elements_dir} not found")
        self.shared_text = "".join(
            (self.elements_dir / name).read_text(errors="ignore")
            for name in self.SHARED_SOURCES
            if (self.elements_dir / name).exists()
        )
        self.cache: dict[str, str | None] = {}

    def element_text(self, name: str) -> str | None:
        if name not in self.cache:
            source_file = self.elements_dir / f"{name}.php"
            self.cache[name] = source_file.read_text(errors="ignore") if source_file.exists() else None
        return self.cache[name]

    def unknown_keys(self, element: dict) -> list[str]:
        element_text = self.element_text(element.get("name", ""))
        if element_text is None:
            return []
        searchable = element_text + self.shared_text
        unknown = []
        for raw_key in element.get("settings", {}):
            # Breakpoint / pseudo suffixes (`columns:tablet_portrait`) share the base control key.
            key = raw_key.split(":", 1)[0]
            if key.startswith("_") or key in self.BUILDER_KEYS:
                continue
            if f"'{key}'" not in searchable:
                unknown.append(raw_key)
        return unknown


def check_source_keys(elements: list[dict], source_index: BricksSourceIndex) -> list[str]:
    errors = []
    for element in elements:
        for key in source_index.unknown_keys(element):
            errors.append(f"`{element['id']}` ({element['name']}) setting `{key}` not found in Bricks source")
    return errors


def validate_file(path: Path, registry: set[str], source_index: BricksSourceIndex | None = None) -> list[str]:
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as error:
        return [f"invalid JSON: {error}"]
    if not isinstance(data, dict):
        return ["top level must be an object"]

    _, elements, global_classes, errors = detect_elements(data)
    errors += check_tree(elements, registry)
    errors += check_classes(elements, global_classes)
    errors += check_query_references(elements)
    if source_index:
        errors += check_source_keys(elements, source_index)
    return errors


def collect_files(targets: list[str]) -> list[Path]:
    files: list[Path] = []
    for target in targets:
        path = Path(target)
        files.extend(sorted(path.rglob("*.json")) if path.is_dir() else [path])
    return files


def parse_arguments(arguments: list[str]) -> tuple[list[str], BricksSourceIndex | None]:
    targets: list[str] = []
    source_index = None
    iterator = iter(arguments)
    for argument in iterator:
        if argument == "--bricks-source":
            source_index = BricksSourceIndex(Path(next(iterator, "")).expanduser())
        else:
            targets.append(argument)
    return targets, source_index


def main() -> int:
    targets, source_index = parse_arguments(sys.argv[1:])
    if not targets:
        print(__doc__)
        return 2
    registry = load_registry()
    failed = 0
    for path in collect_files(targets):
        errors = validate_file(path, registry, source_index)
        if errors:
            failed += 1
            print(f"FAIL {path}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK   {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
