"""Build Bricks section JSON from plan — generic entry (Phase B)."""
from __future__ import annotations

import json
from pathlib import Path

from scripts.lib.generic_builder.emitter import apply_measurements, emit_bricks_elements
from scripts.lib.generic_builder.figma_context import extract_image_urls, load_figma_context
from scripts.lib.generic_builder.plan_sections import parse_section_plan_spec
from scripts.lib.generic_builder.settings_parser import parse_settings_snapshot
from scripts.lib.generic_builder.tree_parser import parse_element_tree
from scripts.lib.plan_parser import SectionSpec, section_by_template_id

ROOT = Path(__file__).resolve().parents[3]


def _plan_slug(plan_path: Path) -> str:
    name = plan_path.stem
    return name.replace("page-", "")


def cached_tree_paths(plan_path: Path, spec: SectionSpec) -> list[Path]:
    slug = _plan_slug(plan_path)
    paths: list[Path] = []
    if spec.template_id:
        paths.append(ROOT / "scripts" / "data" / slug / "trees" / f"{spec.template_id}.json")
    if spec.slug:
        short = spec.slug.split("-")[-1] if spec.slug else ""
        paths.append(ROOT / "scripts" / "data" / slug / "trees" / f"{short}.json")
        paths.append(ROOT / "scripts" / "data" / slug / "trees" / f"{spec.slug}.json")
    # LDP V2 live trees (backward compat during migration)
    legacy_slug = _legacy_ldp_slug(spec)
    if legacy_slug:
        paths.append(ROOT / "scripts" / "lib" / "ldp_v2" / "live" / "trees" / f"{legacy_slug}.json")
    return paths


def _legacy_ldp_slug(spec: SectionSpec) -> str | None:
    """Map LDP V2 template slugs to live/trees filenames."""
    if not spec.slug or "ldp-template-v2" not in spec.slug:
        return None
    tail = spec.slug.replace("ldp-template-v2-", "")
    aliases = {"su-kien-da-tham-gia": "events", "section-1": "section-1"}
    return aliases.get(tail, tail)


def load_cached_tree(plan_path: Path, spec: SectionSpec) -> list[dict] | None:
    for path in cached_tree_paths(plan_path, spec):
        if path.is_file():
            return json.loads(path.read_text())
    return None


def save_cached_tree(plan_path: Path, spec: SectionSpec, elements: list[dict]) -> Path | None:
    if not spec.template_id:
        return None
    slug = _plan_slug(plan_path)
    path = ROOT / "scripts" / "data" / slug / "trees" / f"{spec.template_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(elements, ensure_ascii=False, indent=2))
    return path


def build_from_plan_tree(plan_path: Path, spec: SectionSpec) -> list[dict]:
    plan_spec = parse_section_plan_spec(spec.body)
    root = parse_element_tree(plan_spec.element_tree_text)
    if root is None:
        raise ValueError(f"Section {spec.name}: empty ### Cấu trúc element tree")

    settings_map = parse_settings_snapshot(plan_spec.settings_snapshot_lines)
    asset_urls = list(plan_spec.asset_urls)

    ctx = load_figma_context(plan_path, spec.figma_desktop)
    if ctx:
        for url in extract_image_urls(ctx):
            if url not in asset_urls:
                asset_urls.append(url)

    if not spec.template_id:
        raise ValueError(f"Section {spec.name}: missing template_id")

    elements = emit_bricks_elements(
        root,
        template_id=spec.template_id,
        settings_by_semantic=settings_map,
        asset_urls=asset_urls,
        section_label=spec.name,
    )
    apply_measurements(elements, plan_spec.measurements_text)
    return elements


def build_section_from_plan(plan_path: str | Path, template_id: int) -> list[dict]:
    """
    Resolution order:
    1. Cached full tree (scripts/data/{plan}/trees/*.json or ldp live trees)
    2. Generic build from plan ### Cấu trúc element + Settings snapshot
    """
    path = Path(plan_path)
    spec = section_by_template_id(path, template_id)
    if not spec:
        raise ValueError(f"template_id {template_id} not in {path}")

    cached = load_cached_tree(path, spec)
    if cached:
        return cached

    return build_from_plan_tree(path, spec)
