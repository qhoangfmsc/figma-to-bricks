"""Auto-detect and patch known Bricks template issues (background, flex layout)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from scripts.lib.plan_parser import SectionSpec
from scripts.lib.section_structure import validate_section_structure
from scripts.lib.template_validate import run_g1, validate_compiled_css

# Bricks _background.gradient often does not compile — mirror in _cssCustom on section root.
SECTION_BACKGROUND_CSS: dict[int, dict[str, str]] = {
    8067: {
        "cmsec1": (
            "#brxe-cmsec1{background:linear-gradient(180deg,rgba(242,243,245,0) 0%,#f2f3f5 50%);}"
        ),
    },
    8068: {
        "bcsec1": (
            "#brxe-bcsec1{background:linear-gradient(0deg,#ffffff 0%,#f2f3f5 50%);}"
        ),
    },
}

LEGACY_ID_RENAMES: dict[int, dict[str, str]] = {
    8063: {"hrprof1": "hrpf01"},
}


def rename_element_ids(elements: list[dict], renames: dict[str, str]) -> tuple[list[dict], list[AutofixChange]]:
    if not renames:
        return elements, []
    changes: list[AutofixChange] = []
    for old, new in renames.items():
        for el in elements:
            if el.get("id") == old:
                el["id"] = new
                changes.append(AutofixChange(new, f"rename id {old} → {new}"))
            if str(el.get("parent")) == old:
                el["parent"] = new
            children = el.get("children") or []
            if old in children:
                el["children"] = [new if cid == old else cid for cid in children]
            settings = el.get("settings") or {}
            css = settings.get("_cssCustom")
            if css and old in css:
                settings["_cssCustom"] = css.replace(f"#brxe-{old}", f"#brxe-{new}").replace(old, new)
                el["settings"] = settings
    return elements, changes


HEADER_DIV_BASE = """#brxe-{eid} {{
  display:flex;
  flex-direction:row;
  align-items:center;
  justify-content:space-between;
  column-gap:24px;
  width:100%;
}}
@media (max-width:991px) {{
  #brxe-{eid} {{
    flex-direction:column !important;
    align-items:flex-start !important;
    row-gap:16px;
  }}
  #brxe-{ico} {{ order:-1; }}
  #brxe-{tx} {{
    display:flex;
    flex-direction:column;
    row-gap:16px;
    width:100%;
  }}
}}"""

CMMOB1_CSS = """#brxe-cmmob1{display:none;width:100%;}
@media (max-width:991px){
  #brxe-cmgrd{display:none !important;}
  #brxe-cmmob1{display:block !important;}
}
#brxe-cmmob1 .ex-list{display:flex;flex-direction:column;gap:16px;width:100%;}
#brxe-cmmob1 .ex-item{
  display:flex;flex-direction:column;align-items:flex-start;gap:16px;
  width:100%;box-sizing:border-box;
  background:#fff;border-radius:20px;padding:12px 10px;
}
#brxe-cmmob1 .ex-item-top{
  display:flex;flex-direction:column;align-items:flex-start;gap:8px;width:100%;
}
#brxe-cmmob1 .ex-item img{width:32px;height:32px;flex-shrink:0;}
#brxe-cmmob1 .ex-title{
  font-family:Inter;font-size:20px;font-weight:500;line-height:32px;color:#282829;margin:0;
}
#brxe-cmmob1 .ex-body{
  font-family:Inter;font-size:16px;font-weight:400;line-height:30px;color:#282829;margin:0;width:100%;
}"""

CMMOB1_ICON = "http://localhost:3845/assets/7a08accddc1dbcede08dc05ae30fda04ddb4f08a.svg"

CMMOB1_ITEMS: list[tuple[str, str]] = [
    (
        "Phát triển hệ thống phòng thủ",
        "Nghiên cứu và cấu hình các lớp Firewall (WAF, Network Firewall) để chống lại các cuộc tấn công DDoS và xâm nhập trái phép.",
    ),
    (
        "Kiến trúc sư giải pháp Cloud/SaaS",
        "Thiết kế và tối ưu cấu trúc hệ thống giúp tăng khả năng mở rộng (scalability) và độ ổn định cho các dịch vụ Hosting/VPS.",
    ),
    (
        "Đánh giá khả thi (Feasibility Study)",
        "Thực hiện các bài kiểm tra (benchmark) và báo cáo tính khả thi về mặt kỹ thuật trước khi triển khai các dự án nâng cấp hệ thống lớn.",
    ),
    (
        "Tư vấn giải pháp nội bộ",
        "Hỗ trợ đội ngũ kỹ thuật và kinh doanh trong việc giải quyết các bài toán phức tạp liên quan đến hạ tầng Cloud và bảo mật.",
    ),
]


def build_cmmob1_html() -> str:
    parts: list[str] = ['<div class="ex-list">']
    for title, body in CMMOB1_ITEMS:
        parts.append(
            f'<div class="ex-item"><div class="ex-item-top">'
            f'<img src="{CMMOB1_ICON}" alt="" />'
            f'<p class="ex-title">{title}</p></div>'
            f'<p class="ex-body">{body}</p></div>'
        )
    parts.append("</div>")
    return "".join(parts)

GNMOB1_CSS = """#brxe-gnmob1{display:none;width:100%;}
@media (max-width:991px){
  #brxe-gngrd{display:none !important;}
  #brxe-gnmob1{display:block !important;}
}
#brxe-gnmob1 .bl-list{display:flex;flex-direction:column;gap:12px;width:100%;align-items:stretch;}
#brxe-gnmob1 .bl-compact{display:flex;align-items:center;gap:0;width:100%;overflow:hidden;min-height:77px;}
#brxe-gnmob1 .bl-compact-thumb{flex-shrink:0;width:137px;height:77px;border-radius:4px;overflow:hidden;}
#brxe-gnmob1 .bl-compact-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
#brxe-gnmob1 .bl-compact-body{flex:1;min-width:0;padding:0 8px;display:flex;flex-direction:column;gap:4px;}
#brxe-gnmob1 .bl-compact-title{
  font-family:Roboto,sans-serif;font-size:14px;font-weight:500;line-height:20px;
  color:#525666;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
#brxe-gnmob1 .bl-compact-meta{
  font-family:Roboto,sans-serif;font-size:10.684px;line-height:16px;color:#525666;
  display:flex;gap:7px;align-items:center;
}
#brxe-gnmob1 .bl-compact-meta .dot{font-size:2.671px;line-height:16px;}"""

GNPAG1_CSS = """#brxe-gnpag1{width:100%;}
#brxe-gnpag1 .gn-pag-desktop{text-align:center;padding-top:24px;}
#brxe-gnpag1 .gn-pag-desktop span{
  font-family:Roboto,sans-serif;font-size:16px;font-weight:500;color:#525666;cursor:pointer;
}
#brxe-gnpag1 .gn-pag-mobile{display:none;}
#brxe-gnpag1 .gn-pag-mobile span{
  font-family:Roboto,sans-serif;font-size:14px;font-weight:400;line-height:20px;
  color:#525666;text-decoration:underline;cursor:pointer;
}
@media (max-width:991px){
  #brxe-gnpag1 .gn-pag-desktop{display:none;}
  #brxe-gnpag1 .gn-pag-mobile{display:flex;justify-content:center;padding-top:12px;width:100%;}
}"""

LAYOUT_PATCHES: dict[int, dict[str, dict[str, str]]] = {
    8067: {
        "cmhdr1": {"_cssCustom": HEADER_DIV_BASE.format(eid="cmhdr1", ico="cmico1", tx="cmhtx1")},
        "cmmob1": {"_cssCustom": CMMOB1_CSS, "text": build_cmmob1_html()},
    },
    8068: {
        "bchdr1": {"_cssCustom": HEADER_DIV_BASE.format(eid="bchdr1", ico="bcico1", tx="bchtx1")},
    },
    8069: {
        "gnhdr1": {"_cssCustom": HEADER_DIV_BASE.format(eid="gnhdr1", ico="gnico1", tx="gnhtx1")},
        "gnmob1": {"_cssCustom": GNMOB1_CSS},
        "gnpag1": {"_cssCustom": GNPAG1_CSS},
    },
}


@dataclass
class AutofixChange:
    element_id: str
    reason: str


@dataclass
class GateReport:
    passed: bool
    g1_issues: list[str] = field(default_factory=list)
    g2_issues: list[str] = field(default_factory=list)
    g25_issues: list[str] = field(default_factory=list)


def _normalize_css(css: str) -> str:
    return re.sub(r"\s+", "", css)


def ensure_css_fragment(existing: str, fragment: str, needle: str) -> tuple[str, bool]:
    css = existing or ""
    if needle in _normalize_css(css):
        return css, False
    css = css.strip()
    return (f"{fragment}\n{css}" if css else fragment), True


def patch_elements(
    elements: list[dict],
    patches: dict[str, dict],
    *,
    css_replace_ids: set[str] | None = None,
) -> tuple[list[dict], list[AutofixChange]]:
    changes: list[AutofixChange] = []
    replace_ids = css_replace_ids or set()
    out: list[dict] = []
    for el in elements:
        eid = el.get("id", "")
        if eid in patches:
            settings = dict(el.get("settings") or {})
            for key, value in patches[eid].items():
                if key == "_cssCustom" and isinstance(value, str):
                    if eid in replace_ids:
                        if settings.get("_cssCustom") != value:
                            settings["_cssCustom"] = value
                            changes.append(AutofixChange(eid, "replace _cssCustom"))
                    else:
                        merged, changed = ensure_css_fragment(
                            settings.get("_cssCustom") or "",
                            value,
                            _needle_for_patch(eid, value),
                        )
                        if changed:
                            settings["_cssCustom"] = merged
                            changes.append(AutofixChange(eid, f"prepend _cssCustom: {key}"))
                else:
                    settings[key] = value
                    changes.append(AutofixChange(eid, f"set {key}"))
            el = {**el, "settings": settings}
        out.append(el)
    return out, changes


def _needle_for_patch(element_id: str, css: str) -> str:
    if "linear-gradient" in css:
        return "linear-gradient"
    if "display:flex" in css.replace(" ", ""):
        return "display:flex"
    return f"#brxe-{element_id}"


def build_autofix_patches(template_id: int, elements: list[dict], spec: SectionSpec | None) -> dict[str, dict]:
    patches: dict[str, dict] = {}

    for eid, css in SECTION_BACKGROUND_CSS.get(template_id, {}).items():
        el = next((e for e in elements if e.get("id") == eid), None)
        if not el:
            continue
        existing = (el.get("settings") or {}).get("_cssCustom") or ""
        merged, changed = ensure_css_fragment(existing, css, "linear-gradient")
        if changed:
            patches[eid] = {"_cssCustom": merged}

    for eid, patch in LAYOUT_PATCHES.get(template_id, {}).items():
        el = next((e for e in elements if e.get("id") == eid), None)
        if not el:
            continue
        current_css = (el.get("settings") or {}).get("_cssCustom") or ""
        target_css = patch.get("_cssCustom", "")
        needs_css = target_css and current_css.strip() != target_css.strip()
        target_text = patch.get("text", "")
        current_text = (el.get("settings") or {}).get("text", "")
        needs_text = target_text and "ex-item-top" not in current_text
        if needs_css or needs_text:
            entry = patches.setdefault(eid, {})
            if needs_css:
                entry["_cssCustom"] = target_css
            if needs_text:
                entry["text"] = target_text

    if spec:
        for rule in spec.critical_rules:
            if rule.strip() != "display:flex":
                continue
            for el in elements:
                if el.get("name") != "div":
                    continue
                css = (el.get("settings") or {}).get("_cssCustom") or ""
                if "flex-direction" not in css:
                    continue
                if "display:flex" in _normalize_css(css):
                    continue
                eid = el["id"]
                fragment = f"#brxe-{eid}{{display:flex;}}"
                base = patches.get(eid, {}).get("_cssCustom") or css
                merged, changed = ensure_css_fragment(base, fragment, "display:flex")
                if changed:
                    patches.setdefault(eid, {})["_cssCustom"] = merged

    return patches


def autofix_template(
    template_id: int,
    elements: list[dict],
    spec: SectionSpec | None,
) -> tuple[list[dict], list[AutofixChange]]:
    all_changes: list[AutofixChange] = []
    renames = LEGACY_ID_RENAMES.get(template_id, {})
    if renames:
        elements, rename_changes = rename_element_ids(elements, renames)
        all_changes.extend(rename_changes)

    patches = build_autofix_patches(template_id, elements, spec)
    if patches:
        layout_ids = set(LAYOUT_PATCHES.get(template_id, {}))
        elements, patch_changes = patch_elements(elements, patches, css_replace_ids=layout_ids)
        all_changes.extend(patch_changes)

    if not all_changes:
        return elements, []
    return elements, all_changes


def run_gates(
    template_id: int,
    elements: list[dict],
    compiled_css: str,
    spec: SectionSpec | None,
    *,
    strict_css: bool = False,
) -> GateReport:
    report = GateReport(passed=True)
    g1 = run_g1(elements, strict_css=strict_css)
    for issue in g1.issues:
        if issue.level == "error":
            report.g1_issues.append(f"[{issue.element_id}] {issue.message}")
            report.passed = False

    extra_rules = spec.critical_rules if spec else []
    g2 = validate_compiled_css(elements, compiled_css, extra_rules=extra_rules)
    for issue in g2.issues:
        if issue.level == "error":
            report.g2_issues.append(f"[{issue.element_id}] {issue.message}")
            report.passed = False

    g25 = validate_section_structure(elements, spec)
    for issue in g25.issues:
        if issue.level == "error":
            report.g25_issues.append(issue.message)
            report.passed = False

    return report
