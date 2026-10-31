"""Canonical section order from Figma frame metadata (top-level children, sort by y)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FigmaSectionSlot:
    index: int
    figma_name: str
    figma_node: str
    plan_slug: str
    label: str
    template_id: int | None = None
    build: bool = True
    note: str = ""


# Frame 5:23441 — Landing Page (get_metadata, y ascending). Footer excluded (rule 1).
LDP_TEMPLATE_V2_ORDER: tuple[FigmaSectionSlot, ...] = (
    FigmaSectionSlot(1, "Hero section", "5:23442", "hero", "Hero", 8111),
    FigmaSectionSlot(2, "Section 1", "5:23710", "section-1", "Section 1", 8112),
    FigmaSectionSlot(3, "Section 2", "14:9434", "bento", "Bento", 8113),
    FigmaSectionSlot(4, "Section 3", "14:9279", "speakers", "Speakers", 8116),
    FigmaSectionSlot(5, "Section 4", "14:9652", "trusted", "Trusted", 8118),
    FigmaSectionSlot(6, "Section 5", "13:7758", "compare", "Compare", 8114),
    FigmaSectionSlot(7, "Section 6", "14:9358", "partners", "Partners", 8119),
    FigmaSectionSlot(8, "Sự kiện đã tham gia", "77:1228", "events", "Sự kiện đã tham gia", 8120),
    FigmaSectionSlot(9, "Section 7", "8:3870", "contact", "Contact", 8115),
    FigmaSectionSlot(
        10,
        "Floating button",
        "14:10964",
        "floating",
        "Floating Buttons",
        8117,
        note="fixed overlay — cuối page content, trước Footer Figma",
    ),
    FigmaSectionSlot(
        11,
        "Frame 1000009317",
        "14:16918",
        "footer",
        "Footer",
        build=False,
        note="rule 1 — không build trừ khi user yêu cầu",
    ),
)


def buildable_slots(slots: tuple[FigmaSectionSlot, ...] = LDP_TEMPLATE_V2_ORDER) -> list[FigmaSectionSlot]:
    return [s for s in slots if s.build and s.template_id is not None]


def slug_to_template_id(slots: tuple[FigmaSectionSlot, ...] = LDP_TEMPLATE_V2_ORDER) -> dict[str, int]:
    return {s.plan_slug: int(s.template_id) for s in buildable_slots(slots)}


def template_id_to_slug(slots: tuple[FigmaSectionSlot, ...] = LDP_TEMPLATE_V2_ORDER) -> dict[int, str]:
    return {int(s.template_id): s.plan_slug for s in buildable_slots(slots)}
