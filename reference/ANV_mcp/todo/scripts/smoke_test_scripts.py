#!/usr/bin/env python3
"""
smoke_test_scripts.py — Kiểm tra nhanh mọi script trong todo/scripts/ còn chạy được.

Bắt loại lỗi từng lọt lưới: script chết vì import file đã xóa, argparse gọi sai
tham số giữa các script (vd review_gates từng truyền positional vào script chỉ
nhận --flags), dependency thiếu. KHÔNG kiểm tra logic nghiệp vụ — chỉ là lưới
an toàn "script không sập khi mời chạy".

Tiêu chí PASS cho từng script:
  - `python3 <script> --help` không văng Traceback
  - exit code thuộc {0, 1, 2} (0 = help ok; 1/2 = usage error có kiểm soát)

Usage (từ thư mục todo/):
  python3 scripts/smoke_test_scripts.py
"""
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SELF = Path(__file__).name


def run_help(script: Path):
    result = subprocess.run(
        [sys.executable, str(script), "--help"],
        capture_output=True, text=True, timeout=30,
        cwd=str(SCRIPTS_DIR.parent),  # chạy từ todo/ như quy ước hệ thống
    )
    output = result.stdout + result.stderr
    if "Traceback" in output:
        return False, f"exit={result.returncode}, có Traceback:\n{output.strip()[:500]}"
    if result.returncode not in (0, 1, 2):
        return False, f"exit={result.returncode} bất thường:\n{output.strip()[:300]}"
    return True, f"exit={result.returncode}"


def main():
    scripts = sorted(p for p in SCRIPTS_DIR.glob("*.py") if p.name != SELF)
    print(f"\n{'='*60}\n  SMOKE TEST — {len(scripts)} script trong todo/scripts/\n{'='*60}")

    failures = []
    for script in scripts:
        try:
            ok, detail = run_help(script)
        except subprocess.TimeoutExpired:
            ok, detail = False, "timeout 30s khi chạy --help"
        status = "✅" if ok else "❌"
        print(f"  {status} {script.name}  ({detail.splitlines()[0]})")
        if not ok:
            failures.append((script.name, detail))

    print(f"{'='*60}")
    if failures:
        print(f"  ❌ {len(failures)} script FAIL:")
        for name, detail in failures:
            print(f"\n  --- {name} ---\n  {detail}")
        sys.exit(1)
    print("  ✅ Tất cả script chạy được.\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
