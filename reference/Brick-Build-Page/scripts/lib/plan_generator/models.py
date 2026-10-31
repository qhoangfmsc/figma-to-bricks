"""Data models for auto-generated plans."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SectionDraft:
    index: int
    figma_name: str
    figma_node: str
    strategy: str
    mobile_differs: bool
    mobile_diff: str
    element_tree: str
    measurements: str
    settings_snapshot: list[str]
    asset_note: str = ""
    skip_build: bool = False
    template_id: int | None = None
    template_slug: str = ""
    slug_short: str = ""
    template_title: str = ""


@dataclass
class PlanDraft:
    page_title: str
    page_slug: str
    plan_filename: str
    figma_desktop_url: str
    figma_mobile_url: str | None
    figma_file_key: str
    page_frame_node: str
    evidence_dir: str
    design_tokens: list[str] = field(default_factory=list)
    sections: list[SectionDraft] = field(default_factory=list)
    page_id: int | None = None
    template_only: bool = False
