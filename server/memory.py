"""Persistence: conversation history (SQLite) and the memory tool backend.

Two distinct things share this module:

1. `Store` -- durable conversation log. Lets a session survive a restart and
   gives the HUD something to replay.

2. `MemoryTool` -- the client-side backend for Anthropic's `memory_20250818`
   tool. The model reads and writes Markdown files under data/memories, which
   is what makes "self-learning" a real mechanism rather than a claim: nothing
   about the weights changes, but durable notes accumulate on disk and are
   injected into every later session.

Every path the model supplies is untrusted input. `_resolve` is the only way
into the filesystem from this module, and it refuses anything that escapes the
memory root.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from . import config

MEMORY_MOUNT = "/memories"
MAX_FILE_BYTES = 256 * 1024
DIGEST_BUDGET_CHARS = 12000


# ==========================================================================
# Conversation store
# ==========================================================================

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    expert      TEXT,
    created_at  REAL,
    updated_at  REAL
);
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,          -- JSON-encoded content blocks
    created_at  REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
CREATE TABLE IF NOT EXISTS usage (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT,
    model           TEXT,
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    cache_read      INTEGER,
    cache_write     INTEGER,
    created_at      REAL
);
"""


class Store:
    def __init__(self, path: Path | None = None):
        import atexit
        self.path = path or config.DB_PATH
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA)
        self._conn.commit()
        atexit.register(self.close)

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    def ensure_session(self, session_id: str, expert: str) -> None:
        now = time.time()
        self._conn.execute(
            "INSERT INTO sessions (id, title, expert, created_at, updated_at) "
            "VALUES (?, NULL, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
            "expert = excluded.expert, updated_at = excluded.updated_at",
            (session_id, expert, now, now),
        )
        self._conn.commit()

    def append(self, session_id: str, role: str, content: Any) -> None:
        self._conn.execute(
            "INSERT INTO messages (session_id, role, content, created_at) VALUES (?,?,?,?)",
            (session_id, role, json.dumps(content, default=str), time.time()),
        )
        self._conn.commit()

    def history(self, session_id: str) -> list[dict]:
        rows = self._conn.execute(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
        return [{"role": r["role"], "content": json.loads(r["content"])} for r in rows]

    def record_usage(self, session_id: str, model: str, u: dict) -> None:
        self._conn.execute(
            "INSERT INTO usage (session_id, model, input_tokens, output_tokens, "
            "cache_read, cache_write, created_at) VALUES (?,?,?,?,?,?,?)",
            (
                session_id, model,
                u.get("input_tokens", 0), u.get("output_tokens", 0),
                u.get("cache_read_input_tokens", 0),
                u.get("cache_creation_input_tokens", 0),
                time.time(),
            ),
        )
        self._conn.commit()

    def totals(self) -> dict:
        row = self._conn.execute(
            "SELECT COALESCE(SUM(input_tokens),0) i, COALESCE(SUM(output_tokens),0) o, "
            "COALESCE(SUM(cache_read),0) cr FROM usage"
        ).fetchone()
        return {"input": row["i"], "output": row["o"], "cache_read": row["cr"]}

    def sessions(self, limit: int = 30) -> list[dict]:
        rows = self._conn.execute(
            "SELECT id, title, expert, updated_at FROM sessions "
            "ORDER BY updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


# ==========================================================================
# Memory tool backend
# ==========================================================================

class MemoryError_(Exception):
    """Returned to the model as an is_error tool result, not raised to the user."""


class MemoryTool:
    """Filesystem-backed implementation of Anthropic's `memory_20250818` tool."""

    name = "memory"
    definition = {"type": "memory_20250818", "name": "memory"}

    def __init__(self, root: Path | None = None):
        self.root = (root or config.MEMORY_DIR).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    # -- path safety -------------------------------------------------------
    def _resolve(self, raw: str) -> Path:
        """Map a model-supplied path into the memory root, or refuse.

        Rejects traversal, absolute paths outside the mount, and symlinks that
        point out of the root. This is the only filesystem entry point.
        """
        if not isinstance(raw, str) or not raw.strip():
            raise MemoryError_("path is required")
        p = raw.replace("\\", "/").strip()
        if p.startswith(MEMORY_MOUNT):
            p = p[len(MEMORY_MOUNT):]
        p = p.lstrip("/")
        candidate = (self.root / p).resolve()
        if candidate != self.root and self.root not in candidate.parents:
            raise MemoryError_(f"path escapes {MEMORY_MOUNT}: {raw}")
        return candidate

    def _display(self, p: Path) -> str:
        rel = p.relative_to(self.root).as_posix()
        return f"{MEMORY_MOUNT}/{rel}" if rel != "." else MEMORY_MOUNT

    # -- commands ----------------------------------------------------------
    def execute(self, payload: dict) -> tuple[str, bool]:
        """Run one memory command. Returns (text, is_error)."""
        try:
            cmd = payload.get("command")
            handler = getattr(self, f"_cmd_{cmd}", None)
            if handler is None:
                raise MemoryError_(f"unknown command: {cmd!r}")
            return handler(payload), False
        except MemoryError_ as exc:
            return f"Error: {exc}", True
        except OSError as exc:
            return f"Error: {exc.__class__.__name__}: {exc}", True

    def _cmd_view(self, p: dict) -> str:
        target = self._resolve(p["path"])
        if target.is_dir():
            entries = sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name))
            if not entries:
                return f"{self._display(target)} is empty."
            lines = [f"Directory {self._display(target)}:"]
            for e in entries:
                lines.append(f"  {e.name}/" if e.is_dir() else f"  {e.name}  ({e.stat().st_size} B)")
            return "\n".join(lines)
        if not target.exists():
            raise MemoryError_(f"no such file: {self._display(target)}")
        text = target.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()
        rng = p.get("view_range")
        start = 1
        if isinstance(rng, list) and len(rng) == 2:
            start = max(1, int(rng[0]))
            end = len(lines) if int(rng[1]) == -1 else int(rng[1])
            lines = lines[start - 1:end]
        return "\n".join(f"{i + start:>4}\t{ln}" for i, ln in enumerate(lines))

    def _cmd_create(self, p: dict) -> str:
        target = self._resolve(p["path"])
        body = p.get("file_text", "")
        if len(body.encode("utf-8")) > MAX_FILE_BYTES:
            raise MemoryError_(f"file exceeds {MAX_FILE_BYTES} bytes")
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            backup = target.with_suffix(target.suffix + ".bak")
            backup.write_text(target.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
        target.write_text(body, encoding="utf-8")
        return f"Wrote {len(body)} chars to {self._display(target)}"

    def _cmd_str_replace(self, p: dict) -> str:
        target = self._resolve(p["path"])
        if not target.is_file():
            raise MemoryError_(f"no such file: {self._display(target)}")
        text = target.read_text(encoding="utf-8", errors="replace")
        old, new = p.get("old_str", ""), p.get("new_str", "")
        count = text.count(old)
        if count == 0:
            raise MemoryError_("old_str not found")
        if count > 1:
            raise MemoryError_(f"old_str matched {count} times; must be unique")
        target.write_text(text.replace(old, new, 1), encoding="utf-8")
        return f"Replaced 1 occurrence in {self._display(target)}"

    def _cmd_insert(self, p: dict) -> str:
        target = self._resolve(p["path"])
        if not target.is_file():
            raise MemoryError_(f"no such file: {self._display(target)}")
        lines = target.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
        at = int(p.get("insert_line", 0))
        if at < 0 or at > len(lines):
            raise MemoryError_(f"insert_line {at} out of range (0..{len(lines)})")
        chunk = p.get("insert_text", "")
        if not chunk.endswith("\n"):
            chunk += "\n"
        lines.insert(at, chunk)
        target.write_text("".join(lines), encoding="utf-8")
        return f"Inserted after line {at} in {self._display(target)}"

    def _cmd_delete(self, p: dict) -> str:
        target = self._resolve(p["path"])
        if target == self.root:
            raise MemoryError_("refusing to delete the memory root")
        if target.is_dir():
            if any(target.iterdir()):
                raise MemoryError_("directory not empty")
            target.rmdir()
        elif target.exists():
            target.unlink()
        else:
            raise MemoryError_(f"no such path: {self._display(target)}")
        return f"Deleted {self._display(target)}"

    def _cmd_rename(self, p: dict) -> str:
        src = self._resolve(p["old_path"])
        dst = self._resolve(p["new_path"])
        if not src.exists():
            raise MemoryError_(f"no such path: {self._display(src)}")
        if dst.exists():
            raise MemoryError_(f"destination exists: {self._display(dst)}")
        dst.parent.mkdir(parents=True, exist_ok=True)
        src.rename(dst)
        return f"Renamed to {self._display(dst)}"

    # -- introspection for the HUD and the system prompt -------------------
    def listing(self) -> list[dict]:
        out = []
        for f in sorted(self.root.rglob("*.md")):
            try:
                text = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            out.append({
                "path": self._display(f),
                "bytes": f.stat().st_size,
                "mtime": f.stat().st_mtime,
                "headline": next((l.strip("# ").strip() for l in text.splitlines() if l.strip()), ""),
            })
        return out

    def digest(self, budget: int = DIGEST_BUDGET_CHARS) -> str:
        """Concatenate memory files, newest first, until the budget is spent."""
        files = sorted(self.root.rglob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True)
        chunks: list[str] = []
        used = 0
        for f in files:
            try:
                body = f.read_text(encoding="utf-8", errors="replace").strip()
            except OSError:
                continue
            block = f"## {self._display(f)}\n{body}"
            if used + len(block) > budget:
                remaining = budget - used
                if remaining > 400:
                    chunks.append(block[:remaining] + "\n…(truncated)")
                break
            chunks.append(block)
            used += len(block)
        return "\n\n".join(chunks)

    def bootstrap(self) -> None:
        """Seed an index file the first time, so the model knows the layout."""
        index = self.root / "00-index.md"
        if index.exists():
            return
        index.write_text(
            "# Memory index\n\n"
            f"Durable notes for {config.PRINCIPAL}. One topic per file, kebab-case "
            "names, Markdown.\n\n"
            "Conventions:\n"
            "- `preferences-*.md` — how the operator wants work done, and why.\n"
            "- `project-*.md` — ongoing work, goals, constraints not in the repo.\n"
            "- `technique-*.md` — a method that worked, with the conditions it "
            "worked under.\n"
            "- `reference-*.md` — pointers to external resources.\n\n"
            "Rules: update an existing file rather than duplicating it. Delete "
            "notes that turn out to be wrong. Do not record anything already "
            "recoverable from a repo or the chat log. Never store credentials "
            "here.\n",
            encoding="utf-8",
        )
