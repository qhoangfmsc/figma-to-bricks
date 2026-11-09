#!/usr/bin/env python3
"""
review_gates.py — Chạy tổng hợp Gate G1 + G2 + G2.5 cho một section.

Usage:
  python3 review_gates.py <section_key> <plan_file.md> <json_file.json> [options]
  python3 review_gates.py sec100 plans/<slug>.md bricks-json/sec100.json --template-id 9117

Options:
  --template-id N   Template post ID cho G2 (validate_css_compiled). Nếu bỏ trống,
                    tự tra section_key trong template_mapping.json (--mapping).
  --mapping PATH    Path tới template_mapping.json (mặc định: todo/plans/template_mapping.json)
  --skip-g1         Bỏ qua Gate G1
  --skip-g2         Bỏ qua Gate G2
  --skip-g25        Bỏ qua Gate G2.5
  --strict          Chạy G1 ở chế độ strict
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
DEFAULT_MAPPING = SCRIPTS_DIR.parent / 'plans' / 'template_mapping.json'


def run_gate(gate_name: str, cmd: list) -> bool:
    """Chạy một gate script và trả về True nếu PASS."""
    print(f"\n{'─'*55}")
    print(f"  🔍 Đang chạy {gate_name}...")
    print(f"{'─'*55}")
    result = subprocess.run(cmd, capture_output=False, text=True)
    return result.returncode == 0


def resolve_template_id(section_key: str, explicit_id, mapping_path: Path):
    """Lấy template_id cho G2: ưu tiên --template-id, fallback template_mapping.json.

    Schema mapping (thống nhất toàn hệ thống, xem MAPPING-FIGMA-FLOW.md):
      { "<section_key>": {"template_id": <int>, "url": "..."}, "page": {"page_id": <int>} }
    """
    if explicit_id:
        return int(explicit_id)
    if not mapping_path.is_file():
        return None
    try:
        mapping = json.loads(mapping_path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  ⚠️  Không đọc được mapping {mapping_path}: {exc}")
        return None
    entry = mapping.get(section_key)
    if isinstance(entry, dict) and entry.get('template_id'):
        return int(entry['template_id'])
    return None


def main():
    parser = argparse.ArgumentParser(description='Chạy tổng hợp Gate G1 + G2 + G2.5 cho một section.')
    parser.add_argument('section_key')
    parser.add_argument('plan_file')
    parser.add_argument('json_file')
    parser.add_argument('--template-id', type=int, default=None,
                        help='Template post ID cho G2 (nếu bỏ trống: tra template_mapping.json)')
    parser.add_argument('--mapping', default=str(DEFAULT_MAPPING),
                        help='Path tới template_mapping.json')
    parser.add_argument('--skip-g1', action='store_true')
    parser.add_argument('--skip-g2', action='store_true')
    parser.add_argument('--skip-g25', action='store_true')
    parser.add_argument('--strict', action='store_true')
    args = parser.parse_args()

    print(f"\n{'═'*55}")
    print(f"  🚦 REVIEW GATES — Section: {args.section_key}")
    print(f"  JSON: {args.json_file}")
    print(f"{'═'*55}")

    results = {}

    # Gate G1
    if not args.skip_g1:
        g1_cmd = [sys.executable, str(SCRIPTS_DIR / 'validate_template_json.py'), args.json_file]
        if args.strict:
            g1_cmd.append('--strict')
        results['G1'] = run_gate('Gate G1 (JSON Validate)', g1_cmd)
    else:
        print("\n  ⏭️  Gate G1 — BỎ QUA (--skip-g1)")
        results['G1'] = None

    # Gate G2 — validate_css_compiled cần template post ID, không phải section key
    if not args.skip_g2:
        template_id = resolve_template_id(args.section_key, args.template_id, Path(args.mapping))
        if template_id:
            g2_cmd = [
                sys.executable, str(SCRIPTS_DIR / 'validate_css_compiled.py'),
                '--template-id', str(template_id),
            ]
            results['G2'] = run_gate(f'Gate G2 (CSS Compiled, template {template_id})', g2_cmd)
        else:
            print(f"\n  ⚠️  Gate G2 — không xác định được template_id cho '{args.section_key}' "
                  f"(truyền --template-id hoặc thêm entry vào {args.mapping}), bỏ qua")
            results['G2'] = None
    else:
        print("\n  ⏭️  Gate G2 — BỎ QUA (--skip-g2)")
        results['G2'] = None

    # Gate G2.5
    if not args.skip_g25:
        g25_cmd = [
            sys.executable, str(SCRIPTS_DIR / 'validate_section_structure.py'),
            args.section_key, args.plan_file, args.json_file,
        ]
        results['G2.5'] = run_gate('Gate G2.5 (DOM Structure)', g25_cmd)
    else:
        print("\n  ⏭️  Gate G2.5 — BỎ QUA (--skip-g25)")
        results['G2.5'] = None

    # Tổng kết
    print(f"\n{'═'*55}")
    print(f"  📊 TỔNG KẾT — Section: {args.section_key}")
    print(f"{'═'*55}")

    all_pass = True
    for gate, result in results.items():
        if result is True:
            print(f"  ✅ {gate}: PASS")
        elif result is False:
            print(f"  ❌ {gate}: FAIL")
            all_pass = False
        else:
            print(f"  ⏭️  {gate}: SKIPPED")

    print(f"{'═'*55}")
    if all_pass:
        print("  ✅ TẤT CẢ GATES PASS — Sẵn sàng upload!")
        print("  → Upload: python3 scripts/upload_section.py <template_id> <json_file>")
    else:
        print("  ❌ CÓ GATE FAIL — Sửa lỗi trước khi upload!")
    print(f"{'═'*55}\n")

    sys.exit(0 if all_pass else 1)


if __name__ == '__main__':
    main()
