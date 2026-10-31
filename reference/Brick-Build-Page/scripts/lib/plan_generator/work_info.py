"""Read and update work_info.md after PLAN."""
from __future__ import annotations

import re
from pathlib import Path

from scripts.lib.plan_generator.models import PlanDraft

FIGMA_DESKTOP_RE = re.compile(r"Figma Desktop URL:\s*(\S+)", re.I)
FIGMA_MOBILE_RE = re.compile(r"Figma Mobile/Breakpoint URL:\s*(.+)", re.I)
PAGE_NAME_RE = re.compile(r"Tên Page:\s*(.+)", re.I)


def read_work_info(path: Path) -> dict[str, str]:
    text = path.read_text()
    figma = FIGMA_DESKTOP_RE.search(text)
    mobile = FIGMA_MOBILE_RE.search(text)
    page = PAGE_NAME_RE.search(text)
    return {
        "figma_desktop_url": figma.group(1).strip() if figma else "",
        "figma_mobile_url": mobile.group(1).strip() if mobile else "",
        "page_name": page.group(1).strip() if page else "",
        "raw": text,
    }


def slugify_page_name(name: str) -> str:
    import unicodedata

    text = unicodedata.normalize("NFKD", name)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return text or "page"


def render_work_info_analysis(draft: PlanDraft, plan_rel: str) -> str:
    buildable = [s for s in draft.sections if not s.skip_build]
    lines = [
        "",
        "## Thông tin sau phân tích",
        "",
        f"- Plan file: `{plan_rel}`",
    ]
    if draft.page_id:
        lines.append(f"- Page ID: **{draft.page_id}** · URL: http://localhost:8000/?page_id={draft.page_id}")
    else:
        lines.append("- Page ID: **TBD** — chạy `--create-shell` hoặc tạo page MCP thủ công")
    lines.append("- Các template không cần build layout:")
    lines.append("  - *(build tất cả section trong plan trừ Footer)*")
    lines.append("")
    lines.append(f"**Thứ tự section (Figma frame `{draft.page_frame_node}` → Page → DO):**")
    lines.append("")
    lines.append("| # | Figma name | Node | Template ID | Chiến lược |")
    lines.append("|---|------------|------|-------------|------------|")
    for s in draft.sections:
        if s.skip_build:
            lines.append(f"| — | {s.figma_name} *(rule 1)* | `{s.figma_node}` | — | — |")
        else:
            tid = str(s.template_id) if s.template_id else "TBD"
            lines.append(f"| {s.index} | {s.figma_name} | `{s.figma_node}` | {tid} | {s.strategy} |")
    lines.extend(
        [
            "",
            f"Page order JSON: `snippets/page-{draft.page_slug}-order.json`",
            "",
            "**Trạng thái:** PLAN auto (Phase C) — chờ user xác nhận trước DO/autopilot.",
            "",
        ]
    )
    return "\n".join(lines)


def update_work_info(path: Path, draft: PlanDraft, plan_rel: str) -> None:
    data = read_work_info(path)
    text = data["raw"]
    block = render_work_info_analysis(draft, plan_rel)

    if "## Thông tin sau phân tích" in text:
        text = re.sub(
            r"\n## Thông tin sau phân tích[\s\S]*?(?=\n## |\Z)",
            block + "\n",
            text,
            count=1,
        )
    else:
        text = text.rstrip() + "\n" + block

    path.write_text(text)
