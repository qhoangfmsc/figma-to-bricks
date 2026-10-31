"""Parse template IDs, section specs, and Figma asset URLs from plans/*.md."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

TEMPLATE_ID_RE = re.compile(r"Template ID:\s*\*\*(\d+)\*\*", re.I)
ASSET_URL_RE = re.compile(r"http://localhost:3845/assets/[a-f0-9]+\.(?:png|svg)", re.I)
SECTION_HEADER_RE = re.compile(r"^## Section \d+\s*[—–-]\s*(.+)$", re.M)
FIGMA_NODE_RE = re.compile(r"`(\d+:\d+)`")
FIGMA_URL_RE = re.compile(
    r"Figma Desktop:\s*\[.*?\]\((https://www\.figma\.com/design/[^)]+)\)",
    re.I,
)
PAGE_ID_RE = re.compile(r"Page ID:\s*\*\*(\d+)\*\*", re.I)
EVIDENCE_DIR_RE = re.compile(r"G4 evidence dir:\s*`([^`]+)`", re.I)
BUILD_SCRIPT_RE = re.compile(r"Build script:\s*`([^`]+)`", re.I)
BUILD_SOURCE_RE = re.compile(r"Build source:\s*`([^`]+)`", re.I)
ASSET_MAP_RE = re.compile(r"Asset map:\s*`([^`]+)`", re.I)
TEMPLATE_SLUG_RE = re.compile(r"Template slug:\s*`([^`]+)`", re.I)
PLAN_MODE_RE = re.compile(r"^\s*-\s*Mode:\s*`([^`]+)`", re.M | re.I)
TEMPLATE_ONLY_MODE = "template-only"
FIGMA_FILE_KEY_RE = re.compile(r"figma\.com/design/([A-Za-z0-9]+)/", re.I)
STRATEGY_RE = re.compile(
    r"(?:Chiến lược mobile|Strategy):\s*`(breakpoint-only|slider-responsive|dual-block|carousel-dual|n/a)`",
    re.I,
)
WIDGET_DESKTOP_RE = re.compile(r"^\s*-\s*Desktop:\s*`([^`]+)`", re.M | re.I)
WIDGET_MOBILE_RE = re.compile(r"^\s*-\s*Mobile:\s*`([^`]+)`", re.M | re.I)
MOBILE_DIFFERS_RE = re.compile(
    r"Mobile khác desktop\?:\s*`(có|không|co|khong|yes|no)`",
    re.I,
)
FIGMA_DESKTOP_LINE_RE = re.compile(
    r"(?:Figma node desktop|Figma desktop):\s*(?:`(\d+:\d+)`|(\d+:\d+))",
    re.I,
)
FIGMA_MOBILE_LINE_RE = re.compile(
    r"(?:Figma node mobile|Figma mobile):\s*(?:`(\d+:\d+)`|(\d+:\d+))",
    re.I,
)
CRITICAL_RULE_RE = re.compile(r"^\s*-\s*(?:Critical rules|Rules):\s*`([^`]+)`", re.M | re.I)
G4_CHECKLIST_BLOCK_RE = re.compile(
    r"^###\s+G4 acceptance checklist\s*$(.*?)(?=^##|\Z)",
    re.M | re.S | re.I,
)
G4_CHECKLIST_PASS_MARKS = ("✅", "pass", "ok", "đạt")
# Checked first so "không đạt" / "not pass" are never read as a pass.
G4_CHECKLIST_FAIL_MARKS = ("❌", "fail", "không", "chưa")

DUAL_BLOCK_DIFF_KEYWORDS = (
    "grid→list",
    "grid -> list",
    "collage",
    "1 ảnh",
    "đổi component",
    "dom khác",
    "list compact",
    "card-blog-author",
    "card-blog",
    "portrait full",
)

BREAKPOINT_ONLY_DIFF_KEYWORDS = (
    "scroll ngang",
    "overflow",
    "nav pill ẩn",
    "nav ẩn",
    "stack cột",
    "tinh size",
    "padding",
    "286×168",
    "286px",
)

CAROUSEL_DUAL_SIGNAL_KEYWORDS = (
    "prev",
    "next",
    "mũi tên",
    "arrow",
    "nav pill",
    "slider-nested",
    "slider-nestable",
    "slider nestable",
    "dots",
    "pagination",
)

SLIDER_RESPONSIVE_KEYWORDS = (
    "peek",
    "lộ mép",
    "80%",
    "slider-responsive",
    "1 card",
    "perpage:1",
    "per page 1",
    "swipe",
    "splide",
)

SCROLL_ROW_KEYWORDS = (
    "scroll row",
    "scroll thuần",
    "scroll row thuần",
    "overflow-x",
    "không splide",
    "carousel-dual",
)


@dataclass
class SectionSpec:
    index: int
    name: str
    body: str
    template_id: int | None = None
    figma_desktop: str | None = None
    figma_mobile: str | None = None
    mobile_differs: bool | None = None
    strategy: str | None = None
    mobile_diff: str = ""
    critical_rules: list[str] = field(default_factory=list)
    slug: str = ""
    widget_desktop: str = ""
    widget_mobile: str = ""
    has_settings_snapshot: bool = False
    has_element_tree: bool = False
    has_mobile_diff_block: bool = False
    has_g4_checklist: bool = False
    g4_checklist: list[tuple[str, str]] = field(default_factory=list)

    @property
    def g4_checklist_failures(self) -> list[str]:
        """Criteria whose Pass cell is empty or not an explicit pass mark."""
        failures: list[str] = []
        for criterion, verdict in self.g4_checklist:
            verdict = verdict.lower()
            if any(mark in verdict for mark in G4_CHECKLIST_FAIL_MARKS):
                failures.append(criterion)
            elif not any(mark in verdict for mark in G4_CHECKLIST_PASS_MARKS):
                failures.append(criterion)
        return failures

    @property
    def plan_text_bundle(self) -> str:
        return f"{self.body} {self.mobile_diff} {self.widget_desktop} {self.widget_mobile}".lower()

    @property
    def has_slider_in_plan(self) -> bool:
        return "slider-nested" in self.plan_text_bundle or "slider-nestable" in self.plan_text_bundle

    @property
    def has_mobile_scroll_in_plan(self) -> bool:
        text = self.plan_text_bundle
        return "scroll" in text or "overflow-x" in text or "overflow-x:auto" in text

    @property
    def uses_legacy_widget_lines(self) -> bool:
        return bool(self.widget_desktop or self.widget_mobile)

    @property
    def requires_slider_responsive_heuristic(self) -> bool:
        text = f"{self.mobile_diff} {self.body} {self.strategy or ''}".lower()
        if self.strategy == "slider-responsive":
            return True
        has_carousel = "carousel" in text or "slider" in text
        has_peek = any(kw in text for kw in SLIDER_RESPONSIVE_KEYWORDS)
        has_nav = any(kw in text for kw in CAROUSEL_DUAL_SIGNAL_KEYWORDS)
        return has_carousel and has_nav and has_peek

    @property
    def requires_carousel_dual_heuristic(self) -> bool:
        if self.requires_slider_responsive_heuristic:
            return False
        text = f"{self.mobile_diff} {self.body}".lower()
        has_carousel = "carousel" in text
        has_nav = any(kw in text for kw in CAROUSEL_DUAL_SIGNAL_KEYWORDS)
        has_scroll_only = "scroll row" in text or "scroll thuần" in text or "overflow-x" in text
        return has_carousel and has_nav and has_scroll_only

    @property
    def requires_dual_block_heuristic(self) -> bool:
        text = (self.mobile_diff or "").lower()
        if any(kw in text for kw in BREAKPOINT_ONLY_DIFF_KEYWORDS):
            if not any(kw in text for kw in DUAL_BLOCK_DIFF_KEYWORDS):
                return False
        if any(kw in text for kw in DUAL_BLOCK_DIFF_KEYWORDS):
            return True
        if self.mobile_differs and self.figma_mobile:
            strong = ("collage", "grid 2×2", "grid 4×", "list compact", "portrait full")
            return any(kw in text for kw in strong)
        return False


@dataclass
class PlanMeta:
    path: Path
    page_id: int | None
    figma_desktop_url: str | None
    figma_mobile_url: str | None
    evidence_dir: str | None
    build_script: str | None = None
    build_source: str | None = None
    asset_map: str | None = None
    figma_file_key: str | None = None
    mode: str | None = None
    sections: list[SectionSpec] = field(default_factory=list)

    @property
    def is_template_only(self) -> bool:
        """Template-only plans build standalone section templates and never own a page."""
        return self.mode == TEMPLATE_ONLY_MODE


def _first_node(text: str, pattern: re.Pattern[str]) -> str | None:
    match = pattern.search(text)
    if not match:
        return None
    return match.group(1) or match.group(2)


def _parse_mobile_differs(raw: str | None) -> bool | None:
    if not raw:
        return None
    val = raw.lower().strip()
    if val in ("có", "co", "yes"):
        return True
    if val in ("không", "khong", "no"):
        return False
    return None


def _parse_g4_checklist(body: str) -> tuple[bool, list[tuple[str, str]]]:
    """Return (block present, [(criterion, pass cell)]) from `### G4 acceptance checklist`."""
    block = G4_CHECKLIST_BLOCK_RE.search(body)
    if not block:
        return False, []
    rows: list[tuple[str, str]] = []
    for line in block.group(1).splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not line.strip().startswith("|") or len(cells) < 2:
            continue
        criterion, verdict = cells[0], cells[-1]
        if criterion.lower() == "tiêu chí" or set(criterion) <= set("-: "):
            continue
        rows.append((criterion, verdict))
    return True, rows


def parse_template_ids(plan_path: str | Path) -> list[int]:
    text = Path(plan_path).read_text()
    return [int(match) for match in TEMPLATE_ID_RE.findall(text)]


def parse_asset_urls(plan_path: str | Path) -> list[str]:
    text = Path(plan_path).read_text()
    seen: set[str] = set()
    ordered: list[str] = []
    for url in ASSET_URL_RE.findall(text):
        if url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


def parse_page_id(plan_path: str | Path) -> int | None:
    text = Path(plan_path).read_text()
    match = PAGE_ID_RE.search(text)
    return int(match.group(1)) if match else None


def parse_evidence_dir(plan_path: str | Path) -> str | None:
    text = Path(plan_path).read_text()
    match = EVIDENCE_DIR_RE.search(text)
    return match.group(1).strip() if match else None


def parse_build_script(plan_path: str | Path) -> str | None:
    text = Path(plan_path).read_text()
    match = BUILD_SCRIPT_RE.search(text)
    return match.group(1).strip() if match else None


def parse_build_source(plan_path: str | Path) -> str | None:
    text = Path(plan_path).read_text()
    match = BUILD_SOURCE_RE.search(text)
    return match.group(1).strip() if match else None


def parse_asset_map(plan_path: str | Path) -> str | None:
    """`- Asset map: \`scripts/data/<slug>/assets.json\`` — node → Figma asset URL resolved in PLAN."""
    text = Path(plan_path).read_text()
    match = ASSET_MAP_RE.search(text)
    return match.group(1).strip() if match else None


def parse_plan_mode(plan_path: str | Path) -> str | None:
    text = Path(plan_path).read_text()
    match = PLAN_MODE_RE.search(text)
    return match.group(1).strip().lower() if match else None


def parse_figma_file_key(plan_path: str | Path) -> str | None:
    desktop_url, _ = parse_figma_urls(plan_path)
    if desktop_url:
        match = FIGMA_FILE_KEY_RE.search(desktop_url)
        if match:
            return match.group(1)
    text = Path(plan_path).read_text()
    match = FIGMA_FILE_KEY_RE.search(text)
    return match.group(1) if match else None


def parse_figma_urls(plan_path: str | Path) -> tuple[str | None, str | None]:
    text = Path(plan_path).read_text()
    desktop = None
    mobile = None
    for line in text.splitlines():
        if "Figma Desktop:" in line and "figma.com" in line:
            url_match = re.search(r"\((https://[^)]+)\)", line)
            if url_match:
                desktop = url_match.group(1)
        if "Figma Mobile:" in line and "figma.com" in line:
            url_match = re.search(r"\((https://[^)]+)\)", line)
            if url_match:
                mobile = url_match.group(1)
    return desktop, mobile


def plan_has_figma_mobile(meta: PlanMeta) -> bool:
    """True only when plan header has a real Figma Mobile design URL."""
    url = (meta.figma_mobile_url or "").strip()
    return "figma.com/design/" in url


def _parse_section_body(index: int, name: str, body: str) -> SectionSpec:
    spec = SectionSpec(index=index, name=name.strip(), body=body)

    tid_match = TEMPLATE_ID_RE.search(body)
    if tid_match:
        spec.template_id = int(tid_match.group(1))

    spec.figma_desktop = _first_node(body, FIGMA_DESKTOP_LINE_RE)
    spec.figma_mobile = _first_node(body, FIGMA_MOBILE_LINE_RE)

    if not spec.figma_desktop:
        review = re.search(r"Figma desktop:\s*`(\d+:\d+)`", body, re.I)
        if review:
            spec.figma_desktop = review.group(1)
    if not spec.figma_mobile:
        review = re.search(r"mobile:\s*`(\d+:\d+)`", body, re.I)
        if review and "Figma desktop" in body:
            spec.figma_mobile = review.group(1)

    strategy_match = STRATEGY_RE.search(body)
    if strategy_match:
        spec.strategy = strategy_match.group(1).lower()

    differs_match = MOBILE_DIFFERS_RE.search(body)
    spec.mobile_differs = _parse_mobile_differs(differs_match.group(1) if differs_match else None)

    diff_match = re.search(r"Mobile diff[^:]*:\s*(.+)$", body, re.M | re.I)
    if diff_match:
        spec.mobile_diff = diff_match.group(1).strip()

    spec.critical_rules = CRITICAL_RULE_RE.findall(body)
    if not spec.critical_rules:
        for line in body.splitlines():
            if line.strip().startswith("- Critical rules:"):
                spec.critical_rules.append(line.split(":", 1)[1].strip().strip("`"))

    slug_match = TEMPLATE_SLUG_RE.search(body)
    if slug_match:
        spec.slug = slug_match.group(1)
    elif spec.template_id:
        spec.slug = f"tpl-{spec.template_id}"

    desktop_widget = WIDGET_DESKTOP_RE.search(body)
    if desktop_widget:
        spec.widget_desktop = desktop_widget.group(1).strip()
    mobile_widget = WIDGET_MOBILE_RE.search(body)
    if mobile_widget:
        spec.widget_mobile = mobile_widget.group(1).strip()

    spec.has_settings_snapshot = bool(re.search(r"^###\s+Settings snapshot", body, re.M | re.I))
    spec.has_element_tree = bool(
        re.search(r"^###\s+Cấu trúc element", body, re.M | re.I)
        or re.search(r"Cấu trúc element \(desktop\)", body, re.I)
    )
    spec.has_mobile_diff_block = bool(re.search(r"^###\s+Mobile diff", body, re.M | re.I))
    spec.has_g4_checklist, spec.g4_checklist = _parse_g4_checklist(body)

    return spec


def parse_sections(plan_path: str | Path) -> list[SectionSpec]:
    path = Path(plan_path)
    text = path.read_text()
    headers = list(SECTION_HEADER_RE.finditer(text))
    if not headers:
        return []

    sections: list[SectionSpec] = []
    for i, match in enumerate(headers):
        start = match.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        body = text[start:end]
        sections.append(_parse_section_body(i + 1, match.group(1), body))
    return sections


def parse_plan(plan_path: str | Path) -> PlanMeta:
    path = Path(plan_path)
    desktop_url, mobile_url = parse_figma_urls(path)
    return PlanMeta(
        path=path,
        page_id=parse_page_id(path),
        figma_desktop_url=desktop_url,
        figma_mobile_url=mobile_url,
        evidence_dir=parse_evidence_dir(path),
        build_script=parse_build_script(path),
        build_source=parse_build_source(path),
        asset_map=parse_asset_map(path),
        figma_file_key=parse_figma_file_key(path),
        mode=parse_plan_mode(path),
        sections=parse_sections(path),
    )


def section_by_template_id(plan_path: str | Path, template_id: int) -> SectionSpec | None:
    for section in parse_sections(plan_path):
        if section.template_id == template_id:
            return section
    return None
