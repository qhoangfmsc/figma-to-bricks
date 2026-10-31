"""Render PlanDraft → plans/page-*.md or plans/template-*.md markdown."""
from __future__ import annotations

from scripts.lib.plan_generator.models import PlanDraft, SectionDraft


def _section_header(section: SectionDraft) -> str:
    return f"## Section {section.index:02d} — {section.figma_name} *(Figma #{section.index} — {section.figma_name})*"


def render_section_block(section: SectionDraft, *, has_figma_mobile: bool) -> str:
    if section.skip_build:
        return (
            f"\n---\n\n<!-- Footer excluded rule 1: {section.figma_name} `{section.figma_node}` -->\n"
        )

    mobile_flag = "có" if section.mobile_differs else "không"
    tpl_line = f"- Template ID: **{section.template_id}**" if section.template_id else "- Template ID: **TBD**"

    lines = [
        "",
        "---",
        "",
        _section_header(section),
        "",
        tpl_line,
    ]
    if section.template_title:
        lines.append(f"- Template name: {section.template_title}")
    lines += [
        f"- Template slug: `{section.template_slug}`",
        f"- Figma node desktop: `{section.figma_node}`",
    ]
    if has_figma_mobile:
        lines.append(f"- Figma node mobile: `{section.figma_node}`")
        lines.append(f"- Mobile khác desktop?: `{mobile_flag}`")
    lines.extend(
        [
            f"- Chiến lược mobile: `{section.strategy}`",
        ]
    )
    if has_figma_mobile:
        lines.append(f"- Mobile diff: {section.mobile_diff}")
    lines.extend(
        [
            "",
            "### Cấu trúc element",
            "",
            "```",
            section.element_tree,
            "```",
            "",
            "### Measurements (Figma desktop)",
            "",
            section.measurements,
            "",
        ]
    )
    if has_figma_mobile:
        lines.extend(
            [
                "### Mobile diff (@991px)",
                "",
                f"- {section.mobile_diff}",
                "",
            ]
        )
    lines.extend(
        [
            "### Settings snapshot",
            "",
        ]
    )
    for item in section.settings_snapshot:
        lines.append(f"- {item}")
    lines.extend(
        [
            "",
            "### G4 acceptance checklist",
            "",
            "| Tiêu chí | Pass |",
            "|----------|------|",
            f"| Desktop layout khớp Figma node `{section.figma_node}` | |",
        ]
    )
    if has_figma_mobile:
        lines.append(f"| Mobile @991px: {section.mobile_diff[:80]} | |")
    lines.extend(
        [
            "",
            "### Assets",
            "",
            f"<!-- {section.asset_note} -->",
            "",
        ]
    )
    return "\n".join(lines)


def render_plan_markdown(draft: PlanDraft) -> str:
    has_figma_mobile = bool(
        draft.figma_mobile_url and "figma.com/design/" in draft.figma_mobile_url
    )
    if has_figma_mobile:
        mobile_url = draft.figma_mobile_url
    else:
        mobile_url = "*(không có — desktop only, responsive @991px theo rule 10)*"
    # Template-only plans must not carry a Page ID line: G0 rejects it (rule 55).
    if draft.template_only:
        scope_line = "- Mode: `template-only`"
        order_heading = "## Thứ tự section (Figma → Template → DO)"
    else:
        scope_line = f"- Page ID: **{draft.page_id}**" if draft.page_id else "- Page ID: **TBD**"
        order_heading = "## Thứ tự section (Figma → Page → DO)"

    buildable = [s for s in draft.sections if not s.skip_build]
    lines = [
        f"# Plan: {draft.page_title}",
        "",
        "> **Auto-generated (Phase C)** — review tree + snapshot trước DO. Builder: `build_from_plan.py`.",
        "",
        f"- Figma Desktop: [{draft.page_title}]({draft.figma_desktop_url})",
        f"- Figma Mobile: {mobile_url}",
        scope_line,
        f"- G4 evidence dir: `{draft.evidence_dir}`",
        "- Build script: `scripts/build_from_plan.py`",
        "- Build source: `figma`",
        "",
        order_heading,
        "",
        "| # | Figma name | Node | Template ID | Chiến lược |",
        "|---|------------|------|-------------|------------|",
    ]

    for s in draft.sections:
        if s.skip_build:
            lines.append(f"| — | {s.figma_name} *(rule 1)* | `{s.figma_node}` | — | — |")
        else:
            tid = str(s.template_id) if s.template_id else "TBD"
            lines.append(
                f"| {s.index} | {s.figma_name} | `{s.figma_node}` | {tid} | {s.strategy} |"
            )

    lines.extend(["", "## Review gates", ""])
    if has_figma_mobile:
        lines.append("| Section | G0 | G1 | G2 | G2.5 | G3 | G4 Desktop | G4 Mobile | Template |")
        lines.append("|---------|----|----|----|------|----|------------|-----------|----------|")
    else:
        lines.append("| Section | G0 | G1 | G2 | G2.5 | G3 | G4 Desktop | Template |")
        lines.append("|---------|----|----|----|------|----|------------|----------|")
    for s in buildable:
        tid = str(s.template_id) if s.template_id else "TBD"
        short = s.figma_name[:20]
        if has_figma_mobile:
            lines.append(f"| {short} | — | — | — | — | — | — | — | {tid} |")
        else:
            lines.append(f"| {short} | — | — | — | — | — | — | {tid} |")

    if draft.design_tokens:
        lines.extend(["", "- Design tokens:"])
        for tok in draft.design_tokens:
            lines.append(f"  - {tok}")

    for s in draft.sections:
        lines.append(render_section_block(s, has_figma_mobile=has_figma_mobile))

    return "\n".join(lines) + "\n"
