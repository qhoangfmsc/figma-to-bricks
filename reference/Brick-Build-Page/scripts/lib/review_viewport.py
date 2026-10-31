"""Review viewport widths shared by the screenshot step (G3) and the visual gate (G4).

Desktop is fixed at 1440. Mobile follows the Figma mobile frame instead of a constant: the frame
is already laid out at a device width (375, 390, 414…) and is exported 1:1, so reviewing at that
same width compares like with like. Scaling the reference up to a fixed 390 leaves the browser
laying out at 390 CSS px while every reference dimension grows a few percent, and the two drift
further apart down the section even when the build is exact.
"""
from __future__ import annotations

from pathlib import Path

DESKTOP_WIDTH = 1440
MOBILE_FALLBACK_WIDTH = 390
# Outside this range a "mobile" frame is a scaled mock (@2x/@3x) rather than a device-width layout.
MOBILE_WIDTH_RANGE = (320, 600)


def is_device_width(width: float) -> bool:
    low, high = MOBILE_WIDTH_RANGE
    return low <= width <= high


def figma_mobile_png(evidence_dir: Path, template_id: int) -> Path | None:
    """G4 keeps the Figma exports beside the Bricks shots: <evidence>/../figma/tpl_<id>_mobile_*.png."""
    matches = sorted((Path(evidence_dir).parent / "figma").glob(f"tpl_{template_id}_mobile_*.png"))
    return matches[0] if matches else None


def mobile_review_width(figma_mobile_png: Path | None) -> int:
    """Width to render the Bricks mobile review at, read off the 1:1 Figma mobile export."""
    if not figma_mobile_png or not Path(figma_mobile_png).is_file():
        return MOBILE_FALLBACK_WIDTH
    from PIL import Image

    with Image.open(figma_mobile_png) as img:
        width = img.width
    return width if is_device_width(width) else MOBILE_FALLBACK_WIDTH
