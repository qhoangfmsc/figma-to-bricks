"""Extract section frames from Figma page node."""
from __future__ import annotations

from typing import Any

from scripts.lib.figma_api import bbox_size, bbox_y
from scripts.lib.plan_generator.models import SectionDraft
from scripts.lib.plan_generator.strategy import (
    default_mobile_diff,
    infer_strategy,
    is_footer_section,
    is_floating_section,
)
from scripts.lib.plan_generator.tree_draft import draft_element_tree

SECTION_TYPES = {"FRAME", "COMPONENT", "INSTANCE", "GROUP", "SECTION"}


def _slugify(text: str) -> str:
    import re
    import unicodedata

    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return text or "section"


def extract_sections(page_node: dict[str, Any], page_slug: str) -> list[SectionDraft]:
    children = [c for c in (page_node.get("children") or []) if c.get("type") in SECTION_TYPES]
    children.sort(key=bbox_y)

    sections: list[SectionDraft] = []
    build_index = 0

    for child in children:
        name = (child.get("name") or "Section").strip()
        node_id = child.get("id", "")
        if is_footer_section(name):
            sections.append(
                SectionDraft(
                    index=0,
                    figma_name=name,
                    figma_node=node_id,
                    strategy="n/a",
                    mobile_differs=False,
                    mobile_diff="",
                    element_tree="",
                    measurements="",
                    settings_snapshot=[],
                    skip_build=True,
                )
            )
            continue

        build_index += 1
        strategy = infer_strategy(name, child)
        mobile_differs, mobile_diff = default_mobile_diff(strategy, name)
        w, h = bbox_size(child)
        measurements = f"- frame ~{int(w)}×{int(h)}px · node `{node_id}`"
        if strategy == "slider-responsive":
            measurements += " · carousel/slider layout"

        sec_id = f"sec{build_index:03d}"
        settings = [
            f"{sec_id}: `_padding.top/bottom: 100` (adjust from Figma)",
        ]
        if strategy == "slider-responsive":
            settings.append("sld: `perPage: 3` · `gap: 24` · `perPage:tablet_portrait: 1`")
        if strategy == "breakpoint-only":
            settings.append("con: `_widthMax: 1140` · row `_direction:tablet_portrait: column`")

        slug_short = _slugify(name)[:40]
        template_slug = f"{page_slug}-{slug_short}"

        sections.append(
            SectionDraft(
                index=build_index,
                figma_name=name,
                figma_node=node_id,
                strategy=strategy,
                mobile_differs=mobile_differs,
                mobile_diff=mobile_diff,
                element_tree=draft_element_tree(build_index, child, strategy),
                measurements=measurements,
                settings_snapshot=settings,
                asset_note="Warm-up Figma Desktop → `check_assets.py` fills localhost URLs",
                slug_short=slug_short,
                template_slug=template_slug,
            )
        )

    # Floating sections should be last among buildable (rule 52)
    buildable = [s for s in sections if not s.skip_build]
    floating = [s for s in buildable if is_floating_section(s.figma_name)]
    normal = [s for s in buildable if not is_floating_section(s.figma_name)]
    ordered = normal + floating
    footers = [s for s in sections if s.skip_build]

    reindexed: list[SectionDraft] = []
    for i, s in enumerate(ordered, start=1):
        s.index = i
        reindexed.append(s)
    reindexed.extend(footers)
    return reindexed
