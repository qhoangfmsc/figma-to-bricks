#!/usr/bin/env python3
"""PostToolUse hook (Write|Edit) — auto-run G1 (validate_template_json.py --strict)
whenever a todo/bricks-json/*.json file is written or edited, and feed failures
back into context automatically instead of relying on a manual run."""
import json
import subprocess
import sys
from pathlib import Path

VALIDATOR = Path(__file__).resolve().parent.parent / "validate_template_json.py"


def main():
    payload = json.load(sys.stdin)
    file_path = (payload.get("tool_input") or {}).get("file_path", "")
    if not file_path.endswith(".json") or "/bricks-json/" not in file_path:
        return
    result = subprocess.run(
        [sys.executable, str(VALIDATOR), file_path, "--strict"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": (
                    f"G1 (validate_template_json.py --strict) FAILED for {file_path}:\n"
                    f"{result.stdout}{result.stderr}"
                ),
            }
        }
        print(json.dumps(output))


if __name__ == "__main__":
    main()
