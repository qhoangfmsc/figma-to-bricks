"""Apply tree patches after G4 fail — cached tree + autofix + patch JSON → upload."""
from __future__ import annotations

import json
from pathlib import Path

from scripts.lib.bricks_mcp import generate_css_file, get_template, patch_elements, set_template_content
from scripts.lib.generic_builder.build import load_cached_tree, save_cached_tree
from scripts.lib.plan_parser import SectionSpec
from scripts.lib.section_autofix import autofix_template

ROOT = Path(__file__).resolve().parents[2]


def _plan_slug(plan_path: Path) -> str:
    return plan_path.stem.replace("page-", "")


def find_patch_files(plan_path: Path, template_id: int) -> list[Path]:
    slug = _plan_slug(plan_path)
    candidates = [
        ROOT / "scripts" / "data" / slug / "patches" / f"{template_id}.json",
        ROOT / "snippets" / "patches" / f"{template_id}.json",
        ROOT / "snippets" / "patches" / f"{slug}-{template_id}.json",
    ]
    return [p for p in candidates if p.is_file()]


def merge_patches_into_cached_tree(spec: SectionSpec, plan_path: Path) -> bool:
    """Merge patch JSON into cached tree file (idempotent)."""
    paths = find_patch_files(plan_path, spec.template_id)
    if not paths:
        return False
    tree = load_cached_tree(plan_path, spec)
    if not tree:
        return False
    merged = tree
    for pf in paths:
        merged = patch_elements(merged, json.loads(pf.read_text()))
    save_cached_tree(plan_path, spec, merged)
    return True


def _load_working_elements(spec: SectionSpec, plan_path: Path) -> tuple[list[dict], str]:
    merge_patches_into_cached_tree(spec, plan_path)
    tree = load_cached_tree(plan_path, spec)
    if tree:
        return json.loads(json.dumps(tree)), "cached-tree"
    data = get_template(spec.template_id)
    return json.loads(json.dumps(data.get("elements", []))), "live"


def apply_g4_refix(
    spec: SectionSpec,
    plan_path: Path,
    *,
    apply_patch_files: bool = True,
) -> tuple[bool, list[str]]:
    """
    Autofix + optional patch JSON on cached tree → sync file → upload if changed vs live.
    Returns (changed, log lines).
    """
    template_id = spec.template_id
    if not template_id:
        return False, []

    elements, source = _load_working_elements(spec, plan_path)
    log: list[str] = [f"base {source}"]

    live = get_template(template_id).get("elements", [])
    live_json = json.dumps(live, sort_keys=True)

    elements, autofix_changes = autofix_template(template_id, elements, spec)
    for change in autofix_changes:
        log.append(f"autofix [{change.element_id}] {change.reason}")

    if apply_patch_files:
        for patch_path in find_patch_files(plan_path, template_id):
            patches = json.loads(patch_path.read_text())
            before = json.dumps(elements, sort_keys=True)
            elements = patch_elements(elements, patches)
            if json.dumps(elements, sort_keys=True) != before:
                log.append(f"patch {patch_path.relative_to(ROOT)}")

    out_json = json.dumps(elements, sort_keys=True)
    if out_json == live_json:
        save_cached_tree(plan_path, spec, elements)
        return False, log

    tree_path = save_cached_tree(plan_path, spec, elements)
    result = set_template_content(template_id, elements, sync_css=True)
    generate_css_file(template_id=template_id)
    saved = result.get("saved_elements", len(elements))
    if tree_path:
        log.append(f"synced → {tree_path.relative_to(ROOT)}")
    log.append(f"uploaded {saved} elements")
    return True, log
