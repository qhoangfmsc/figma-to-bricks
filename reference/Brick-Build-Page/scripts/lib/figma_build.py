"""
Correct build pattern for Figma → Bricks section templates (rule 30, 45, 48).

Independent builder MUST:
1. Read section spec from plan (Settings snapshot + Mobile diff + measurements)
2. Pull Figma context via MCP get_design_context(node_id) — not get_template(foreign_id)
3. Assemble element tree from scratch; upload only to template IDs in the current plan

Anti-pattern (blocked by build_guard):
  get_template(v1_id) → deepcopy → set_template_content(v2_id)
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from scripts.lib.plan_parser import SectionSpec, section_by_template_id


@dataclass
class SectionBuildContext:
    template_id: int
    figma_node: str
    spec: SectionSpec
    plan_path: Path


def load_section_context(plan_path: str | Path, template_id: int) -> SectionBuildContext:
    path = Path(plan_path)
    spec = section_by_template_id(path, template_id)
    if not spec:
        raise ValueError(f"template_id {template_id} not found in {path}")
    if not spec.figma_desktop:
        raise ValueError(f"Section {spec.name}: missing Figma node desktop in plan")
    if not spec.has_settings_snapshot and not spec.has_element_tree:
        raise ValueError(
            f"Section {spec.name}: missing ### Settings snapshot or ### Cấu trúc element (rule 42)"
        )
    return SectionBuildContext(
        template_id=template_id,
        figma_node=spec.figma_desktop,
        spec=spec,
        plan_path=path,
    )


def require_figma_source_note() -> str:
    return (
        "Builder must call Figma MCP get_design_context for figma_node, "
        "then map to Bricks elements per Settings snapshot — never clone another page's template."
    )
