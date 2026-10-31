"""Extract structured blocks from plan section body."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

CODE_FENCE_RE = re.compile(r"```(?:\w*\n)?(.*?)```", re.S)
ASSET_URL_RE = re.compile(r"(https?://localhost:3845/assets/[a-f0-9]+\.(?:png|svg|jpg|webp))", re.I)
BULLET_SETTING_RE = re.compile(r"^\s*-\s*(.+)$", re.M)


@dataclass
class SectionPlanSpec:
    element_tree_text: str = ""
    settings_snapshot_lines: list[str] = field(default_factory=list)
    asset_urls: list[str] = field(default_factory=list)
    measurements_text: str = ""
    mobile_diff_text: str = ""


def _block_after(heading: str, body: str) -> str:
    pattern = re.compile(rf"^###\s+{re.escape(heading)}\s*$", re.M | re.I)
    match = pattern.search(body)
    if not match:
        return ""
    start = match.end()
    next_heading = re.search(r"^###\s+", body[start:], re.M)
    end = start + next_heading.start() if next_heading else len(body)
    return body[start:end].strip()


def parse_section_plan_spec(body: str) -> SectionPlanSpec:
    spec = SectionPlanSpec()

    tree_block = _block_after("Cấu trúc element", body)
    fence = CODE_FENCE_RE.search(tree_block)
    spec.element_tree_text = (fence.group(1) if fence else tree_block).strip()

    snapshot = _block_after("Settings snapshot", body)
    spec.settings_snapshot_lines = [
        m.group(1).strip()
        for m in BULLET_SETTING_RE.finditer(snapshot)
        if m.group(1).strip() and not m.group(1).strip().startswith("|")
    ]

    assets = _block_after("Assets", body)
    seen: set[str] = set()
    for url in ASSET_URL_RE.findall(assets):
        if url not in seen:
            seen.add(url)
            spec.asset_urls.append(url)

    spec.measurements_text = _block_after("Measurements", body)
    spec.mobile_diff_text = _block_after("Mobile diff", body)
    return spec
