"""Access gate for the local J.A.R.V.I.S. agent.

The server exposes shell execution, desktop control and an autonomous agent
loop, so every /api and /ws route is gated here, in one place, rather than
per handler. A request is let through when either:

* it carries the agent token (X-Jarvis-Token, Authorization: Bearer, or
  ?token= for media elements that cannot set headers), or
* it genuinely originates on this machine: loopback peer, not relayed by a
  proxy or tunnel, addressed to a loopback Host, and not a cross-site browser
  request from an origin we do not know.

Everything else gets 401. With no JARVIS_AGENT_TOKEN configured, remote access
is closed entirely -- fail closed, never fail open.

The "genuinely local" test has three parts because a loopback peer address
alone proves little:

* A tunnel (cloudflared, ngrok) runs on this machine, so internet traffic
  arrives from 127.0.0.1. Forwarding headers give it away.
* Any web page open in a local browser can POST to http://127.0.0.1:8777.
  The Origin / Sec-Fetch-Site headers give that away.
* DNS rebinding makes a hostile page same-origin with us. The Host header
  (their name, not ours) gives that away.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from urllib.parse import parse_qs

from . import config

LOOPBACK_PEERS = {"127.0.0.1", "::1", "::ffff:127.0.0.1"}
LOOPBACK_HOSTNAMES = {"127.0.0.1", "localhost", "[::1]", "::1"}

# Set by reverse proxies and tunnels; never by a direct local client.
FORWARDING_HEADERS = (
    "x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded",
    "cf-connecting-ip", "cf-ray", "true-client-ip",
)

# Paths that stay open: the liveness probe the status pill polls. It reports
# only "healthy" and whether a token is required.
PUBLIC_PATHS = {"/api/health"}
GATED_PREFIXES = ("/api/", "/ws")
GATED_EXACT = {"/ws", "/docs", "/redoc", "/openapi.json"}

SESSION_COOKIE = "jarvis_session"
SESSION_MAX_AGE = 30 * 24 * 3600

_DEFAULT_ORIGINS = [
    "http://localhost:8777", "http://127.0.0.1:8777",
    "http://localhost:5173", "http://127.0.0.1:5173",
]


def allowed_origins() -> list[str]:
    """Origins from config.json (cors.allowedOrigins), plus the local defaults."""
    origins = list(_DEFAULT_ORIGINS)
    try:
        cfg = json.loads((config.ROOT / "config.json").read_text(encoding="utf-8"))
        for origin in cfg.get("cors", {}).get("allowedOrigins", []):
            origin = str(origin).rstrip("/")
            if origin and origin not in origins:
                origins.append(origin)
    except (OSError, ValueError):
        pass
    return origins


def cors_origins() -> list[str]:
    """Origins CORS answers to. Wider than the tokenless-local set: the APK's
    bundled offline shell may call us cross-origin, but only with a token."""
    return allowed_origins() + ["https://jarvis.fold7.local"]


def _is_gated(path: str) -> bool:
    if path in PUBLIC_PATHS:
        return False
    return path in GATED_EXACT or path.startswith(GATED_PREFIXES)


def _hostname(host_header: str) -> str:
    host = host_header.strip().lower()
    if host.startswith("["):                 # [::1]:8777
        return host.split("]")[0] + "]"
    return host.rsplit(":", 1)[0] if ":" in host else host


class AccessGate:
    """Pure ASGI middleware so it covers HTTP, WebSocket and mounted apps alike."""

    def __init__(self, app):
        self.app = app
        self.origins = set(allowed_origins())

    # -- decision -----------------------------------------------------------
    def _token_ok(self, headers: dict[str, str], query: bytes) -> bool:
        expected = os.environ.get("JARVIS_AGENT_TOKEN", "").strip()
        if not expected:
            return False
        auth = headers.get("authorization", "").strip()
        bearer = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
        provided = headers.get("x-jarvis-token", "").strip() or bearer
        if not provided and query:
            provided = (parse_qs(query.decode("latin-1")).get("token") or [""])[0].strip()
        return bool(provided) and hmac.compare_digest(provided.encode(), expected.encode())

    # <img>, <video> and download links cannot send a header, so a request that
    # proves the token is handed a session cookie the browser then attaches to
    # same-origin media requests. The cookie holds a keyed digest, not the token.
    @staticmethod
    def _session_value() -> str:
        expected = os.environ.get("JARVIS_AGENT_TOKEN", "").strip()
        if not expected:
            return ""
        return hmac.new(expected.encode(), b"jarvis-session-v1", hashlib.sha256).hexdigest()

    def _cookie_ok(self, headers: dict[str, str]) -> bool:
        want = self._session_value()
        if not want:
            return False
        got = ""
        for part in headers.get("cookie", "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == SESSION_COOKIE:
                got = value.strip()
        if not got or not hmac.compare_digest(got.encode(), want.encode()):
            return False
        # A cookie rides along automatically, so refuse it on anything that is
        # not a same-origin request. SameSite=Strict already does this in the
        # browser; this is the server-side half.
        if headers.get("sec-fetch-site", "") == "cross-site":
            return False
        origin = headers.get("origin", "").rstrip("/")
        if origin:
            host = headers.get("host", "").strip().lower()
            return origin.split("://", 1)[-1].lower() == host
        return True

    def _is_local(self, scope, headers: dict[str, str]) -> bool:
        client = scope.get("client")
        if not client or client[0] not in LOOPBACK_PEERS:
            return False
        if any(h in headers for h in FORWARDING_HEADERS):
            return False
        if _hostname(headers.get("host", "")) not in LOOPBACK_HOSTNAMES:
            return False
        origin = headers.get("origin", "").rstrip("/")
        if origin:
            return origin in self.origins
        # No Origin: a non-browser client, or a same-origin browser GET.
        return headers.get("sec-fetch-site", "") != "cross-site"

    def decide(self, scope) -> str:
        """Returns how the request is authorized: 'token', 'cookie', 'local' or ''."""
        headers = {k.decode("latin-1").lower(): v.decode("latin-1")
                   for k, v in scope.get("headers", [])}
        if self._token_ok(headers, scope.get("query_string", b"")):
            return "token" if not self._cookie_ok(headers) else "cookie"
        if self._cookie_ok(headers):
            return "cookie"
        return "local" if self._is_local(scope, headers) else ""

    def authorized(self, scope) -> bool:
        return bool(self.decide(scope))

    # -- ASGI ---------------------------------------------------------------
    async def __call__(self, scope, receive, send):
        kind = scope["type"]
        if kind not in ("http", "websocket") or not _is_gated(scope.get("path", "")):
            return await self.app(scope, receive, send)
        how = self.decide(scope)
        if how == "token" and kind == "http":
            cookie = (f"{SESSION_COOKIE}={self._session_value()}; Path=/; HttpOnly; "
                      f"SameSite=Strict; Max-Age={SESSION_MAX_AGE}").encode()

            async def send_with_cookie(message):
                if message["type"] == "http.response.start":
                    message = {**message, "headers": [*message.get("headers", []),
                                                      (b"set-cookie", cookie)]}
                await send(message)

            return await self.app(scope, receive, send_with_cookie)
        if how:
            return await self.app(scope, receive, send)

        if kind == "websocket":
            # Closing before accept makes the handshake fail with HTTP 403.
            await send({"type": "websocket.close", "code": 1008})
            return

        token_set = bool(os.environ.get("JARVIS_AGENT_TOKEN", "").strip())
        body = json.dumps({
            "ok": False,
            "error": ("Unauthorized: missing or invalid X-Jarvis-Token" if token_set else
                      "Unauthorized: remote access is disabled until JARVIS_AGENT_TOKEN is set"),
        }).encode()
        await send({
            "type": "http.response.start",
            "status": 401,
            "headers": [(b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode()),
                        (b"cache-control", b"no-store")],
        })
        await send({"type": "http.response.body", "body": body})
