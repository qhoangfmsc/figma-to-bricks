"""Heuristic auto-patches when G4 fails — baseline spacing/typography from Figma plan patterns."""
from __future__ import annotations

import json
from pathlib import Path

from scripts.lib.g4_refix import find_patch_files
from scripts.lib.generic_builder.build import load_cached_tree
from scripts.lib.plan_parser import SectionSpec

ROOT = Path(__file__).resolve().parents[2]

# Common desktop header: container rowGap 48 + title + subtitle → Figma gap 16 + pb 48
HEADER_SUBTITLE_PATCH = {
    "_cssCustom": "#brxe-{eid}{{margin-top:-32px;}}",
    "_typography": {
        "font-size": "16px",
        "text-align": "center",
        "line-height": "25.6px",
        "letter-spacing": "-0.32px",
        "color": {"hex": "#374151"},
    },
}

TITLE_TYPO_PATCH = {
    "_typography": {
        "font-size": "44px",
        "font-weight": "500",
        "text-align": "center",
        "line-height": "normal",
        "letter-spacing": "-0.44px",
        "color": {"hex": "#374151"},
    }
}


def _patch_dir(plan_path: Path) -> Path:
    slug = plan_path.stem.replace("page-", "")
    return ROOT / "scripts" / "data" / slug / "patches"


def _find_header_subtitle(elements: list[dict]) -> str | None:
    """First text-basic/p under container that follows a heading sibling."""
    by_id = {e["id"]: e for e in elements}
    for el in elements:
        if el.get("name") != "container":
            continue
        children = el.get("children") or []
        for i, cid in enumerate(children):
            child = by_id.get(cid)
            if not child or child.get("name") != "heading":
                continue
            if i + 1 < len(children):
                nxt = by_id.get(children[i + 1])
                if nxt and nxt.get("name") in ("text-basic", "text"):
                    return nxt["id"]
    return None


def _find_main_heading(elements: list[dict]) -> str | None:
    for el in elements:
        if el.get("name") == "heading" and el.get("parent") not in (0, "0"):
            settings = el.get("settings") or {}
            if settings.get("tag") == "h2":
                return el["id"]
    return None


def try_write_baseline_patch(spec: SectionSpec, plan_path: Path) -> Path | None:
    """
    If no patch file exists, create baseline spacing/typography patch from tree structure.
    Returns patch path when created or updated.
    """
    if not spec.template_id:
        return None
    tree = load_cached_tree(plan_path, spec)
    if not tree:
        return None

    patch_path = _patch_dir(plan_path) / f"{spec.template_id}.json"
    existing: dict = {}
    if patch_path.is_file():
        existing = json.loads(patch_path.read_text())

    generated: dict[str, dict] = {}
    sub_id = _find_header_subtitle(tree)
    if sub_id and sub_id not in existing:
        entry = dict(HEADER_SUBTITLE_PATCH)
        css = entry.pop("_cssCustom", "").format(eid=sub_id)
        entry["_cssCustom"] = css
        generated[sub_id] = entry

    h_id = _find_main_heading(tree)
    if h_id and h_id not in existing:
        generated[h_id] = dict(TITLE_TYPO_PATCH)

    if not generated:
        return None

    merged = {**existing, **generated}
    patch_path.parent.mkdir(parents=True, exist_ok=True)
    patch_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2))
    return patch_path


def has_patch_file(plan_path: Path, template_id: int) -> bool:
    return bool(find_patch_files(plan_path, template_id))
