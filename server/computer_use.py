"""Computer takeover: see the screen, move the mouse, type, press keys.

The loop the model runs is screenshot -> act -> look again. Every action
returns a fresh screenshot so the model verifies what actually happened
instead of assuming its click landed.

Coordinates the model gives are in the pixels of the last screenshot it saw.
Screenshots are scaled down to keep them cheap to send, so we remember the
scale and the monitor origin and map back to real screen pixels here.

Kill switches, any of which stops the next action:
* slam the mouse into any screen corner (pyautogui's fail-safe),
* the HUD's interrupt button,
* POST /api/computer/stop (for the tray app or a phone shortcut).
After a stop, actions stay refused until the operator sends a new prompt.
"""

from __future__ import annotations

import base64
import io
import sys
import threading
import time
from typing import Any

MAX_WIDTH = 1366          # downscale target; keeps a 4K capture affordable
SETTLE_SECONDS = 0.6      # let the UI repaint before the verification shot

_stop = threading.Event()
_view: dict[str, Any] = {"scale": 1.0, "left": 0, "top": 0, "monitor": 1}
_dpi_set = False


class Stopped(RuntimeError):
    """The operator pulled the kill switch."""


def stop() -> None:
    _stop.set()


def rearm() -> None:
    _stop.clear()


def stopped() -> bool:
    return _stop.is_set()


def _deps():
    """Import lazily so the server starts on machines without a display."""
    global _dpi_set
    try:
        import mss
        import pyautogui
        from PIL import Image
    except ImportError as exc:  # pragma: no cover - depends on host
        raise RuntimeError(
            "Computer control needs `pip install pyautogui mss pillow`."
        ) from exc
    if sys.platform == "win32" and not _dpi_set:
        # Without this, Windows scaling (125%/150%) makes pyautogui's
        # coordinates disagree with the captured pixels.
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            try:
                import ctypes
                ctypes.windll.user32.SetProcessDPIAware()
            except Exception:
                pass
        _dpi_set = True
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.05
    return mss, pyautogui, Image


def screenshot(monitor: int = 1) -> tuple[str, str]:
    """Capture a monitor. Returns (base64 PNG, description)."""
    mss, _, Image = _deps()
    with mss.mss() as sct:
        mons = sct.monitors
        if monitor < 1 or monitor >= len(mons):
            monitor = 1
        mon = mons[monitor]
        raw = sct.grab(mon)
        img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
    scale = min(1.0, MAX_WIDTH / img.width)
    if scale < 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)))
    _view.update(scale=scale, left=mon["left"], top=mon["top"], monitor=monitor)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    desc = (
        f"Screenshot of monitor {monitor} ({len(mons) - 1} available): {img.width}x{img.height} "
        f"pixels. Give coordinates in these pixels; (0,0) is the top-left."
    )
    return base64.b64encode(buf.getvalue()).decode("ascii"), desc


def _to_screen(x: float, y: float) -> tuple[int, int]:
    s = _view["scale"] or 1.0
    return round(_view["left"] + x / s), round(_view["top"] + y / s)


ACTIONS = ("click", "double_click", "right_click", "move", "drag", "type",
           "key", "hotkey", "scroll", "wait")


def act(p: dict) -> str:
    """Perform one action. Raises Stopped if a kill switch is active."""
    if _stop.is_set():
        raise Stopped("the kill switch is on; send a new prompt to re-arm")
    _, pg, _ = _deps()
    action = p.get("action")
    if action not in ACTIONS:
        raise ValueError(f"action must be one of {ACTIONS}")

    def xy(kx="x", ky="y") -> tuple[int, int]:
        if p.get(kx) is None or p.get(ky) is None:
            raise ValueError(f"{action} needs {kx} and {ky}")
        return _to_screen(float(p[kx]), float(p[ky]))

    try:
        if action in ("click", "double_click", "right_click"):
            x, y = xy()
            fn = {"click": pg.click, "double_click": pg.doubleClick,
                  "right_click": pg.rightClick}[action]
            fn(x, y)
            done = f"{action} at screenshot ({p['x']},{p['y']})"
        elif action == "move":
            x, y = xy()
            pg.moveTo(x, y, duration=0.15)
            done = f"moved to ({p['x']},{p['y']})"
        elif action == "drag":
            x, y = xy()
            x2, y2 = xy("x2", "y2")
            pg.moveTo(x, y)
            pg.dragTo(x2, y2, duration=0.4, button="left")
            done = f"dragged ({p['x']},{p['y']}) -> ({p['x2']},{p['y2']})"
        elif action == "type":
            text = str(p.get("text", ""))
            if not text:
                raise ValueError("type needs text")
            pg.write(text, interval=0.01)
            done = f"typed {len(text)} characters"
        elif action == "key":
            key = str(p.get("key", "")).lower()
            if not key:
                raise ValueError("key needs key, e.g. enter, tab, esc")
            pg.press(key)
            done = f"pressed {key}"
        elif action == "hotkey":
            keys = [str(k).lower() for k in (p.get("keys") or [])]
            if not keys:
                raise ValueError("hotkey needs keys, e.g. ['ctrl', 's']")
            pg.hotkey(*keys)
            done = f"pressed {'+'.join(keys)}"
        elif action == "scroll":
            if p.get("x") is not None and p.get("y") is not None:
                pg.moveTo(*xy())
            amount = int(p.get("amount", -5))
            pg.scroll(amount * 100 if sys.platform == "win32" else amount)
            done = f"scrolled {amount}"
        else:  # wait
            secs = max(0.0, min(float(p.get("seconds", 1)), 30.0))
            time.sleep(secs)
            done = f"waited {secs:g}s"
    except pg.FailSafeException as exc:
        _stop.set()
        raise Stopped("mouse hit a screen corner (fail-safe); stopping") from exc
    time.sleep(SETTLE_SECONDS)
    return done
