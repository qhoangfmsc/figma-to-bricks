"""WordPress session via curl — dùng cho review screenshot (thay wp-cli)."""
from __future__ import annotations

import base64
import os
import re
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .chrome_cdp import capture_screenshot
from .env_loader import load_env

COOKIE_FILE = Path("/tmp/wpcookies.txt")
CHROME_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def wp_login(cookie_file: Path | None = None, env: dict | None = None) -> Path:
    cfg = env or load_env()
    base = cfg.get("WP_URL", "http://localhost:8000").rstrip("/")
    user = cfg["WP_USER"]
    password = cfg["WP_PASS"]
    cookies = cookie_file or COOKIE_FILE

    subprocess.run([
        "curl", "-s", "-c", str(cookies), "-b", str(cookies), "-L",
        f"{base}/wp-login.php",
        "-d", f"log={user}&pwd={password}&wp-submit=Log+In&redirect_to={base}&testcookie=1",
        "-o", "/dev/null",
    ], check=True)
    return cookies


def fetch_authenticated_html(url: str, output: Path, cookie_file: Path | None = None, env: dict | None = None) -> Path:
    cookies = cookie_file or wp_login(env=env)
    subprocess.run([
        "curl", "-s", "-b", str(cookies), url, "-o", str(output),
    ], check=True)
    return output


def _inline_localhost_assets(html: str) -> str:
    """Replace localhost URLs with inline equivalents for Chrome headless file:// rendering.

    1. Fetches and inlines all <link rel="stylesheet" href="http://localhost:..."> as <style>.
    2. Replaces all remaining http://localhost:PORT/... image URLs with base64 data URIs.
    """
    import urllib.request
    import base64
    import re

    def fetch_text(url: str) -> str:
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception:
            return ""

    def fetch_as_datauri(url: str) -> str:
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                content_type = resp.headers.get_content_type() or "image/png"
                data = base64.b64encode(resp.read()).decode("ascii")
                return f"data:{content_type};base64,{data}"
        except Exception:
            return url

    # Step 1: Inline <link rel="stylesheet" href="http://localhost:..."> as <style>
    def inline_link(m: re.Match) -> str:
        href = m.group(1)
        if not href.startswith("http://localhost"):
            return m.group(0)
        css_text = fetch_text(href)
        if not css_text:
            return m.group(0)
        # Replace localhost image URLs inside CSS with data URIs
        css_text = re.sub(
            r'url\((http://localhost:\d+/[^)]+)\)',
            lambda cm: f'url({fetch_as_datauri(cm.group(1))})',
            css_text,
        )
        return f'<style>{css_text}</style>'

    html = re.sub(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\'][^>]*/?>',
        inline_link,
        html,
    )
    # Also handle href before rel
    html = re.sub(
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']stylesheet["\'][^>]*/?>',
        inline_link,
        html,
    )

    # Step 2: Inline remaining localhost image URLs as data URIs
    seen: dict[str, str] = {}

    def replace_img(m: re.Match) -> str:
        url = m.group(1)
        if url not in seen:
            seen[url] = fetch_as_datauri(url)
        return seen[url]

    html = re.sub(r'(http://localhost:\d+/[^\s"\')\]]+)', replace_img, html)
    return html


def prepare_review_html(html_path: Path, viewport_width: int, hide_chrome: bool = True) -> None:
    """Strip site chrome so template screenshots match isolated Figma sections."""
    import re

    html = html_path.read_text(encoding="utf-8")
    if hide_chrome:
        inject = """
<style id="b2p-review-chrome">
#wpadminbar, #brx-header, #brx-footer, header.brxe-section, footer.brxe-section { display:none !important; }
html { margin-top:0 !important; }
body.admin-bar { padding-top:0 !important; }
#brxe-vdpdnq, #brxe-drdsks, #brxe-ktayvs { display:none !important; }
</style>
"""
        html = html.replace("</head>", inject + "</head>", 1)
    if viewport_width:
        html = re.sub(
            r'<meta name="viewport" content="[^"]*">',
            f'<meta name="viewport" content="width={viewport_width}, initial-scale=1">',
            html,
            count=1,
        )
    html = _inline_localhost_assets(html)
    html_path.write_text(html, encoding="utf-8")


def screenshot_html(html_path: Path, png_path: Path, width: int = 1440, height: int = 2000) -> Path:
    png_path.parent.mkdir(parents=True, exist_ok=True)
    prepare_review_html(html_path, viewport_width=width)
    run_chrome_screenshot(f"file://{html_path.resolve()}", png_path, width, height)
    return png_path


CHROME_TIMEOUT_SECONDS = 90
ASSET_URL_RE = re.compile(
    r"(http://localhost:\d+/[^\s\"')\]>]+?\.(?:png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf)(?:\?[^\s\"')\]>]*)?)",
    re.I,
)
# Remote Figma assets (rule 2) are inlined too: a slow remote fetch inside Chrome pauses
# virtual time indefinitely and the screenshot never fires.
FIGMA_ASSET_URL_RE = re.compile(r"(https://www\.figma\.com/api/mcp/asset/[A-Za-z0-9\-/]+(?:\.(?:png|jpe?g|gif|webp|svg))?)")
STYLESHEET_LINK_RES = (
    re.compile(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\'][^>]*>'),
    re.compile(r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']stylesheet["\'][^>]*>'),
)
# Webfonts live on a remote <link>: Chrome shoots the file:// review before the stylesheet and
# its woff2 arrive, falls back to a system font, and every text metric drifts off the Figma
# reference. Inline the CSS and the font files so the first paint already has the real font.
WEBFONT_CSS_HOSTS = ("fonts.googleapis.com", "use.typekit.net", "fonts.bunny.net")
WEBFONT_FILE_RE = re.compile(
    r"(https://(?:fonts\.gstatic\.com|fonts\.bunny\.net|use\.typekit\.net)/[^\s\"')]+?\.(?:woff2?|ttf|otf))", re.I
)
# Google Fonts serves woff2 only to browsers it recognises; curl's default UA gets fat TTFs.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def is_inlinable_stylesheet(href: str) -> bool:
    return "localhost" in href or any(host in href for host in WEBFONT_CSS_HOSTS)


FONT_FACE_RE = re.compile(r"@font-face\s*\{[^}]*\}", re.I)
UNICODE_RANGE_RE = re.compile(r"unicode-range:\s*([^;}]+)", re.I)
# Google Fonts splits every family into ~20 unicode-range subsets. Inlining all of them pushes
# the review HTML past the point where Chrome finishes within CHROME_TIMEOUT_SECONDS, so keep
# only the subsets that can render Vietnamese/Latin copy: latin, latin-ext, vietnamese.
REVIEW_SAMPLE_CODEPOINTS = (0x41, 0x1AF, 0x1EBF)


def covers_review_text(unicode_range: str) -> bool:
    for part in unicode_range.split(","):
        bounds = part.strip().lower().removeprefix("u+").split("-")
        try:
            low = int(bounds[0].replace("?", "0"), 16)
            high = int(bounds[-1].replace("?", "f"), 16)
        except ValueError:
            return True
        if any(low <= codepoint <= high for codepoint in REVIEW_SAMPLE_CODEPOINTS):
            return True
    return False


def strip_unused_font_subsets(css: str) -> str:
    def keep(match: re.Match) -> str:
        unicode_range = UNICODE_RANGE_RE.search(match.group(0))
        return match.group(0) if not unicode_range or covers_review_text(unicode_range.group(1)) else ""

    return FONT_FACE_RE.sub(keep, css)
# Tracking / admin-bar / banner-view scripts keep requests open, so Chrome's virtual time never
# runs out and --screenshot hangs. Bricks + jQuery (sliders, lazy-load) must stay.
NON_RENDER_SCRIPT_RE = re.compile(
    r'<script\b[^>]*\bsrc=["\'][^"\']*(?:vietnix-center|admin-bar|hoverintent)[^"\']*["\'][^>]*>\s*</script>',
    re.S,
)
MIME_BY_EXTENSION = {
    "svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "webp": "image/webp", "avif": "image/avif",
    "woff": "font/woff", "woff2": "font/woff2", "ttf": "font/ttf", "otf": "font/otf",
}
# Per-process cache: desktop + mobile shots of one review share every stylesheet/asset fetch.
_FETCH_CACHE: dict[tuple[str, bool], str | bytes] = {}
REVIEW_BASE_CSS = """
#wpadminbar, #brx-header, #brx-footer,
header.brxe-section, footer.brxe-section,
.site-header, .site-footer, nav.navbar,
#brxe-vdpdnq, #brxe-drdsks, #brxe-ktayvs { display:none !important; }
html { margin-top:0 !important; overflow-x:hidden; }
body { margin:0 !important; padding:0 !important; overflow-x:hidden; }
body.admin-bar { padding-top:0 !important; }
#brx-content, main#brx-content {
    padding:0 !important; margin:0 !important;
    max-width:100% !important; width:100% !important;
}
.entry-content, .post-content, article {
    margin:0 !important; padding:0 !important;
    max-width:100% !important; width:100% !important;
}
/* Force Bricks section/container full width */
.brxe-section { max-width:100% !important; }
"""


def _curl(url: str, cookies: Path, *, binary: bool, timeout: int) -> str | bytes:
    key = (url, binary)
    if key not in _FETCH_CACHE:
        try:
            result = subprocess.run(
                ["curl", "-s", "-L", "--max-time", str(timeout), "-A", BROWSER_USER_AGENT, "-b", str(cookies), url],
                capture_output=True, timeout=timeout + 5,
            )
            body = result.stdout if result.returncode == 0 else b""
        except subprocess.TimeoutExpired:
            body = b""
        _FETCH_CACHE[key] = body if binary else body.decode("utf-8", errors="replace")
    return _FETCH_CACHE[key]


def sniff_mime(body: bytes) -> str:
    """Figma MCP asset URLs often have no extension; Chrome drops data URIs typed octet-stream."""
    if body.startswith(b"\x89PNG"):
        return "image/png"
    if body.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if body.startswith(b"GIF8"):
        return "image/gif"
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "image/webp"
    if b"<svg" in body[:512]:
        return "image/svg+xml"
    return "application/octet-stream"


def _data_uri(url: str, cookies: Path) -> str:
    body = _curl(url, cookies, binary=True, timeout=15)
    if not body:
        return url
    extension = url.split("?")[0].rsplit(".", 1)[-1].lower()
    mime = MIME_BY_EXTENSION.get(extension) or sniff_mime(body)
    return f"data:{mime};base64,{base64.b64encode(body).decode('ascii')}"


def build_review_html(url: str, cookies: Path, hide_chrome_css: str = "") -> str:
    """Authenticated HTML with localhost CSS and assets inlined, so Chrome renders from file://.

    Fetches run in parallel: the old one-curl-at-a-time loop also curled every localhost
    link (pages, feeds), which dominated G3 time on asset-heavy templates.
    """
    html = NON_RENDER_SCRIPT_RE.sub("", _curl(url, cookies, binary=False, timeout=30))
    inject = f"<style id='b2p-review'>{REVIEW_BASE_CSS}{hide_chrome_css or ''}</style>"
    html = html.replace("</head>", inject + "</head>", 1)

    stylesheet_urls = {
        match.group(1)
        for pattern in STYLESHEET_LINK_RES
        for match in pattern.finditer(html)
        if is_inlinable_stylesheet(match.group(1))
    }
    with ThreadPoolExecutor(max_workers=8) as pool:
        stylesheets = dict(zip(stylesheet_urls, pool.map(
            lambda href: strip_unused_font_subsets(_curl(href, cookies, binary=False, timeout=10)), stylesheet_urls
        )))

    def replace_link(match: re.Match) -> str:
        css = stylesheets.get(match.group(1))
        return f"<style>{css}</style>" if css else match.group(0)

    for pattern in STYLESHEET_LINK_RES:
        html = pattern.sub(replace_link, html)

    asset_urls = set(ASSET_URL_RE.findall(html)) | set(FIGMA_ASSET_URL_RE.findall(html)) | set(WEBFONT_FILE_RE.findall(html))
    with ThreadPoolExecutor(max_workers=8) as pool:
        data_uris = dict(zip(asset_urls, pool.map(lambda asset: _data_uri(asset, cookies), asset_urls)))
    for pattern in (ASSET_URL_RE, FIGMA_ASSET_URL_RE, WEBFONT_FILE_RE):
        html = pattern.sub(lambda match: data_uris[match.group(1)], html)
    return html


def with_viewport(html: str, width: int) -> str:
    return re.sub(
        r'<meta name="viewport" content="[^"]*">',
        f'<meta name="viewport" content="width={width}, initial-scale=1">',
        html,
        count=1,
    )


# Headless Chrome (old and new mode alike, verified on Chrome 154) never lays a window out
# narrower than this, whatever --window-size says; the PNG is only cropped to the request.
HEADLESS_MIN_WINDOW_WIDTH = 500


def narrow_viewport_frame_url(file_url: str, width: int, height: int, frame_dir: Path) -> str:
    """Media queries inside an iframe resolve against the iframe width, not the window,
    so a 390px mobile review really hits Bricks' ≤478px breakpoint."""
    frame_path = frame_dir / "narrow_viewport_frame.html"
    frame_path.write_text(
        "<!doctype html><html><head><style>"
        "html,body{margin:0;padding:0;overflow:hidden}"
        f"iframe{{display:block;border:0;width:{width}px;height:{height}px}}"
        f'</style></head><body><iframe src="{file_url}" scrolling="no"></iframe></body></html>',
        encoding="utf-8",
    )
    return f"file://{frame_path.resolve()}"


def ensure_chrome_can_launch() -> None:
    """Inside the Cursor agent seatbelt sandbox Chrome (even headless) aborts in
    _RegisterApplication because the WindowServer lookup is denied; macOS then pops a
    "Google Chrome quit unexpectedly — Reopen" dialog per launch. Fail before spawning."""
    if os.environ.get("CURSOR_SANDBOX"):
        raise RuntimeError(
            "Chrome screenshot cannot run inside the Cursor sandbox "
            f"(CURSOR_SANDBOX={os.environ['CURSOR_SANDBOX']}): re-run this command with "
            'required_permissions: ["all"].'
        )


def run_chrome_screenshot(file_url: str, png_path: Path, width: int, height: int) -> None:
    """Prefer the shared CDP Chrome; fall back to a one-shot headless launch if CDP fails."""
    try:
        capture_screenshot(file_url, png_path, width, height)
        return
    except Exception as error:
        print(f"  ⚠ CDP screenshot failed ({error}); falling back to one-shot Chrome")
    run_one_shot_chrome_screenshot(file_url, png_path, width, height)


def run_one_shot_chrome_screenshot(file_url: str, png_path: Path, width: int, height: int) -> None:
    """Headless Chrome on a throwaway profile.

    Without --user-data-dir Chrome attaches to the user's default profile (sync, GCM,
    component updates) and can stall for minutes; virtual time also never ends while a
    request hangs, hence the hard timeout.

    Widths below HEADLESS_MIN_WINDOW_WIDTH are rendered through an iframe wrapper:
    `--headless=new` alone does not lift the 500px window floor.
    """
    ensure_chrome_can_launch()
    started_at = time.time()
    with tempfile.TemporaryDirectory(prefix="b2p-chrome-") as profile_dir:
        if width < HEADLESS_MIN_WINDOW_WIDTH:
            file_url = narrow_viewport_frame_url(file_url, width, height, Path(profile_dir))
        process = subprocess.Popen([
            CHROME_MAC, "--headless=new",
            f"--user-data-dir={profile_dir}",
            "--no-first-run", "--no-default-browser-check",
            "--disable-extensions", "--disable-sync", "--disable-background-networking",
            "--disable-component-update", "--disable-default-apps",
            f"--screenshot={png_path.resolve()}",
            f"--window-size={width},{height}",
            "--hide-scrollbars",
            "--virtual-time-budget=5000",
            "--disable-web-security",
            "--allow-file-access-from-files",
            "--allow-running-insecure-content",
            file_url,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            wait_for_screenshot(process, png_path, started_at)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()


def wait_for_screenshot(process: subprocess.Popen, png_path: Path, started_at: float) -> None:
    """New headless Chrome sometimes keeps running after writing --screenshot; a fresh PNG
    whose size stopped changing is the real completion signal."""
    last_size = -1
    while time.time() - started_at < CHROME_TIMEOUT_SECONDS:
        if process.poll() is not None:
            if process.returncode != 0 and not png_path.exists():
                raise RuntimeError(f"Chrome exited {process.returncode} without {png_path.name}")
            return
        if png_path.exists() and png_path.stat().st_mtime >= started_at:
            size = png_path.stat().st_size
            if size and size == last_size:
                return
            last_size = size
        time.sleep(0.5)
    raise TimeoutError(f"Chrome screenshot timed out after {CHROME_TIMEOUT_SECONDS}s: {png_path.name}")


def screenshot_live_url_viewports(
    url: str,
    shots: list[tuple[Path, int, int]],
    *,
    cookie_file: Path | None = None,
    env: dict | None = None,
    hide_chrome_css: str = "",
) -> list[Path]:
    """One HTML fetch, then one Chrome per (png_path, width, height) in parallel."""
    cookies = cookie_file or COOKIE_FILE
    if not cookies.exists():
        wp_login(cookie_file=cookies, env=env)
    html = build_review_html(url, cookies, hide_chrome_css)
    with tempfile.TemporaryDirectory(prefix="review_") as tmp:
        jobs = []
        for index, (png_path, width, height) in enumerate(shots):
            png_path.parent.mkdir(parents=True, exist_ok=True)
            html_path = Path(tmp) / f"page_{index}.html"
            html_path.write_text(with_viewport(html, width), encoding="utf-8")
            jobs.append((f"file://{html_path.resolve()}", png_path, width, height))
        with ThreadPoolExecutor(max_workers=max(1, len(jobs))) as pool:
            list(pool.map(lambda job: run_chrome_screenshot(*job), jobs))
    return [png_path for png_path, _, _ in shots]


def screenshot_live_url(
    url: str,
    png_path: Path,
    width: int = 1440,
    height: int = 2000,
    *,
    cookie_file: Path | None = None,
    env: dict | None = None,
    hide_chrome_css: str = "",
) -> Path:
    """Screenshot a live http URL using Chrome headless with WP session cookies."""
    screenshot_live_url_viewports(
        url, [(png_path, width, height)], cookie_file=cookie_file, env=env, hide_chrome_css=hide_chrome_css
    )
    return png_path



def is_blank_screenshot(png_path: Path, *, white_threshold: int = 250) -> bool:
    """Check if a screenshot is blank (all near-white pixels).

    Returns True if the image is blank — indicates a failed login redirect
    or page rendering issue.
    """
    if not png_path.is_file():
        return True
    try:
        from PIL import Image
        with Image.open(png_path) as img:
            gray = img.convert("L")
            extrema = gray.getextrema()
            # If min pixel value is above threshold, it's all near-white
            return extrema[0] >= white_threshold
    except Exception:
        return True


def screenshot_html_with_retry(
    html_path: Path,
    png_path: Path,
    width: int = 1440,
    height: int = 2000,
    *,
    max_retries: int = 3,
    env: dict | None = None,
) -> Path | None:
    """Screenshot with automatic retry on blank output.

    Returns the png_path on success, None if all retries produce blank images.
    Re-authenticates (fresh WP login) on each retry.
    """
    for attempt in range(1, max_retries + 1):
        if attempt > 1:
            # Re-authenticate with a fresh session
            print(f"  ⟳ Screenshot retry {attempt}/{max_retries}: re-login...")
            wp_login(env=env)

        screenshot_html(html_path, png_path, width=width, height=height)

        if not is_blank_screenshot(png_path):
            return png_path

        print(f"  ⚠ Screenshot blank (attempt {attempt}/{max_retries})")

    print(f"  ✗ Screenshot failed after {max_retries} retries: {png_path.name}")
    return None
