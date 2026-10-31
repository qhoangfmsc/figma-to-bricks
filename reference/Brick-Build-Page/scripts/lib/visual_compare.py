"""Pixel-level similarity between Figma and Bricks section screenshots (G4 auto).

Anti-aliasing tolerance (2026-06):
  Figma and Chrome headless use different font anti-aliasing (subpixel vs
  grayscale).  This causes 2–5% false pixel diff even when layout is correct.
  Two optional noise-reduction techniques are provided:
    - Gaussian blur (blur_radius) — smooths subpixel rendering differences
    - Pixel tolerance (pixel_tolerance) — ignores small per-channel diffs
  `compare_images` keeps 0 for both; the G4 gate scripts default to the
  G4_* constants below so every "≥98%" score is measured the same way.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageFilter, ImageStat
except ImportError as exc:  # pragma: no cover
    raise ImportError("Install Pillow: pip install Pillow") from exc

# Canonical G4 auto parameters (rule_for_flow.md § Định nghĩa G4). A score is only
# comparable to the threshold when measured with these values, so CLI overrides are
# for diagnosis and must not be used to record a G4 pass.
G4_THRESHOLD_PCT = 98.0
G4_BLUR_RADIUS = 1.0
G4_PIXEL_TOLERANCE = 12


@dataclass
class VisualCompareResult:
    figma_path: Path
    bricks_path: Path
    width: int
    height: int
    similarity_pct: float
    diff_mean: float
    passed: bool
    threshold_pct: float

    def summary(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        return (
            f"{status} {self.similarity_pct:.2f}% "
            f"(threshold {self.threshold_pct:.0f}%) "
            f"{self.bricks_path.name} vs {self.figma_path.name}"
        )


def _load_rgb(path: Path) -> Image.Image:
    """Load image and convert to RGB, compositing transparency against white.

    Figma PNG exports often contain RGBA images with transparent backgrounds.
    Without this, transparent pixels convert to black when calling .convert('RGB'),
    causing false mismatches against Bricks screenshots which have white backgrounds.
    """
    with Image.open(path) as img:
        if img.mode in ("RGBA", "LA", "PA"):
            # Composite against white background before converting to RGB
            white_bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            img_rgba = img.convert("RGBA")
            composited = Image.alpha_composite(white_bg, img_rgba)
            return composited.convert("RGB")
        return img.convert("RGB")


def _trim_content(img: Image.Image, *, threshold: int = 250) -> Image.Image:
    """Crop near-white margins so Bricks canvas height matches Figma section bounds."""
    gray = img.convert("L")
    w, h = gray.size
    pixels = gray.load()
    top, bottom = 0, h - 1
    for y in range(h):
        if any(pixels[x, y] < threshold for x in range(0, w, max(1, w // 200))):
            top = y
            break
    for y in range(h - 1, -1, -1):
        if any(pixels[x, y] < threshold for x in range(0, w, max(1, w // 200))):
            bottom = y
            break
    if bottom <= top:
        return img
    return img.crop((0, top, w, bottom + 1))


def _resize_to_width(img: Image.Image, width: int) -> Image.Image:
    if img.width == width:
        return img
    ratio = width / img.width
    height = max(1, int(img.height * ratio))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def _trim_content_smart(img: Image.Image, *, threshold: int = 250) -> Image.Image:
    """Trim uniform-color margins (white, black, or any solid background).

    Unlike _trim_content which only detects near-white, this detects rows
    where all sampled pixels are within `threshold` distance of each other
    (uniform color), starting from the bottom.
    """
    w, h = img.size
    pixels = img.load()
    step = max(1, w // 200)

    # Find top: first row with non-uniform content
    top = 0
    for y in range(h):
        row_vals = [pixels[x, y] for x in range(0, w, step)]
        if isinstance(row_vals[0], tuple):
            # RGB mode
            mins = tuple(min(v[c] for v in row_vals) for c in range(3))
            maxs = tuple(max(v[c] for v in row_vals) for c in range(3))
            span = max(maxs[c] - mins[c] for c in range(3))
        else:
            span = max(row_vals) - min(row_vals)
        if span > 8:  # row has varied content
            top = y
            break

    # Find bottom: last row with non-uniform content
    bottom = h - 1
    for y in range(h - 1, -1, -1):
        row_vals = [pixels[x, y] for x in range(0, w, step)]
        if isinstance(row_vals[0], tuple):
            mins = tuple(min(v[c] for v in row_vals) for c in range(3))
            maxs = tuple(max(v[c] for v in row_vals) for c in range(3))
            span = max(maxs[c] - mins[c] for c in range(3))
        else:
            span = max(row_vals) - min(row_vals)
        if span > 8:
            bottom = y
            break

    if bottom <= top:
        return img
    return img.crop((0, top, w, bottom + 1))


def _aligned_trim(figma: Image.Image, bricks: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Crop both shots to the section bounds, keeping whichever pass agrees on the height.

    Each pass guesses the content edge per image: the near-white pass finds a section sitting on
    the white page canvas, the uniform-color pass handles a section whose own background fills
    the shot. Chaining them trims twice, and a one-row disagreement between the two images shifts
    the whole section vertically against the other — the diff then reads as a layout error.
    """
    near_white = (_trim_content(figma), _trim_content(bricks))
    uniform_color = tuple(_trim_content_smart(img) for img in near_white)
    return min((near_white, uniform_color), key=lambda pair: abs(pair[0].height - pair[1].height))


def _align_size(
    figma: Image.Image,
    bricks: Image.Image,
    *,
    target_width: int | None,
    trim: bool,
) -> tuple[Image.Image, Image.Image]:
    if target_width:
        fw = target_width
    else:
        fw = min(figma.width, bricks.width)

    figma_r = _resize_to_width(figma, fw)
    bricks_r = _resize_to_width(bricks, fw)

    if trim:
        figma_r, bricks_r = _aligned_trim(figma_r, bricks_r)

    height = min(figma_r.height, bricks_r.height)
    if height <= 0:
        raise ValueError("Aligned image height is zero")
    return figma_r.crop((0, 0, fw, height)), bricks_r.crop((0, 0, fw, height))


def _apply_aa_tolerance(
    img_a: Image.Image,
    img_b: Image.Image,
    *,
    blur_radius: float = 0.0,
    pixel_tolerance: int = 0,
) -> tuple[Image.Image, Image.Image]:
    """Apply anti-aliasing noise reduction before pixel comparison.

    Args:
        blur_radius: Gaussian blur radius (0 = disabled). 1.0–2.0 recommended
            for font AA; larger values lose layout detail.
        pixel_tolerance: Per-channel threshold below which a diff pixel is
            zeroed out (0 = disabled). 10–20 recommended for font AA.
    """
    a, b = img_a, img_b
    if blur_radius > 0:
        kernel = ImageFilter.GaussianBlur(radius=blur_radius)
        a = a.filter(kernel)
        b = b.filter(kernel)
    if pixel_tolerance > 0:
        # We compute the diff, zero out small values, then reconstruct
        # "cleaned" images by subtracting the tolerated noise.
        # This is equivalent to: diff_clean = diff.point(lambda p: 0 if p < tol else p)
        # but we return the images unchanged — tolerance is applied in the
        # caller via the diff image directly.
        pass  # handled in compare_images via diff.point()
    return a, b


def compare_images(
    figma_path: Path,
    bricks_path: Path,
    *,
    target_width: int | None = None,
    threshold_pct: float = 98.0,
    trim: bool = True,
    blur_radius: float = 0.0,
    pixel_tolerance: int = 0,
) -> VisualCompareResult:
    """Return similarity 0–100. Pass when similarity >= threshold_pct.

    Args:
        blur_radius: Gaussian blur before diff (reduces font AA noise).
            0 = disabled (original behavior). Recommended: 1.0–1.5.
        pixel_tolerance: Ignore per-channel diff below this value.
            0 = disabled. Recommended: 10–15 for font AA.
    """
    if not figma_path.is_file():
        raise FileNotFoundError(f"Figma PNG missing: {figma_path}")
    if not bricks_path.is_file():
        raise FileNotFoundError(f"Bricks PNG missing: {bricks_path}")

    figma = _load_rgb(figma_path)
    bricks = _load_rgb(bricks_path)
    figma_a, bricks_a = _align_size(figma, bricks, target_width=target_width, trim=trim)

    # Apply anti-aliasing noise reduction
    figma_c, bricks_c = _apply_aa_tolerance(
        figma_a, bricks_a, blur_radius=blur_radius
    )

    diff = ImageChops.difference(figma_c, bricks_c)

    # Zero out small per-channel diffs (font anti-aliasing artifacts)
    if pixel_tolerance > 0:
        tol = pixel_tolerance
        diff = diff.point(lambda p: 0 if p < tol else p)

    stat = ImageStat.Stat(diff)
    mean_diff = sum(stat.mean) / len(stat.mean)
    similarity = max(0.0, min(100.0, 100.0 * (1.0 - mean_diff / 255.0)))

    return VisualCompareResult(
        figma_path=figma_path,
        bricks_path=bricks_path,
        width=figma_a.width,
        height=figma_a.height,
        similarity_pct=round(similarity, 2),
        diff_mean=round(mean_diff, 4),
        passed=similarity >= threshold_pct,
        threshold_pct=threshold_pct,
    )


def write_diff_image(
    figma_path: Path,
    bricks_path: Path,
    out_path: Path,
    *,
    target_width: int | None = None,
    trim: bool = True,
) -> Path:
    """Write a side-by-side diff PNG for debugging failed G4."""
    figma = _load_rgb(figma_path)
    bricks = _load_rgb(bricks_path)
    figma_a, bricks_a = _align_size(figma, bricks, target_width=target_width, trim=trim)
    diff = ImageChops.difference(figma_a, bricks_a)
    diff_enhanced = diff.point(lambda p: min(255, p * 4))

    w, h = figma_a.width, figma_a.height
    canvas = Image.new("RGB", (w * 3, h))
    canvas.paste(figma_a, (0, 0))
    canvas.paste(bricks_a, (w, 0))
    canvas.paste(diff_enhanced, (w * 2, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path)
    return out_path
