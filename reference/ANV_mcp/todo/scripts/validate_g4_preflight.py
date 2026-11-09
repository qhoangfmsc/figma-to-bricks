#!/usr/bin/env python3
"""
validate_g4_preflight.py — Hard gate TRƯỚC khi tuyên bố G4 PASS.

Chặn false-PASS: agent không được báo ≥98% nếu thiếu evidence checklist.

Checks (JSON + optional compiled CSS):
  1. Schema traps (_borderRadius, _minWidth, _gap on nestables)
  2. Text ngắn trong flex row (giá/badge/đơn vị, mọi ngôn ngữ) thiếu white-space:nowrap
  3. Card-like elements với border phải có _border.radius
  4. Yêu cầu file evidence screenshot full-page D+M tồn tại
  5. Yêu cầu file evidence zoom per-element tồn tại (chạy capture_zoom_evidence.py
     trước — xem --zoom-dir) — bắt buộc để zoom-compare Z1-Z5 không còn là bước
     agent tự khai đã làm mà không ai kiểm tra được
  6. Optional: grep post-{id}.min.css cho border-radius + white-space
  7. Optional: đọc report JSON từ diff_screenshots.py (--diff-report-desktop /
     --diff-report-mobile) — tín hiệu % pixel lệch khách quan, KHÔNG phải hard
     block (nội dung thật khác placeholder vẫn ra diff cao mà không phải lỗi),
     chỉ cảnh báo để agent tự kiểm tra trước khi tự chấm ≥98%

Usage (từ thư mục todo/):
  python3 scripts/capture_zoom_evidence.py --url "..." --viewport desktop \\
      --out-dir scratch/g3/zoom --element a0001e:cta-featured --element a00030:price-row
  python3 scripts/diff_screenshots.py --figma scratch/g3/figma-desktop.png \\
      --wp scratch/g3/vnx-service-desktop.png --out-dir scratch/g3/diff --label vnx-service-desktop
  python3 scripts/validate_g4_preflight.py bricks-json/vnx-service.json \\
      --template-id 9117 \\
      --desktop scratch/g3/vnx-service-desktop.png \\
      --mobile scratch/g3/vnx-service-mobile.png \\
      --zoom-dir scratch/g3/zoom \\
      --diff-report-desktop scratch/g3/diff/vnx-service-desktop-report.json
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.lib.bricks_mcp import _get_config

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(f"  ❌ {msg}")


def warn(msg: str) -> None:
    warnings.append(f"  ⚠️  {msg}")


def load_elements(path: Path) -> list:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "content" in data:
        return data["content"]
    if isinstance(data, list):
        return data
    raise ValueError("JSON phải là clipboard {content:[]} hoặc flat array")


def check_schema(elements: list) -> None:
    for el in elements:
        eid = el.get("id", "?")
        name = el.get("name", "")
        settings = el.get("settings") or {}
        for key in settings:
            base = key.split(":")[0]
            if base == "_borderRadius":
                err(f"{eid}: `{key}` không hợp lệ 1.12.3 → dùng `_border.radius`")
            if base in ("_minWidth", "_maxWidth"):
                err(f"{eid}: `{key}` sai → dùng `_widthMin` / `_widthMax`")
            if base == "_gap" and name in ("container", "block", "div", "section"):
                err(f"{eid}: `_gap` không compile trên nestable → `_columnGap`/`_rowGap`")


# Danh sách từ khoá đơn giản thay vì 1 regex phức tạp — dễ đọc, dễ thêm ngôn ngữ mới.
PRICE_LABEL_HINTS = (
    "chỉ từ", "giá từ", "/ tháng", "/tháng", "/ năm", "/năm",
    "vnđ", "₫", "from", "/mo", "/yr",
)


def _has_nowrap(settings: dict) -> bool:
    typ = settings.get("_typography") or {}
    css = settings.get("_cssCustom") or ""
    css_flat = css.replace(" ", "")
    return (
        typ.get("white-space") == "nowrap"
        or "white-space:nowrap" in css_flat
        or "white-space: nowrap" in css
    )


def _looks_like_price_label(text: str) -> bool:
    lowered = text.lower()
    return any(hint in lowered for hint in PRICE_LABEL_HINTS)


def _is_flex_row(parent_settings: dict) -> bool:
    return any(
        v == "row" for k, v in parent_settings.items() if k.split(":")[0] == "_direction"
    )


def _build_children_count(elements: list) -> dict:
    children_count: dict[str, int] = {}
    for el in elements:
        parent = el.get("parent")
        if parent and parent != "0":
            children_count[parent] = children_count.get(parent, 0) + 1
    return children_count


def _short_text_risk_elements(elements: list):
    """Yield (el, looks_like_price_label) cho mỗi text ngắn ngồi cạnh sibling trong flex row."""
    by_id = {el.get("id"): el for el in elements}
    children_count = _build_children_count(elements)

    for el in elements:
        settings = el.get("settings") or {}
        text = (settings.get("text") or "").strip()
        if not text or len(text) > 20 or "\n" in text:
            continue
        parent = by_id.get(el.get("parent"))
        if not parent:
            continue
        parent_settings = parent.get("settings") or {}
        has_siblings = children_count.get(el.get("parent"), 0) >= 2
        if not (_is_flex_row(parent_settings) and has_siblings):
            continue
        yield el, _looks_like_price_label(text)


def check_price_nowrap(elements: list) -> None:
    """Bắt bất kỳ text ngắn nào ngồi cạnh sibling trong flex row mà thiếu nowrap —
    tổng quát hoá từ lỗi cụ thể 'Chỉ từ' (session 2026-07-14) sang MỌI wording/ngôn ngữ.
    Rule: text ngắn (<=20 ký tự) là 1-trong-2+ children của 1 parent flex row → rủi ro
    xuống dòng khi container co hẹp (mobile/card hẹp) nếu thiếu white-space:nowrap.
    """
    found_risk = 0
    for el, looks_like_price_label in _short_text_risk_elements(elements):
        found_risk += 1
        if _has_nowrap(el.get("settings") or {}):
            continue
        severity = err if looks_like_price_label else warn
        text = (el.get("settings") or {}).get("text", "")
        severity(
            f"{el.get('id')}: text ngắn \"{text}\" nằm trong flex row cùng sibling "
            f"nhưng thiếu white-space:nowrap (rủi ro xuống dòng khi co hẹp)"
        )
    if found_risk == 0:
        warn("Không tìm thấy text ngắn trong flex row nào — bỏ qua check nowrap (OK nếu section không có price/label row)")


def check_border_radius(elements: list) -> None:
    for el in elements:
        settings = el.get("settings") or {}
        border = settings.get("_border")
        if not isinstance(border, dict):
            continue
        width = border.get("width")
        if not width:
            continue
        # has visible border width
        has_width = False
        if isinstance(width, dict):
            has_width = any(str(v) not in ("", "0", "0px") for v in width.values())
        elif width not in ("0", "0px", 0):
            has_width = True
        if has_width and "radius" not in border:
            warn(
                f"{el.get('id')}: `_border` có width nhưng thiếu `radius` "
                f"(card bo góc Figma sẽ vuông)"
            )


def check_evidence(desktop: str | None, mobile: str | None) -> None:
    if not desktop or not mobile:
        err(
            "Thiếu --desktop và --mobile screenshot paths. "
            "G4 PASS bắt buộc có evidence D+M trên disk."
        )
        return
    for label, p in (("desktop", desktop), ("mobile", mobile)):
        path = Path(p)
        if not path.is_file():
            err(f"Evidence {label} không tồn tại: {p}")
        elif path.stat().st_size < 10_000:
            warn(f"Evidence {label} quá nhỏ ({path.stat().st_size} bytes) — nghi screenshot lỗi")


def check_zoom_evidence(zoom_dir: str | None, min_elements: int) -> None:
    """Bắt buộc file crop-screenshot per-element (từ capture_zoom_evidence.py) tồn tại
    thật trên đĩa — đóng lỗ hổng checklist Z1-Z5 trước đây chỉ là agent tự khai đã
    zoom-compare bằng mắt, không có bằng chứng bắt buộc kiểm tra được."""
    if not zoom_dir:
        err(
            "Thiếu --zoom-dir. Zoom-compare (Z1-Z5 trong rubric.md) bắt buộc có bằng "
            "chứng file thật — chạy capture_zoom_evidence.py trước, không được chỉ tự khai đã xem."
        )
        return
    zoom_path = Path(zoom_dir)
    manifests = sorted(zoom_path.glob("manifest-*.json"))
    if not manifests:
        err(f"Không tìm thấy manifest-*.json trong {zoom_dir} — chưa chạy capture_zoom_evidence.py?")
        return

    total_ok = 0
    for manifest_file in manifests:
        try:
            data = json.loads(manifest_file.read_text(encoding="utf-8"))
        except Exception as exc:
            err(f"Manifest lỗi {manifest_file}: {exc}")
            continue
        viewport = data.get("viewport", "?")
        for entry in data.get("results", []):
            label = entry.get("label", "?")
            if entry.get("status") != "ok":
                err(f"Zoom evidence FAIL [{viewport}] {label}: {entry.get('error', 'không rõ lỗi')}")
                continue
            file_path = Path(entry.get("path", ""))
            if not file_path.is_file():
                err(f"Zoom evidence [{viewport}] {label}: manifest báo ok nhưng file không tồn tại ({file_path})")
                continue
            total_ok += 1

    if total_ok < min_elements:
        err(
            f"Chỉ có {total_ok} zoom evidence hợp lệ, cần tối thiểu {min_elements} "
            f"(--min-zoom-elements). Thiếu vùng zoom bắt buộc theo checklist Z1-Z5."
        )


def check_compiled_css(template_id: int | None, site: str) -> None:
    if not template_id:
        warn("Không truyền --template-id — bỏ qua check CSS compiled")
        return
    url = f"{site.rstrip('/')}/wp-content/uploads/bricks/css/post-{template_id}.min.css"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            css = resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        err(f"Không đọc được CSS compiled: {url} ({exc})")
        return

    if "border-radius" not in css:
        err("CSS compiled không có border-radius — nghi schema radius sai trên mọi element")
    if "white-space:nowrap" not in css.replace(" ", "") and "white-space: nowrap" not in css:
        warn("CSS compiled không thấy white-space:nowrap — kiểm tra hàng giá nếu Figma có 'Chỉ từ'")
    # Literal invalid keys should never appear as selectors; this catches unmigrated export noise
    if "_borderRadius" in css:
        err("CSS vẫn chứa chuỗi _borderRadius — export chưa migrate")


def check_diff_report(label: str, path: str | None, warn_below: float) -> None:
    """Đọc report của diff_screenshots.py nếu có — tín hiệu bổ sung, không phải
    nguồn sự thật duy nhất. Thiếu file không phải lỗi (script diff là optional)."""
    if not path:
        return
    report_path = Path(path)
    if not report_path.is_file():
        warn(f"Diff report [{label}] không tồn tại: {path} — bỏ qua tín hiệu diff khách quan cho viewport này")
        return
    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except Exception as exc:
        warn(f"Diff report [{label}] lỗi đọc: {exc}")
        return
    similarity = data.get("similarity_pct")
    if similarity is None:
        return
    if similarity < warn_below:
        top = data.get("top_regions", [])[:3]
        region_desc = "; ".join(f"{r['diff_pct']}%@bbox{r['bbox']}" for r in top)
        warn(
            f"Diff khách quan [{label}]: similarity {similarity}% < {warn_below}% "
            f"(heatmap: {data.get('heatmap')}) — vùng lệch nhiều nhất: {region_desc}. "
            f"Có thể là lệch thật hoặc chỉ do nội dung khác placeholder — TỰ kiểm tra trước khi báo PASS."
        )
    else:
        print(f"  ℹ️  Diff khách quan [{label}]: similarity {similarity}% (≥ {warn_below}%)")


def print_agent_contract() -> None:
    print(
        """
═══════════════════════════════════════════════════════════
  CONTRACT — Cấm tuyên bố G4 PASS nếu script này FAIL
═══════════════════════════════════════════════════════════
  1. Chạy G1 (validate_template_json) PASS
  2. Chạy script này PASS
  3. Zoom-compare bắt buộc (không chỉ full-page) — PHẢI có file evidence thật:
       chạy capture_zoom_evidence.py cho hàng giá / CTA / border card featured /
       mobile scroll width, rồi truyền --zoom-dir vào script này.
  4. Khuyến nghị: chạy diff_screenshots.py trước, truyền --diff-report-desktop/-mobile
       vào script này — nếu similarity < ngưỡng, tự kiểm tra vùng lệch trước khi chấm.
  5. Ghi bảng điểm rubric + delta log; TOTAL ≥ 98
  6. Chỉ khi 1–5 xong mới được viết DONE / ≥98% vào infor_todo.md
"""
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="G4 preflight hard gate (anti false-PASS)")
    parser.add_argument("json_file", help="Path tới bricks-json section")
    parser.add_argument("--template-id", type=int, default=None)
    parser.add_argument("--desktop", default=None, help="Path screenshot desktop")
    parser.add_argument("--mobile", default=None, help="Path screenshot mobile")
    parser.add_argument("--zoom-dir", default=None, help="Thư mục chứa manifest-*.json từ capture_zoom_evidence.py")
    parser.add_argument("--min-zoom-elements", type=int, default=2, help="Số zoom evidence tối thiểu bắt buộc")
    parser.add_argument(
        "--site",
        default=None,
        help="Base URL của site WordPress. Mặc định: WP_URL trong .env — không phân biệt local hay remote.",
    )
    parser.add_argument("--skip-evidence", action="store_true", help="Bỏ check file PNG full-page (không khuyến nghị)")
    parser.add_argument("--skip-zoom-evidence", action="store_true", help="Bỏ check zoom evidence (không khuyến nghị)")
    parser.add_argument("--diff-report-desktop", default=None, help="Path report JSON từ diff_screenshots.py (desktop) — optional, chỉ cảnh báo")
    parser.add_argument("--diff-report-mobile", default=None, help="Path report JSON từ diff_screenshots.py (mobile) — optional, chỉ cảnh báo")
    parser.add_argument("--diff-warn-below", type=float, default=90.0, help="Ngưỡng similarity%% để cảnh báo (default 90)")
    args = parser.parse_args()

    site = (args.site or _get_config("WP_URL", "http://localhost:8000")).rstrip("/")

    print(f"\n{'=' * 55}")
    print("  Gate G4 PREFLIGHT — Anti false-PASS")
    print(f"  File: {args.json_file}")
    print(f"  Site: {site}")
    print(f"{'=' * 55}")

    try:
        elements = load_elements(Path(args.json_file))
    except Exception as exc:
        print(f"\n❌ FAIL — {exc}")
        return 1

    check_schema(elements)
    check_price_nowrap(elements)
    check_border_radius(elements)
    if not args.skip_evidence:
        check_evidence(args.desktop, args.mobile)
    if not args.skip_zoom_evidence:
        check_zoom_evidence(args.zoom_dir, args.min_zoom_elements)
    check_compiled_css(args.template_id, site)
    check_diff_report("desktop", args.diff_report_desktop, args.diff_warn_below)
    check_diff_report("mobile", args.diff_report_mobile, args.diff_warn_below)

    for w in warnings:
        print(w)
    for e in errors:
        print(e)

    print_agent_contract()

    if errors:
        print(f"\n❌ G4 PREFLIGHT FAIL — {len(errors)} lỗi. Không được tuyên bố G4 PASS.\n")
        return 1

    print(f"\n✅ G4 PREFLIGHT PASS — {len(warnings)} warning. Vẫn phải zoom-compare Figma trước DONE.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
