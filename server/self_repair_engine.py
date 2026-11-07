r"""PHASE 3.7: J.A.R.V.I.S. Autonomous Self-Repair & Auto-Rollback Engine.

Capabilities:
1. Structured Error Logger (`D:\Jarvis\logs\self_repair.jsonl`)
2. Root-Cause Diagnostic Analyzer (inspects Python tracebacks, syntax errors, missing imports, or config drift)
3. Transactional Patch & Verification Pipeline:
   - Saves a cryptographic `.bak` snapshot before touching any file
   - Applies the candidate fix
   - Runs AST syntax + functional verification tests
   - AUTOMATICALLY ROLLS BACK to the `.bak` snapshot if any verification test fails!
"""

from __future__ import annotations

import ast
import hashlib
import json
import py_compile
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

ROOT_DIR = Path(__file__).resolve().parent.parent
LOGS_DIR = ROOT_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
REPAIR_LOG_FILE = LOGS_DIR / "self_repair.jsonl"
SNAPSHOT_DIR = ROOT_DIR / "data" / "self_repair_snapshots"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class SelfRepairEngine:
    """Logs errors, diagnoses root causes, applies verified fixes, and rolls back automatically on test failure."""

    def log_error(
        self,
        subsystem: str,
        error_message: str,
        file_path: str | None = None,
        traceback_text: str | None = None,
    ) -> dict[str, Any]:
        diagnosis = self.diagnose_error(error_message, traceback_text=traceback_text)
        entry = {
            "incident_id": f"inc-{uuid.uuid4().hex[:8]}",
            "timestamp": _utc_iso(),
            "subsystem": subsystem,
            "file_path": file_path,
            "error_message": error_message,
            "diagnosis": diagnosis,
            "status": "LOGGED",
        }
        with REPAIR_LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        return entry

    def diagnose_error(self, error_message: str, traceback_text: str | None = None) -> dict[str, str]:
        combined = f"{error_message}\n{traceback_text or ''}"
        lower = combined.lower()
        if "syntaxerror" in lower or "indentationerror" in lower:
            return {
                "category": "SYNTAX_OR_INDENTATION_ERROR",
                "root_cause": "Invalid Python syntax or indentation block detected by AST parser.",
                "suggested_fix": "Parse AST, repair malformed line/brackets, and re-verify via py_compile.",
            }
        if "modulenotfounderror" in lower or "importerror" in lower:
            return {
                "category": "MISSING_DEPENDENCY_OR_IMPORT",
                "root_cause": "Module import target is missing or guarded import fallback is required.",
                "suggested_fix": "Wrap optional dependency in try/except import guard or install into .venv.",
            }
        if "sqlite3" in lower or "database is locked" in lower:
            return {
                "category": "SQLITE_CONCURRENCY_OR_SCHEMA",
                "root_cause": "SQLite connection contention or missing table initialization.",
                "suggested_fix": "Ensure check_same_thread=False, WAL journal mode, and CREATE TABLE IF NOT EXISTS.",
            }
        return {
            "category": "RUNTIME_ASSERTION_OR_LOGIC_ERROR",
            "root_cause": f"Runtime exception encountered: {error_message[:140]}",
            "suggested_fix": "Create .bak snapshot, apply targeted patch, run verification test, and auto-rollback if test fails.",
        }

    def apply_patch_with_auto_rollback(
        self,
        target_file: str | Path,
        patched_content: str,
        test_callable: Callable[[Path], bool] | None = None,
    ) -> dict[str, Any]:
        """Applies a fix with transactional safety: rolls back immediately if syntax or functional tests fail."""
        t0 = time.perf_counter()
        target_path = Path(target_file).resolve()
        if not target_path.is_file():
            raise FileNotFoundError(f"Target file does not exist: {target_path}")

        original_bytes = target_path.read_bytes()
        original_sha = hashlib.sha256(original_bytes).hexdigest()
        bak_path = SNAPSHOT_DIR / f"{target_path.name}.{uuid.uuid4().hex[:6]}.bak"
        shutil.copy2(target_path, bak_path)

        rolled_back = False
        failure_reason = None

        try:
            # 1. Write candidate patch
            target_path.write_text(patched_content, encoding="utf-8")

            # 2. Verify Python AST & bytecode compilation if .py file
            if target_path.suffix.lower() == ".py":
                ast.parse(patched_content, filename=str(target_path))
                py_compile.compile(str(target_path), doraise=True)

            # 3. Run functional test callable if provided
            if test_callable is not None:
                passed = bool(test_callable(target_path))
                if not passed:
                    raise RuntimeError("Post-patch functional verification test returned False.")

        except Exception as exc:
            # AUTOMATIC ROLLBACK FROM .bak SNAPSHOT
            failure_reason = str(exc)
            shutil.copy2(bak_path, target_path)
            rolled_back = True

        final_sha = _sha256_file(target_path)
        event = {
            "ok": not rolled_back,
            "repair_id": f"rep-{uuid.uuid4().hex[:8]}",
            "target_file": str(target_path),
            "backup_snapshot": str(bak_path),
            "original_sha256": original_sha,
            "final_sha256": final_sha,
            "rolled_back": rolled_back,
            "integrity_restored_on_rollback": (final_sha == original_sha) if rolled_back else True,
            "failure_reason": failure_reason,
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "timestamp": _utc_iso(),
        }
        with REPAIR_LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")
        return event

    def run_self_repair_simulation(self) -> dict[str, Any]:
        """Demonstrates both (1) a successful auto-repair and (2) an automatic rollback when a bad patch fails tests."""
        sandbox_file = SNAPSHOT_DIR / "self_repair_target_module.py"
        clean_v1 = (
            "def compute_arc_reactor_output(megawatts: float) -> float:\n"
            "    return round(megawatts * 3.0, 2)\n"
        )
        sandbox_file.write_text(clean_v1, encoding="utf-8")

        # Case A: Bad patch with broken syntax/test -> MUST auto-rollback to clean_v1
        bad_patch = "def compute_arc_reactor_output(megawatts: float) -> float:\n    return megawatts / 0  # broken\n"

        def _test_fn(p: Path) -> bool:
            ns: dict[str, Any] = {}
            exec(p.read_text(encoding="utf-8"), ns)
            return ns["compute_arc_reactor_output"](10.0) >= 30.0

        rollback_result = self.apply_patch_with_auto_rollback(
            target_file=sandbox_file,
            patched_content=bad_patch,
            test_callable=_test_fn,
        )

        # Case B: Valid upgraded patch -> Passes test and commits cleanly
        good_patch = (
            "def compute_arc_reactor_output(megawatts: float) -> float:\n"
            "    return round(megawatts * 3.5, 2)\n"
        )
        success_result = self.apply_patch_with_auto_rollback(
            target_file=sandbox_file,
            patched_content=good_patch,
            test_callable=_test_fn,
        )

        return {
            "ok": True,
            "rollback_drill": rollback_result,
            "repair_commit_drill": success_result,
        }

    def get_status(self, limit: int = 20) -> dict[str, Any]:
        events = []
        if REPAIR_LOG_FILE.is_file():
            for line in REPAIR_LOG_FILE.read_text(encoding="utf-8", errors="ignore").splitlines()[-limit:]:
                if line.strip():
                    try:
                        events.append(json.loads(line))
                    except Exception:
                        pass
        events.reverse()
        return {
            "ok": True,
            "log_file": str(REPAIR_LOG_FILE),
            "snapshots_dir": str(SNAPSHOT_DIR),
            "events_count": len(events),
            "recent_events": events,
        }


_self_repair_engine: SelfRepairEngine | None = None


def get_self_repair_engine() -> SelfRepairEngine:
    global _self_repair_engine
    if _self_repair_engine is None:
        _self_repair_engine = SelfRepairEngine()
    return _self_repair_engine
