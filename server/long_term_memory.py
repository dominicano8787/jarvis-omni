r"""PHASE 2: J.A.R.V.I.S. 'Never Forget' Persistent Long-Term Memory & Cross-Device Sync Engine.

Provides:
- Durable SQLite + JSON/Markdown mirrored memory vault (`D:\Jarvis\data\never_forget.db`)
  that persists preferences, projects, and conversations across restarts.
- Automatic fact extraction from live conversations so J.A.R.V.I.S. remembers user preferences,
  active projects (Anime Studio, CompTIA Security+ SY0-701, Ghidra, WendyOS), and milestones.
- Full CRUD operations (View, Add, Edit, Delete) via REST API, Natural Language Chat Commands,
  and Autonomous ReAct Agent tool calls.
- Bi-directional delta/merge synchronization between Windows PC (`JARVIS.exe`) and
  Samsung Galaxy Z Fold 7 (`SM-F966U` `.apk` / GitHub Cloud `dominicano8787/jarvis-omni`).
"""

from __future__ import annotations

import atexit
import hashlib
import json
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import config

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
NEVER_FORGET_DB = DATA_DIR / "never_forget.db"
SYNC_JSON_PATH = config.MEMORY_DIR / "NEVER_FORGET_SYNC.json"

DEFAULT_CORE_MEMORIES: list[dict[str, Any]] = [
    {
        "memory_id": "mem-001",
        "category": "preference",
        "key": "Voice & Persona Profile",
        "value": "Uses ElevenLabs / en-GB-RyanNeural British Male J.A.R.V.I.S. voice; addresses user as 'Sir' with crisp engineering precision.",
        "tags": ["voice", "elevenlabs", "persona", "preference"],
        "source_device": "system-bootstrap",
        "pinned": 1,
    },
    {
        "memory_id": "mem-002",
        "category": "device_state",
        "key": "Cross-Platform Hardware & Cloud Topology",
        "value": "Runs natively on Windows PC (JARVIS.exe) and Samsung Galaxy Z Fold 7 (SM-F966U, Snapdragon 8 Elite, Android 16), synced via 24/7 GitHub Cloud Server (https://dominicano8787.github.io/jarvis-omni/).",
        "tags": ["pc", "zfold7", "sm-f966u", "github-cloud", "sync"],
        "source_device": "system-bootstrap",
        "pinned": 1,
    },
    {
        "memory_id": "mem-003",
        "category": "anime_project",
        "key": "Anime Production & Animation Studio Project",
        "value": "User is developing an anime project requiring consistent character design sheets, storyboards (e-konte), scene-to-scene continuity, and live AniList/Jikan anime intelligence.",
        "tags": ["anime", "animation", "storyboard", "character-design", "project"],
        "source_device": "system-bootstrap",
        "pinned": 1,
    },
    {
        "memory_id": "mem-004",
        "category": "security_study",
        "key": "CompTIA Security+ (SY0-701) Certification Mastery",
        "value": "User is mastering CompTIA Security+ (SY0-701) across all 5 official domains and all 14 LabEx Linux hands-on cybersecurity training labs.",
        "tags": ["security+", "sy0-701", "comptia", "labex", "cybersecurity"],
        "source_device": "system-bootstrap",
        "pinned": 1,
    },
    {
        "memory_id": "mem-005",
        "category": "project",
        "key": "Reverse Engineering & Physical AI Subsystems",
        "value": "Active workstation modules include Ghidra 12.1.4 Binary Triage/Decompiler and WendyOS (wendylabsinc) Physical AI Jetson Orin edge mesh.",
        "tags": ["ghidra", "wendyos", "physical-ai", "reverse-engineering"],
        "source_device": "system-bootstrap",
        "pinned": 1,
    },
]


def _iso_utc(ts: float | None = None) -> str:
    return datetime.fromtimestamp(ts or time.time(), tz=timezone.utc).isoformat()


class NeverForgetMemory:
    """Persistent Long-Term Memory Vault with View, Edit, Delete, Auto-Capture & Cross-Device Sync."""

    def __init__(self, db_path: Path | None = None):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        config.MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path or NEVER_FORGET_DB
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        atexit.register(self.close)
        self._init_schema()
        self._seed_defaults()

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS never_forget_memories (
                memory_id       TEXT PRIMARY KEY,
                category        TEXT NOT NULL,
                key             TEXT NOT NULL,
                value           TEXT NOT NULL,
                tags_json       TEXT NOT NULL DEFAULT '[]',
                source_device   TEXT NOT NULL DEFAULT 'windows-pc-exe',
                pinned          INTEGER NOT NULL DEFAULT 0,
                version         INTEGER NOT NULL DEFAULT 1,
                created_at      REAL NOT NULL,
                updated_at      REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_nf_category ON never_forget_memories(category);
            CREATE INDEX IF NOT EXISTS idx_nf_updated ON never_forget_memories(updated_at DESC);

            CREATE TABLE IF NOT EXISTS conversation_journal (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      TEXT NOT NULL,
                role            TEXT NOT NULL,
                content         TEXT NOT NULL,
                source_device   TEXT NOT NULL DEFAULT 'windows-pc-exe',
                extracted_mem   TEXT,
                created_at      REAL NOT NULL
            );
            """
        )
        self._conn.commit()

    def _seed_defaults(self) -> None:
        cur = self._conn.execute("SELECT COUNT(*) AS cnt FROM never_forget_memories").fetchone()
        if cur and cur["cnt"] > 0:
            return
        now = time.time()
        for item in DEFAULT_CORE_MEMORIES:
            self._conn.execute(
                """
                INSERT OR IGNORE INTO never_forget_memories
                (memory_id, category, key, value, tags_json, source_device, pinned, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    item["memory_id"],
                    item["category"],
                    item["key"],
                    item["value"],
                    json.dumps(item["tags"]),
                    item["source_device"],
                    item["pinned"],
                    now,
                    now,
                ),
            )
        self._conn.commit()
        self._export_sync_snapshot()

    def _row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "memory_id": row["memory_id"],
            "category": row["category"],
            "key": row["key"],
            "value": row["value"],
            "tags": json.loads(row["tags_json"] or "[]"),
            "source_device": row["source_device"],
            "pinned": bool(row["pinned"]),
            "version": row["version"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "updated_iso": _iso_utc(row["updated_at"]),
        }

    def _export_sync_snapshot(self) -> None:
        """Mirrors the SQLite memory bank to JSON and Markdown for instant PC/Phone/GitHub Cloud sync."""
        try:
            items = self.list_memories(limit=500)
            payload = {
                "schema_version": "4.2-never-forget",
                "synced_at": _iso_utc(),
                "count": len(items),
                "memories": items,
            }
            SYNC_JSON_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

            # Also update MEMORY.md summary block so legacy MemoryTool sees all Never-Forget items
            md_lines = [
                "# J.A.R.V.I.S. Never-Forget Persistent Memory Index",
                f"*Last Synced: {_iso_utc()} | Total Memories: {len(items)}*\n",
            ]
            for m in items[:50]:
                pin_badge = "[PINNED] " if m["pinned"] else ""
                md_lines.append(
                    f"- **`{m['memory_id']}`** ({m['category']}) {pin_badge}**{m['key']}**: {m['value']} *(v{m['version']}, {m['source_device']})*"
                )
            (config.MEMORY_DIR / "NEVER_FORGET.md").write_text("\n".join(md_lines) + "\n", encoding="utf-8")
        except Exception:
            pass

    def list_memories(
        self,
        category: str | None = None,
        query: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        sql = "SELECT * FROM never_forget_memories"
        params: list[Any] = []
        clauses: list[str] = []
        if category and category.lower() != "all":
            clauses.append("LOWER(category) = ?")
            params.append(category.lower().strip())
        if query and query.strip():
            q_like = f"%{query.strip().lower()}%"
            clauses.append("(LOWER(key) LIKE ? OR LOWER(value) LIKE ? OR LOWER(tags_json) LIKE ? OR LOWER(memory_id) LIKE ?)")
            params.extend([q_like, q_like, q_like, q_like])
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY pinned DESC, updated_at DESC LIMIT ?"
        params.append(max(1, min(limit, 500)))

        rows = self._conn.execute(sql, params).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def get_memory(self, memory_id: str) -> dict[str, Any] | None:
        row = self._conn.execute(
            "SELECT * FROM never_forget_memories WHERE LOWER(memory_id) = ?",
            (memory_id.strip().lower(),),
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def add_memory(
        self,
        value: str,
        key: str | None = None,
        category: str = "fact",
        tags: list[str] | None = None,
        source_device: str = "windows-pc-exe",
        pinned: bool = False,
        memory_id: str | None = None,
    ) -> dict[str, Any]:
        clean_val = value.strip()
        if not clean_val:
            raise ValueError("Memory value cannot be empty.")

        clean_key = (key or clean_val[:48]).strip()
        now = time.time()
        if not memory_id:
            # Generate sequential or deterministic short ID
            cnt_row = self._conn.execute("SELECT COUNT(*) AS cnt FROM never_forget_memories").fetchone()
            next_num = (cnt_row["cnt"] if cnt_row else 0) + 1
            short_hash = hashlib.sha1(f"{clean_key}:{clean_val}:{now}".encode("utf-8")).hexdigest()[:4]
            memory_id = f"mem-{next_num:03d}-{short_hash}"

        inferred_tags = tags or []
        if not inferred_tags:
            for kw in ("anime", "security+", "sy0-701", "finance", "crypto", "stock", "coding", "voice", "elevenlabs", "zfold7", "pc"):
                if kw in clean_val.lower() or kw in clean_key.lower():
                    inferred_tags.append(kw)

        self._conn.execute(
            """
            INSERT INTO never_forget_memories
            (memory_id, category, key, value, tags_json, source_device, pinned, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(memory_id) DO UPDATE SET
                category = excluded.category,
                key = excluded.key,
                value = excluded.value,
                tags_json = excluded.tags_json,
                source_device = excluded.source_device,
                pinned = excluded.pinned,
                version = never_forget_memories.version + 1,
                updated_at = excluded.updated_at
            """,
            (
                memory_id,
                category.lower().strip(),
                clean_key,
                clean_val,
                json.dumps(inferred_tags),
                source_device,
                1 if pinned else 0,
                now,
                now,
            ),
        )
        self._conn.commit()
        self._export_sync_snapshot()
        return self.get_memory(memory_id) or {}

    def edit_memory(
        self,
        memory_id: str,
        new_value: str,
        new_key: str | None = None,
        new_category: str | None = None,
        pinned: bool | None = None,
        source_device: str = "windows-pc-exe",
    ) -> dict[str, Any] | None:
        existing = self.get_memory(memory_id)
        if not existing:
            return None
        now = time.time()
        updated_key = new_key.strip() if new_key else existing["key"]
        updated_cat = new_category.strip().lower() if new_category else existing["category"]
        updated_pin = (1 if pinned else 0) if pinned is not None else (1 if existing["pinned"] else 0)

        self._conn.execute(
            """
            UPDATE never_forget_memories
            SET value = ?, key = ?, category = ?, pinned = ?, source_device = ?,
                version = version + 1, updated_at = ?
            WHERE LOWER(memory_id) = ?
            """,
            (
                new_value.strip(),
                updated_key,
                updated_cat,
                updated_pin,
                source_device,
                now,
                existing["memory_id"].lower(),
            ),
        )
        self._conn.commit()
        self._export_sync_snapshot()
        return self.get_memory(existing["memory_id"])

    def delete_memory(self, memory_id: str) -> dict[str, Any]:
        existing = self.get_memory(memory_id)
        if not existing:
            return {"ok": False, "deleted": False, "error": f"Memory ID '{memory_id}' not found."}
        self._conn.execute(
            "DELETE FROM never_forget_memories WHERE LOWER(memory_id) = ?",
            (existing["memory_id"].lower(),),
        )
        self._conn.commit()
        self._export_sync_snapshot()
        return {"ok": True, "deleted": True, "memory_id": existing["memory_id"], "deleted_item": existing}

    def log_conversation_and_extract(
        self,
        session_id: str,
        role: str,
        content: str,
        source_device: str = "windows-pc-exe",
    ) -> dict[str, Any] | None:
        """Persists every conversation turn and automatically extracts explicit user preferences/facts."""
        now = time.time()
        extracted: dict[str, Any] | None = None
        if role == "user" and content:
            text = content.strip()
            patterns = [
                (r"(?:remember that|never forget that|never forget:|save to memory:|remember:)\s+(.+)", "fact"),
                (r"(?:my preference is|i prefer|always use)\s+(.+)", "preference"),
                (r"(?:my project is|i am working on|my anime project is)\s+(.+)", "project"),
            ]
            for pat, cat in patterns:
                m = re.search(pat, text, flags=re.IGNORECASE)
                if m:
                    fact_val = m.group(1).strip()
                    if len(fact_val) >= 4:
                        extracted = self.add_memory(
                            value=fact_val,
                            key=f"Auto-Captured ({cat.title()})",
                            category=cat,
                            source_device=source_device,
                        )
                    break

        self._conn.execute(
            """
            INSERT INTO conversation_journal (session_id, role, content, source_device, extracted_mem, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                role,
                content[:4000],
                source_device,
                extracted["memory_id"] if extracted else None,
                now,
            ),
        )
        self._conn.commit()
        return extracted

    def sync_devices(
        self,
        client_device: str,
        incoming_memories: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Bi-directional conflict-free merge between PC (.exe), Android (.apk), and GitHub Cloud."""
        merged_count = 0
        for item in incoming_memories or []:
            mid = item.get("memory_id")
            val = item.get("value")
            if not val:
                continue
            existing = self.get_memory(mid) if mid else None
            inc_updated = float(item.get("updated_at") or time.time())
            inc_version = int(item.get("version") or 1)
            if not existing:
                self.add_memory(
                    value=val,
                    key=item.get("key") or val[:48],
                    category=item.get("category") or "fact",
                    tags=item.get("tags") or [],
                    source_device=item.get("source_device") or client_device,
                    pinned=bool(item.get("pinned", False)),
                    memory_id=mid,
                )
                merged_count += 1
            elif inc_version > existing["version"] or inc_updated > existing["updated_at"]:
                self.edit_memory(
                    memory_id=existing["memory_id"],
                    new_value=val,
                    new_key=item.get("key"),
                    new_category=item.get("category"),
                    pinned=item.get("pinned"),
                    source_device=item.get("source_device") or client_device,
                )
                merged_count += 1

        all_items = self.list_memories(limit=500)
        return {
            "ok": True,
            "sync_status": "SYNCHRONIZED",
            "client_device": client_device,
            "merged_incoming": merged_count,
            "total_memories": len(all_items),
            "synced_at": _iso_utc(),
            "memories": all_items,
        }

    def execute_command(self, raw_command: str, source_device: str = "windows-pc-exe") -> dict[str, Any]:
        """Parses and executes natural language memory commands: view, remember/add, edit, delete."""
        cmd = raw_command.strip()
        lower = cmd.lower()

        # 1. DELETE / FORGET
        del_match = re.search(r"(?:delete|forget|remove)\s+memory\s+#?([a-zA-Z0-9\-]+)", cmd, re.IGNORECASE)
        if del_match:
            mid = del_match.group(1).strip()
            res = self.delete_memory(mid)
            if res.get("deleted"):
                return {
                    "ok": True,
                    "action": "DELETE",
                    "memory_id": mid,
                    "message": f"Deleted memory `{mid}` ({res['deleted_item']['key']}), Sir.",
                    "memories": self.list_memories(limit=25),
                }
            return {"ok": False, "action": "DELETE", "message": res.get("error", "Memory ID not found.")}

        # 2. EDIT / UPDATE
        edit_match = re.search(
            r"(?:edit|update)\s+memory\s+#?([a-zA-Z0-9\-]+)\s*(?::|to|=)\s*(.+)",
            cmd,
            re.IGNORECASE,
        )
        if edit_match:
            mid = edit_match.group(1).strip()
            new_val = edit_match.group(2).strip()
            updated = self.edit_memory(memory_id=mid, new_value=new_val, source_device=source_device)
            if updated:
                return {
                    "ok": True,
                    "action": "EDIT",
                    "memory": updated,
                    "message": f"Updated memory `{updated['memory_id']}` (v{updated['version']}): {updated['value']}",
                }
            return {"ok": False, "action": "EDIT", "message": f"Memory `{mid}` not found."}

        # 3. ADD / REMEMBER
        add_match = re.search(
            r"^(?:remember that|remember:|remember|never forget that|never forget:|save to memory:)\s+(.+)",
            cmd,
            re.IGNORECASE,
        )
        if add_match and not any(lower.startswith(w) for w in ("what do you remember", "show ", "view ", "list ")):
            fact = add_match.group(1).strip()
            cat = "preference" if "prefer" in fact.lower() else ("project" if "project" in fact.lower() else "fact")
            created = self.add_memory(value=fact, key=fact[:45], category=cat, source_device=source_device)
            return {
                "ok": True,
                "action": "ADD",
                "memory": created,
                "message": f"Committed to permanent Never-Forget memory as `{created['memory_id']}` ({created['category']}): \"{created['value']}\"",
            }

        # 4. VIEW / SEARCH
        items = self.list_memories(limit=50)
        return {
            "ok": True,
            "action": "VIEW",
            "count": len(items),
            "memories": items,
            "message": f"Retrieved {len(items)} persistent memories synchronized across PC and Samsung Galaxy Z Fold 7.",
        }

    def get_context_summary(self, max_items: int = 12) -> str:
        """Returns a compact Markdown block injected into LLM prompts so J.A.R.V.I.S. never forgets."""
        items = self.list_memories(limit=max_items)
        if not items:
            return ""
        lines = ["[J.A.R.V.I.S. NEVER-FORGET PERSISTENT MEMORY]"]
        for m in items:
            lines.append(f"- ({m['memory_id']} | {m['category']}) {m['key']}: {m['value']}")
        return "\n".join(lines)


_never_forget_instance: NeverForgetMemory | None = None


def get_never_forget() -> NeverForgetMemory:
    global _never_forget_instance
    if _never_forget_instance is None:
        _never_forget_instance = NeverForgetMemory()
    return _never_forget_instance
