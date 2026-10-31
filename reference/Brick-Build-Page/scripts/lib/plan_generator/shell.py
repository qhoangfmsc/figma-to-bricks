"""Create WordPress page + section templates via Bricks MCP."""
from __future__ import annotations

import json
import re
from pathlib import Path

from scripts.lib.bricks_mcp import (
    create_page,
    create_template,
    get_site_info,
    list_pages,
    list_templates,
    set_page_content,
)
from scripts.lib.element_ids import ElementIdFactory
from scripts.lib.plan_generator.models import PlanDraft, SectionDraft

ROOT = Path(__file__).resolve().parents[3]


def _unique_title(base: str, existing: set[str]) -> str:
    if base not in existing:
        return base
    m = re.match(r"^(.*?)(?:\s+(\d+))?$", base.strip())
    stem = m.group(1) if m else base
    n = int(m.group(2)) + 1 if m and m.group(2) else 2
    while f"{stem} {n}" in existing:
        n += 1
    return f"{stem} {n}"


def _collect_titles(items: list[dict], key: str) -> set[str]:
    return {str(i.get(key, "")).strip() for i in items if i.get(key)}


def create_wp_shell(draft: PlanDraft, *, dry_run: bool = False) -> PlanDraft:
    if dry_run:
        return draft

    get_site_info()
    templates = list_templates().get("templates") or []
    template_titles = _collect_titles(templates, "title")

    if draft.template_only:
        return _create_templates_only(draft, template_titles)

    pages = list_pages().get("pages") or []
    page_titles = _collect_titles(pages, "title")

    page_title = _unique_title(draft.page_title, page_titles)
    page_result = create_page(page_title, slug=draft.page_slug, status="draft")
    draft.page_id = int(page_result["page_id"])
    draft.page_title = page_title

    buildable = [s for s in draft.sections if not s.skip_build]
    for section in buildable:
        tpl_title = _unique_title(f"{page_title} - {section.figma_name}", template_titles)
        template_titles.add(tpl_title)
        result = create_template(tpl_title, template_type="section")
        section.template_id = int(result["template_id"])

    page_elements = build_page_template_elements(draft.page_id, buildable)
    set_page_content(draft.page_id, page_elements)

    snippets_dir = ROOT / "snippets"
    snippets_dir.mkdir(parents=True, exist_ok=True)
    order_path = snippets_dir / f"page-{draft.page_slug}-order.json"
    order_path.write_text(json.dumps(page_elements, ensure_ascii=False, indent=2))

    return draft


def _create_templates_only(draft: PlanDraft, template_titles: set[str]) -> PlanDraft:
    for section in draft.sections:
        if section.skip_build:
            continue
        tpl_title = _unique_title(section.template_title or section.figma_name, template_titles)
        template_titles.add(tpl_title)
        result = create_template(tpl_title, template_type="section")
        section.template_id = int(result["template_id"])
        section.template_title = tpl_title
    return draft


def build_page_template_elements(page_id: int, sections: list[SectionDraft]) -> list[dict]:
    factory = ElementIdFactory(page_id)
    elements: list[dict] = []
    for section in sections:
        if not section.template_id:
            continue
        eid = factory.next()
        label = section.figma_name
        elements.append(
            {
                "id": eid,
                "name": "template",
                "parent": 0,
                "children": [],
                "label": label,
                "settings": {
                    "template": section.template_id,
                    "_label": label,
                },
            }
        )
    return elements
