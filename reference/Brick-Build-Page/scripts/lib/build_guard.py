"""Detect clone anti-patterns in build scripts (rule 30, 48)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

GET_TEMPLATE_RE = re.compile(r"get_template\s*\(\s*(\d+)")
GET_TEMPLATE_ANY_RE = re.compile(r"get_template\s*\(")
DEEPCOPY_RE = re.compile(r"copy\.deepcopy|deepcopy\s*\(")
V1_MAP_RE = re.compile(r'["\']v1["\']\s*:\s*(\d+)')
V2_V1_COMMENT_RE = re.compile(
    r"V1 template|from V1|prior build|clone|v2\s*[←<-]+\s*v1|V2.*V1",
    re.I,
)


@dataclass
class BuildGuardResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def _plan_template_ids(plan_path: Path | None) -> set[int]:
    if not plan_path or not plan_path.exists():
        return set()
    from scripts.lib.plan_parser import parse_template_ids

    return set(parse_template_ids(plan_path))


def scan_build_script(
    script_path: Path,
    *,
    plan_path: Path | None = None,
    allow_clone: bool = False,
) -> BuildGuardResult:
    result = BuildGuardResult()
    if not script_path.exists():
        result.errors.append(f"build script not found: {script_path}")
        return result

    text = script_path.read_text()
    plan_ids = _plan_template_ids(plan_path)

    foreign_sources: list[int] = []
    for match in GET_TEMPLATE_RE.finditer(text):
        source_id = int(match.group(1))
        if plan_ids and source_id not in plan_ids:
            foreign_sources.append(source_id)

    for match in V1_MAP_RE.finditer(text):
        v1_id = int(match.group(1))
        if plan_ids and v1_id not in plan_ids:
            foreign_sources.append(v1_id)

    has_get_template = bool(GET_TEMPLATE_ANY_RE.search(text))
    has_deepcopy = bool(DEEPCOPY_RE.search(text))
    has_v1_map = bool(V1_MAP_RE.search(text))
    has_clone_comment = bool(V2_V1_COMMENT_RE.search(text))

    if foreign_sources:
        unique = sorted(set(foreign_sources))
        result.errors.append(
            f"get_template/SECTION_MAP dùng ID ngoài plan {unique} — clone template page khác (rule 48)"
        )

    if has_deepcopy and has_get_template:
        result.errors.append(
            "get_template + deepcopy — builder copy element tree thay vì đọc Figma/plan (rule 48)"
        )

    if has_v1_map:
        result.errors.append(
            'SECTION_MAP "v1" mapping — shortcut clone V1→V2, không độc lập từ Figma (rule 48)'
        )

    if has_clone_comment and (has_deepcopy or foreign_sources or has_v1_map):
        result.warnings.append(
            "script ghi rõ clone V1 — cần rebuild từ Figma + Settings snapshot trước DONE"
        )

    if allow_clone and result.errors:
        result.warnings.extend(result.errors)
        result.errors.clear()
        result.warnings.append("clone allowed via --allow-clone / BUILD_ALLOW_CLONE=1")

    return result
