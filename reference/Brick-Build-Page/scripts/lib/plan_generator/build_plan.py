"""Generate full plan from Figma URL (Phase C core)."""
from __future__ import annotations

import json
from pathlib import Path

from scripts.lib.figma_api import (
    build_figma_url,
    fetch_file_meta,
    fetch_node_tree,
    parse_figma_url,
)
from scripts.lib.plan_generator.models import PlanDraft
from scripts.lib.plan_generator.render import render_plan_markdown
from scripts.lib.plan_generator.sections import extract_sections
from scripts.lib.plan_generator.shell import create_wp_shell
from scripts.lib.plan_generator.tokens import collect_tokens_from_nodes
from scripts.lib.plan_generator.work_info import slugify_page_name

ROOT = Path(__file__).resolve().parents[3]


def plan_data_slug(plan_filename: str) -> str:
    # Must mirror the slug readers use (generic_builder, g4_refix, g4_auto_patch).
    return Path(plan_filename).stem.replace("page-", "")


def _save_figma_context(data_slug: str, sections: list, file_key: str, token: str) -> None:
    from scripts.lib.figma_api import fetch_node_tree

    out_dir = ROOT / "scripts" / "data" / data_slug / "figma"
    out_dir.mkdir(parents=True, exist_ok=True)
    for section in sections:
        if section.skip_build:
            continue
        try:
            tree = fetch_node_tree(file_key, section.figma_node, token, depth=3)
            slug = section.figma_node.replace(":", "-")
            (out_dir / f"{slug}.json").write_text(json.dumps(tree, ensure_ascii=False, indent=2))
        except RuntimeError:
            continue


def generate_plan_from_figma(
    *,
    figma_desktop_url: str,
    page_title: str,
    figma_mobile_url: str | None = None,
    figma_token: str,
    page_frame_node: str | None = None,
    create_shell: bool = False,
    dry_run: bool = False,
    save_context: bool = True,
    template_only: bool = False,
    multi_section: bool = False,
) -> tuple[PlanDraft, str]:
    """Build a plan draft from a Figma frame.

    Page mode treats the frame's children as sections. Template-only mode treats the
    frame itself as one section unless ``multi_section`` is set, so a link copied from
    a single section never gets split into its inner rows.
    """
    parsed = parse_figma_url(figma_desktop_url)
    file_key = parsed.file_key
    frame_node = page_frame_node or parsed.node_id
    if not frame_node:
        meta = fetch_file_meta(file_key, figma_token)
        doc = meta.get("document") or {}
        canvases = doc.get("children") or []
        if not canvases:
            raise RuntimeError("Figma file has no pages — specify --page-node")
        frame_node = canvases[0].get("id")

    page_node = fetch_node_tree(file_key, frame_node, figma_token, depth=2)
    page_slug = slugify_page_name(page_title)
    file_name = page_slug
    plan_filename = f"template-{page_slug}.md" if template_only else f"page-{page_slug}.md"

    single_section = template_only and not multi_section
    section_root = {"children": [page_node]} if single_section else page_node
    sections = extract_sections(section_root, page_slug)
    if not any(not s.skip_build for s in sections):
        if template_only:
            raise RuntimeError(
                "No buildable section in Figma node (header/footer are excluded by rule 1)"
            )
        raise RuntimeError("No buildable sections found in Figma page frame")

    if template_only:
        for s in sections:
            if s.skip_build:
                continue
            s.template_title = page_title if single_section else f"{page_title} - {s.figma_name}"

    section_nodes = []
    for s in sections:
        if s.skip_build:
            continue
        try:
            section_nodes.append(fetch_node_tree(file_key, s.figma_node, figma_token, depth=2))
        except RuntimeError:
            pass

    draft = PlanDraft(
        page_title=page_title,
        page_slug=page_slug,
        plan_filename=plan_filename,
        figma_desktop_url=build_figma_url(file_key, file_name, frame_node),
        figma_mobile_url=figma_mobile_url,
        figma_file_key=file_key,
        page_frame_node=frame_node,
        evidence_dir=f"notes/{plan_data_slug(plan_filename) if template_only else page_slug}/assets/bricks",
        design_tokens=collect_tokens_from_nodes(section_nodes),
        sections=sections,
        template_only=template_only,
    )

    if create_shell:
        draft = create_wp_shell(draft, dry_run=dry_run)

    markdown = render_plan_markdown(draft)

    if save_context and not dry_run:
        _save_figma_context(plan_data_slug(plan_filename), sections, file_key, figma_token)

    return draft, markdown
