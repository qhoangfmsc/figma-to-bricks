#!/usr/bin/env python3
"""
rehost_assets.py — Chuyển ảnh Figma cache (localhost:3845) về WP Media Library.

Vì sao bắt buộc (mọi môi trường, không phân biệt local/remote): URL Figma cache
chỉ resolve trên MÁY BUILD khi Figma Desktop đang mở. Khách truy cập từ bất kỳ
máy nào khác (hoặc sau khi tắt Figma) sẽ thấy ảnh vỡ. Trước khi công bố trang
cho khách thật, phải re-host toàn bộ asset về chính site WP rồi upload lại JSON.

Cách hoạt động:
  1. Quét TOÀN BỘ chuỗi trong JSON (settings, _cssCustom, page settings...) tìm
     URL dạng http://localhost:3845/... — bắt cả URL nằm trong CSS custom.
  2. Tải từng file từ Figma cache (cần Figma Desktop đang mở).
  3. Upload lên WP qua bridge tool `upload_media` (bridge >= 1.3.0).
  4. Thay URL cũ → URL mới trong JSON (dry-run mặc định; --apply mới ghi file,
     có backup .bak). Sau đó re-upload JSON bằng upload_section.py / MCP tool.

Usage (từ thư mục todo/):
  python3 scripts/rehost_assets.py bricks-json/sec100.json                  # dry-run
  python3 scripts/rehost_assets.py bricks-json/*.json --apply              # ghi thật
  python3 scripts/rehost_assets.py bricks-json/sec100.json --apply --report scratch/rehost-map.json
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.lib.bricks_mcp import upload_media, BricksMCPError

FIGMA_CACHE_URL_RE = re.compile(r"https?://localhost:3845/[^\s\"'\\)<>]+")

EXT_BY_CONTENT_TYPE = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}


def find_figma_urls(raw_text: str) -> list:
    """Mọi URL Figma cache duy nhất trong file, theo thứ tự xuất hiện."""
    seen = []
    for match in FIGMA_CACHE_URL_RE.findall(raw_text):
        if match not in seen:
            seen.append(match)
    return seen


def download(url: str) -> tuple:
    """Trả về (bytes, filename) — filename lấy từ URL, sniff extension nếu thiếu."""
    with urllib.request.urlopen(url, timeout=30) as resp:
        content = resp.read()
        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip()
    name = url.rstrip("/").rsplit("/", 1)[-1] or "asset"
    if "." not in name:
        name += EXT_BY_CONTENT_TYPE.get(content_type, ".png")
    return content, name


def rehost_file(json_path: Path, apply_changes: bool, url_map: dict) -> tuple:
    """Xử lý 1 file JSON. Trả về (số URL đã map, số lỗi)."""
    raw = json_path.read_text(encoding="utf-8")
    urls = find_figma_urls(raw)
    if not urls:
        print(f"  ✅ {json_path.name}: không có URL Figma cache nào — bỏ qua.")
        return 0, 0

    print(f"  📦 {json_path.name}: {len(urls)} URL Figma cache")
    failures = 0
    for url in urls:
        if url in url_map:
            print(f"     ↺ (đã upload trong lượt này) {url}")
            continue
        try:
            content, filename = download(url)
        except Exception as exc:
            print(f"     ❌ Tải lỗi {url}: {exc}")
            print("        → Figma Desktop có đang mở không? URL cache chỉ sống khi app chạy.")
            failures += 1
            continue
        try:
            result = upload_media(filename, content)
        except BricksMCPError as exc:
            print(f"     ❌ Upload lỗi {filename}: {exc}")
            if "Unknown tool" in str(exc):
                print("        → Bridge trên site chưa có tool upload_media — cập nhật plugin lên bản 1.3.0 (plugins/bricks-mcp-bridge.zip).")
            failures += 1
            continue
        new_url = result.get("url")
        if not new_url:
            print(f"     ❌ Upload không trả về url: {result}")
            failures += 1
            continue
        url_map[url] = new_url
        print(f"     ✅ {filename} → {new_url} (attachment {result.get('attachment_id')})")

    mapped_here = [u for u in urls if u in url_map]
    if apply_changes and mapped_here:
        new_raw = raw
        for old, new in url_map.items():
            new_raw = new_raw.replace(old, new)
        backup = json_path.with_suffix(json_path.suffix + ".bak")
        backup.write_text(raw, encoding="utf-8")
        json_path.write_text(new_raw, encoding="utf-8")
        print(f"     💾 Đã ghi {json_path.name} (backup: {backup.name}) — nhớ re-upload JSON lên template/page.")
    elif mapped_here:
        print(f"     ℹ️  Dry-run: {len(mapped_here)} URL sẽ được thay khi chạy lại với --apply.")

    return len(mapped_here), failures


def main():
    ap = argparse.ArgumentParser(description="Re-host ảnh Figma cache (localhost:3845) về WP Media qua bridge.")
    ap.add_argument("json_files", nargs="+", help="Các file bricks-json cần xử lý")
    ap.add_argument("--apply", action="store_true",
                    help="Ghi thay đổi vào file (mặc định: dry-run chỉ upload + in mapping)")
    ap.add_argument("--report", default=None,
                    help="Ghi mapping url cũ → mới ra file JSON (để đối chiếu/tái dùng)")
    args = ap.parse_args()

    print(f"\n{'='*60}\n  RE-HOST ASSETS — Figma cache → WP Media (bridge upload_media)\n{'='*60}")

    url_map: dict = {}
    total_mapped = 0
    total_failures = 0
    for file_arg in args.json_files:
        path = Path(file_arg)
        if not path.is_file():
            print(f"  ❌ Không tìm thấy: {path}")
            total_failures += 1
            continue
        mapped, failures = rehost_file(path, args.apply, url_map)
        total_mapped += mapped
        total_failures += failures

    if args.report and url_map:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(url_map, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n  📄 Mapping report: {report_path}")

    print(f"\n{'='*60}")
    if total_failures:
        print(f"  ❌ Hoàn tất có lỗi: {total_mapped} URL đã map, {total_failures} lỗi.")
        sys.exit(1)
    print(f"  ✅ Hoàn tất: {total_mapped} URL đã map, 0 lỗi."
          + ("" if args.apply else " (dry-run — chạy lại với --apply để ghi file)"))
    print(f"{'='*60}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
