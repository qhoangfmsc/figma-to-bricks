#!/usr/bin/env python3
"""
diff_screenshots.py — Tín hiệu diff khách quan bổ trợ cho Gate G4.

Vấn đề đang vá: G4 hiện tại 100% dựa vào agent tự nhìn 2 ảnh (Figma vs WordPress)
rồi tự chấm điểm theo rubric.md — cùng một agent vừa build vừa chấm bài mình, không
có đối trọng khách quan nào. Script này KHÔNG thay thế rubric/agent review (nó không
hiểu ngữ nghĩa — nội dung thật khác placeholder vẫn ra diff cao mà không phải lỗi),
mà bổ sung 1 con số đo được: % pixel lệch + heatmap khoanh vùng + top-N vùng lệch
nhiều nhất. Nếu similarity thấp mà agent vẫn định báo PASS, agent phải tự giải trình
vùng lệch đó trước — tạo ma sát chống thiên vị "tự chấm điểm mình".

Không tự quyết PASS/FAIL — luôn exit 0. Dùng `--warn-below` để chọn ngưỡng in cảnh báo.

Usage (từ thư mục todo/):
  python3 scripts/diff_screenshots.py \\
      --figma scratch/g3/figma-sec100-desktop.png \\
      --wp scratch/g3/sec100-desktop.png \\
      --out-dir scratch/g3/diff \\
      --label sec100-desktop

Output:
  scratch/g3/diff/<label>-heatmap.png   — ảnh WP với vùng lệch tô đỏ
  scratch/g3/diff/<label>-report.json   — similarity_pct + top_regions (đọc được bởi
                                           validate_g4_preflight.py --diff-report-*)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("LỖI: cần 'Pillow' và 'numpy' (đã có sẵn trong .venv của project).")
    sys.exit(1)


def load_rgb(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def parse_grid(raw: str) -> tuple[int, int]:
    try:
        cols_s, rows_s = raw.lower().split("x")
        return int(cols_s), int(rows_s)
    except Exception:
        raise argparse.ArgumentTypeError(f"--grid phải theo dạng COLSxROWS, vd. 6x4 (nhận '{raw}')")


def compute_diff(figma_img: Image.Image, wp_img: Image.Image, channel_threshold: int):
    """Resize WP screenshot về đúng kích thước Figma (ground truth layout) rồi diff pixel."""
    aspect_figma = figma_img.width / figma_img.height
    aspect_wp = wp_img.width / wp_img.height
    aspect_drift_pct = abs(aspect_figma - aspect_wp) / aspect_figma * 100

    wp_resized = wp_img.resize(figma_img.size, Image.LANCZOS) if wp_img.size != figma_img.size else wp_img

    arr_figma = np.asarray(figma_img).astype(np.int16)
    arr_wp = np.asarray(wp_resized).astype(np.int16)

    per_channel_diff = np.abs(arr_figma - arr_wp)
    max_channel_diff = per_channel_diff.max(axis=2)  # H x W, 0-255
    mask = max_channel_diff > channel_threshold

    return {
        "mask": mask,
        "max_channel_diff": max_channel_diff,
        "wp_resized": wp_resized,
        "aspect_drift_pct": round(aspect_drift_pct, 2),
        "similarity_pct": round(100 * (1 - mask.mean()), 2),
    }


def grid_report(mask: "np.ndarray", width: int, height: int, cols: int, rows: int, top_n: int) -> list[dict]:
    cell_w = width // cols
    cell_h = height // rows
    cells = []
    for r in range(rows):
        y0 = r * cell_h
        y1 = height if r == rows - 1 else (r + 1) * cell_h
        for c in range(cols):
            x0 = c * cell_w
            x1 = width if c == cols - 1 else (c + 1) * cell_w
            cell_mask = mask[y0:y1, x0:x1]
            diff_pct = round(float(cell_mask.mean()) * 100, 2)
            cells.append({"row": r, "col": c, "bbox": [x0, y0, x1, y1], "diff_pct": diff_pct})
    cells.sort(key=lambda cell: -cell["diff_pct"])
    return cells[:top_n]


def make_heatmap(wp_resized: Image.Image, mask: "np.ndarray", alpha: float = 0.55) -> Image.Image:
    arr = np.asarray(wp_resized).astype(np.float32)
    red = np.array([255, 0, 0], dtype=np.float32)
    overlay = arr.copy()
    overlay[mask] = arr[mask] * (1 - alpha) + red * alpha
    return Image.fromarray(overlay.astype(np.uint8))


def main() -> int:
    parser = argparse.ArgumentParser(description="Diff khách quan Figma vs WordPress screenshot — tín hiệu bổ trợ G4")
    parser.add_argument("--figma", required=True, help="Ảnh Figma (get_screenshot)")
    parser.add_argument("--wp", required=True, help="Ảnh WordPress (screenshot_templates.py)")
    parser.add_argument("--out-dir", required=True, help="Thư mục lưu heatmap + report JSON")
    parser.add_argument("--label", required=True, help="Tên section-viewport, vd. sec100-desktop")
    parser.add_argument("--channel-threshold", type=int, default=30, help="Delta RGB (0-255) coi là 'khác' (default 30)")
    parser.add_argument("--warn-below", type=float, default=90.0, help="In cảnh báo nếu similarity%% dưới ngưỡng này (default 90)")
    parser.add_argument("--grid", type=parse_grid, default=(6, 4), help="Lưới phân vùng COLSxROWS để tìm top vùng lệch (default 6x4)")
    parser.add_argument("--top-n", type=int, default=5, help="Số vùng lệch nhiều nhất cần liệt kê (default 5)")
    args = parser.parse_args()

    figma_path = Path(args.figma)
    wp_path = Path(args.wp)
    for p, label in ((figma_path, "--figma"), (wp_path, "--wp")):
        if not p.is_file():
            print(f"\n❌ FAIL — {label} không tồn tại: {p}")
            return 1

    print(f"\n{'=' * 55}")
    print("  Diff khách quan (bổ trợ G4) — không thay thế rubric review")
    print(f"  Figma: {figma_path}")
    print(f"  WP:    {wp_path}")
    print(f"{'=' * 55}")

    figma_img = load_rgb(figma_path)
    wp_img = load_rgb(wp_path)
    result = compute_diff(figma_img, wp_img, args.channel_threshold)

    if result["aspect_drift_pct"] > 5:
        print(
            f"  ⚠️  Tỷ lệ khung hình lệch {result['aspect_drift_pct']}% "
            f"(Figma {figma_img.width}x{figma_img.height} vs WP {wp_img.width}x{wp_img.height}) — "
            f"resize để so màu/spacing vẫn chạy được, nhưng lệch tỷ lệ lớn thường tự nó là dấu hiệu layout sai."
        )

    cols, rows = args.grid
    top_regions = grid_report(result["mask"], figma_img.width, figma_img.height, cols, rows, args.top_n)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    heatmap = make_heatmap(result["wp_resized"], result["mask"])
    heatmap_path = out_dir / f"{args.label}-heatmap.png"
    heatmap.save(heatmap_path)

    report = {
        "label": args.label,
        "figma": str(figma_path),
        "wp": str(wp_path),
        "channel_threshold": args.channel_threshold,
        "similarity_pct": result["similarity_pct"],
        "aspect_drift_pct": result["aspect_drift_pct"],
        "top_regions": top_regions,
        "heatmap": str(heatmap_path),
    }
    report_path = out_dir / f"{args.label}-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n  Similarity: {result['similarity_pct']}%  (threshold delta={args.channel_threshold})")
    print(f"  Heatmap: {heatmap_path}")
    print(f"  Report:  {report_path}")
    print(f"\n  Top {len(top_regions)} vùng lệch nhiều nhất:")
    for region in top_regions:
        print(f"    - {region['diff_pct']}% lệch @ bbox{region['bbox']} (row={region['row']}, col={region['col']})")

    if result["similarity_pct"] < args.warn_below:
        print(
            f"\n  ⚠️  Similarity {result['similarity_pct']}% < ngưỡng {args.warn_below}% — "
            f"trước khi báo G4 PASS, tự kiểm tra lại các vùng lệch ở trên (có thể là lệch thật, "
            f"hoặc chỉ là nội dung thật khác placeholder — không tự động suy ra FAIL)."
        )
    else:
        print(f"\n  ✅ Similarity ≥ {args.warn_below}% — không có cảnh báo bổ sung.")

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
