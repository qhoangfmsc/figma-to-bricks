"""Persistent headless Chrome driven over CDP for review screenshots (G3/G4).

Why: launching a fresh Chrome per screenshot costs seconds to minutes and leaks processes.
One long-lived instance is reused, and `Emulation.setDeviceMetricsOverride` gives a real
390px viewport (the CLI `--window-size` is floored at 500px).

Stop the shared instance with: python3 -m scripts.lib.chrome_cdp stop
"""
from __future__ import annotations

import base64
import json
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

import websocket

CHROME_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEBUG_PORT = 9333
PROFILE_DIR = Path("/tmp/b2p-chrome-cdp-profile")
PID_FILE = Path("/tmp/b2p-chrome-cdp.pid")
STARTUP_TIMEOUT_SECONDS = 20
COMMAND_TIMEOUT_SECONDS = 30
# Bricks sliders and lazy-load need a moment after the load event; the old pipeline got this
# from --virtual-time-budget=5000.
POST_LOAD_SETTLE_SECONDS = 1.0
DEBUG_BASE_URL = f"http://127.0.0.1:{DEBUG_PORT}"


def _is_debug_endpoint_alive() -> bool:
    try:
        with urllib.request.urlopen(f"{DEBUG_BASE_URL}/json/version", timeout=1):
            return True
    except Exception:
        return False


def ensure_shared_chrome() -> None:
    if _is_debug_endpoint_alive():
        return
    if os.environ.get("CURSOR_SANDBOX"):
        raise RuntimeError(
            "Chrome cannot launch inside the Cursor sandbox: re-run with required_permissions: [\"all\"]."
        )
    process = subprocess.Popen([
        CHROME_MAC, "--headless=new",
        f"--remote-debugging-port={DEBUG_PORT}",
        f"--user-data-dir={PROFILE_DIR}",
        "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", "--disable-sync", "--disable-background-networking",
        "--disable-component-update", "--disable-default-apps",
        "--hide-scrollbars",
        "--disable-web-security", "--allow-file-access-from-files", "--allow-running-insecure-content",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    PID_FILE.write_text(str(process.pid))
    deadline = time.time() + STARTUP_TIMEOUT_SECONDS
    while time.time() < deadline:
        if _is_debug_endpoint_alive():
            return
        time.sleep(0.2)
    raise TimeoutError(f"Shared Chrome did not expose port {DEBUG_PORT} within {STARTUP_TIMEOUT_SECONDS}s")


def stop_shared_chrome() -> None:
    if not PID_FILE.exists():
        return
    try:
        os.kill(int(PID_FILE.read_text()), signal.SIGTERM)
    except (ProcessLookupError, ValueError):
        pass
    PID_FILE.unlink(missing_ok=True)


def _http_json(path: str, method: str = "GET") -> dict:
    request = urllib.request.Request(f"{DEBUG_BASE_URL}{path}", method=method)
    with urllib.request.urlopen(request, timeout=COMMAND_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


class _PageSession:
    def __init__(self, websocket_url: str) -> None:
        self._connection = websocket.create_connection(
            websocket_url, timeout=COMMAND_TIMEOUT_SECONDS, suppress_origin=True
        )
        self._next_id = 0

    def call(self, method: str, **params) -> dict:
        self._next_id += 1
        call_id = self._next_id
        self._connection.send(json.dumps({"id": call_id, "method": method, "params": params}))
        while True:
            message = json.loads(self._connection.recv())
            if message.get("id") == call_id:
                if "error" in message:
                    raise RuntimeError(f"CDP {method} failed: {message['error']}")
                return message.get("result", {})

    def wait_for_event(self, event_name: str, timeout: float) -> None:
        deadline = time.time() + timeout
        self._connection.settimeout(timeout)
        while time.time() < deadline:
            message = json.loads(self._connection.recv())
            if message.get("method") == event_name:
                return
        raise TimeoutError(f"CDP event {event_name} not received within {timeout}s")

    def close(self) -> None:
        self._connection.close()


# One shared browser composites every tab into one surface: two tabs capturing at different
# device metrics at the same time hand each other tiles, and the wider shot comes back as the
# narrow page repeated across the frame. Captures therefore run one at a time.
_CAPTURE_LOCK = threading.Lock()


def capture_screenshot(file_url: str, png_path: Path, width: int, height: int, *, load_timeout: float = 60) -> None:
    with _CAPTURE_LOCK:
        _capture_screenshot(file_url, png_path, width, height, load_timeout=load_timeout)


def _capture_screenshot(file_url: str, png_path: Path, width: int, height: int, *, load_timeout: float = 60) -> None:
    ensure_shared_chrome()
    target = _http_json("/json/new?about:blank", method="PUT")
    session = _PageSession(target["webSocketDebuggerUrl"])
    try:
        session.call("Page.enable")
        session.call(
            "Emulation.setDeviceMetricsOverride",
            width=width, height=height, deviceScaleFactor=1, mobile=False,
        )
        session.call("Page.navigate", url=file_url)
        session.wait_for_event("Page.loadEventFired", load_timeout)
        session.call(
            "Runtime.evaluate",
            expression="document.fonts ? document.fonts.ready.then(() => true) : true",
            awaitPromise=True,
        )
        time.sleep(POST_LOAD_SETTLE_SECONDS)
        result = session.call("Page.captureScreenshot", format="png", captureBeyondViewport=False)
        png_path.write_bytes(base64.b64decode(result["data"]))
    finally:
        session.close()
        try:
            urllib.request.urlopen(f"{DEBUG_BASE_URL}/json/close/{target['id']}", timeout=5).close()
        except Exception:
            pass


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "stop":
        stop_shared_chrome()
    else:
        ensure_shared_chrome()
        print(f"Shared Chrome ready on port {DEBUG_PORT}")
