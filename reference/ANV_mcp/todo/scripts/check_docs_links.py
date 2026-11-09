#!/usr/bin/env python3
"""
check_docs_links.py — Quét tài liệu .md của hệ thống, tìm tham chiếu tới file
.md/.py không còn tồn tại trong project (link mục nát).

Vì sao có: hệ thống từng nhiều lần tích tụ tài liệu trỏ tới file đã đổi tên/đã
xóa (elements.md → elements-catalog.md, setup_page_with_templates.py...). Script
này chạy sau mỗi đợt dọn dẹp/đổi tên (CLEANUP.md Bước 5) để lỗi đó không tái phát.

Phạm vi cố ý thu hẹp để không báo láo:
  - Chỉ check đuôi .md/.py — .json thường là tên ví dụ/output phiên, .php là
    trích dẫn source theme Bricks nằm ngoài project.
  - Dòng chứa "không tồn tại/đã xóa/deprecated/cố ý không..." là bia mộ có chủ
    đích — bỏ qua (so sánh sau khi chuẩn hoá Unicode NFC, tiếng Việt có thể
    lưu dạng NFD trên macOS).
  - Bỏ qua CLEANUP.md (bản chất của nó là liệt kê file phiên có-thể-không-tồn-tại).

Usage (từ thư mục todo/ hoặc gốc project):
  python3 scripts/check_docs_links.py
"""
import re
import sys
import unicodedata
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

DOC_DIRS = [
    PROJECT_ROOT,                      # AGENTS.md, infor_todo.md... (chỉ *.md cấp 1)
    PROJECT_ROOT / "todo" / "rules",
    PROJECT_ROOT / "skills",
]

# Không quét NỘI DUNG các thư mục này (references/ trích dẫn source theme dày đặc),
# nhưng file trong đó VẪN được index làm đích hợp lệ.
SCAN_SKIP_DIR_PARTS = {".venv", ".git", "node_modules", "__MACOSX", "references", "FigmaToCode"}
INDEX_SKIP_DIR_PARTS = {".venv", ".git", "node_modules", "__MACOSX"}

SCAN_SKIP_FILENAMES = {"CLEANUP.md"}

FILENAME_RE = re.compile(r"[\w][\w\-./]*\.(?:md|py)\b")

TOMBSTONE_HINTS = tuple(unicodedata.normalize("NFC", h) for h in (
    "không tồn tại", "đã xóa", "đã xoá", "deprecated", "không được viết",
    "cố ý không", "chưa từng tồn tại", "đã bị xoá", "đã bị xóa", "not exist",
    "đã hợp nhất", "đã gộp", "đã ngưng", "không đáng xây",
))

GENERIC_NAMES = {
    # Placeholder/shorthand trong tài liệu — không phải file cụ thể
    "validate.py",  # shorthand trong sơ đồ phase (bricks_rules.md §12)
    "page.md",
}


def collect_doc_files():
    docs = []
    for base in DOC_DIRS:
        if base == PROJECT_ROOT:
            docs.extend(base.glob("*.md"))
        else:
            docs.extend(
                p for p in base.rglob("*.md")
                if not (SCAN_SKIP_DIR_PARTS & set(p.parts)) and p.name not in SCAN_SKIP_FILENAMES
            )
    return sorted(set(docs))


def build_filename_index():
    """Mọi basename thật trong project (trừ .venv/.git) — tra nhanh theo tên."""
    names = set()
    for path in PROJECT_ROOT.rglob("*"):
        if INDEX_SKIP_DIR_PARTS & set(path.parts):
            continue
        if path.is_file():
            names.add(path.name)
    return names


def is_generic(name: str) -> bool:
    base = name.rsplit("/", 1)[-1]
    if base in GENERIC_NAMES:
        return True
    return any(ch in name for ch in "<>{}*")


def main():
    index = build_filename_index()
    docs = collect_doc_files()
    broken = []

    for doc in docs:
        text = unicodedata.normalize("NFC", doc.read_text(encoding="utf-8"))
        for lineno, line in enumerate(text.splitlines(), 1):
            lowered = line.lower()
            if any(hint in lowered for hint in TOMBSTONE_HINTS):
                continue  # bia mộ có chủ đích — dòng này được phép nhắc file đã xóa
            for match in FILENAME_RE.findall(line):
                base = match.rsplit("/", 1)[-1]
                if is_generic(match) or base in index or f".{base}" in index:
                    continue
                broken.append((doc.relative_to(PROJECT_ROOT), lineno, match))

    print(f"\n{'='*60}\n  DOCS LINK CHECK — {len(docs)} tài liệu\n{'='*60}")
    if not broken:
        print("  ✅ Không có tham chiếu gãy.\n")
        sys.exit(0)

    print(f"  ❌ {len(broken)} tham chiếu tới file không tồn tại:")
    for doc, lineno, name in broken:
        print(f"    - {doc}:{lineno} → `{name}`")
    print("\n  → Sửa tên file trong tài liệu, hoặc thêm ghi chú 'đã xóa/không tồn tại'"
          "\n    vào cùng dòng nếu đây là tham chiếu lịch sử có chủ đích.\n")
    sys.exit(1)


if __name__ == "__main__":
    main()
