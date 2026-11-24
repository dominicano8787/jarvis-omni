"""Local client-side tools: shell, filesystem, and reverse-engineering triage.

Design notes:

* Every tool declares `danger`. Anything that mutates state or executes code is
  gated behind an approval round-trip to the HUD unless autonomous mode is on.
  The gate is the operator's, not the model's -- the model cannot clear it.
* Paths from the model are untrusted. `_confine` resolves them and checks them
  against the configured workspace roots before anything touches the disk.
* Binary triage is pure Python on purpose: entropy, headers, and strings answer
  most questions far more cheaply than spinning up a decompiler.
"""

from __future__ import annotations

import asyncio
import datetime
import hashlib
import json
import math
import re
import shutil
import struct
from collections import Counter
from pathlib import Path
from typing import Any, Awaitable, Callable

from . import config

MAX_READ_BYTES = 400_000
SHELL_TIMEOUT = 180
GHIDRA_TIMEOUT = 1800
REA_TIMEOUT = 1800
REA_PREVIEW_CHARS = 30_000
REA_COMMAND_RE = re.compile(r"^[a-z][a-z0-9-]{1,63}$")


class ToolDenied(Exception):
    """The operator declined the call. Reported to the model, not an error."""


def _confine(raw: str, *, must_exist: bool = False) -> Path:
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("path is required")
    p = Path(raw.strip()).expanduser()
    try:
        resolved = p.resolve()
    except OSError as exc:
        raise ValueError(f"cannot resolve path: {exc}") from exc
    if not any(
        resolved == root.resolve() or root.resolve() in resolved.parents
        for root in config.WORKSPACE_ROOTS
    ):
        allowed = ", ".join(str(r) for r in config.WORKSPACE_ROOTS)
        raise ValueError(f"path outside the permitted workspace roots ({allowed}): {resolved}")
    if must_exist and not resolved.exists():
        raise ValueError(f"no such path: {resolved}")
    return resolved


def _shannon(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    n = len(data)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _extract_strings(data: bytes, min_len: int = 5, limit: int = 120) -> list[str]:
    out: list[str] = []
    for m in re.finditer(rb"[\x20-\x7e]{%d,}" % min_len, data):
        out.append(m.group().decode("ascii", "replace"))
        if len(out) >= limit:
            break
    return out


def _pe_summary(data: bytes) -> dict[str, Any] | None:
    """Minimal PE header walk. Enough for triage; not a parser library."""
    if len(data) < 0x40 or data[:2] != b"MZ":
        return None
    try:
        pe_off = struct.unpack_from("<I", data, 0x3C)[0]
        if data[pe_off:pe_off + 4] != b"PE\0\0":
            return None
        machine, n_sections, timestamp = struct.unpack_from("<HHI", data, pe_off + 4)
        opt_size = struct.unpack_from("<H", data, pe_off + 20)[0]
        magic = struct.unpack_from("<H", data, pe_off + 24)[0]
        sect_off = pe_off + 24 + opt_size
        sections = []
        for i in range(min(n_sections, 32)):
            base = sect_off + i * 40
            if base + 40 > len(data):
                break
            name = data[base:base + 8].rstrip(b"\0").decode("ascii", "replace")
            vsize, vaddr, rawsize, rawptr = struct.unpack_from("<IIII", data, base + 8)
            body = data[rawptr:rawptr + rawsize] if rawsize else b""
            sections.append({
                "name": name, "vsize": vsize, "vaddr": hex(vaddr),
                "rawsize": rawsize, "entropy": round(_shannon(body), 3),
            })
        return {
            "format": "PE32+" if magic == 0x20B else "PE32",
            "machine": {0x014C: "i386", 0x8664: "x86-64", 0xAA64: "ARM64",
                        0x01C0: "ARM", 0x01C4: "ARMv7"}.get(machine, hex(machine)),
            "timestamp": timestamp,
            "sections": sections,
        }
    except (struct.error, IndexError):
        return None


def _elf_summary(data: bytes) -> dict[str, Any] | None:
    if len(data) < 20 or data[:4] != b"\x7fELF":
        return None
    bits = {1: 32, 2: 64}.get(data[4], 0)
    endian = {1: "little", 2: "big"}.get(data[5], "?")
    fmt = "<H" if endian == "little" else ">H"
    e_type = struct.unpack_from(fmt, data, 16)[0]
    e_machine = struct.unpack_from(fmt, data, 18)[0]
    return {
        "format": f"ELF{bits}",
        "endian": endian,
        "type": {1: "REL", 2: "EXEC", 3: "DYN", 4: "CORE"}.get(e_type, hex(e_type)),
        "machine": {0x03: "i386", 0x3E: "x86-64", 0x28: "ARM",
                    0xB7: "AArch64", 0xF3: "RISC-V"}.get(e_machine, hex(e_machine)),
    }


# ==========================================================================
# Tool definitions sent to the model
# ==========================================================================

DEFINITIONS: list[dict] = [
    {
        "name": "run_shell",
        "description": (
            "Execute a PowerShell command on the operator's Windows machine and "
            "return stdout, stderr, and the exit code. Use this for builds, "
            "tests, git, inspecting the running system, and driving local "
            "tooling such as Ghidra's headless analyzer. Commands run inside "
            "the configured workspace roots. Long output is truncated; redirect "
            "to a file and read it back if you need the whole thing."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "PowerShell command to run."},
                "cwd": {"type": "string", "description": "Working directory. Must sit inside a workspace root."},
                "why": {"type": "string", "description": "One line the operator will see on the approval card."},
            },
            "required": ["command", "why"],
        },
        "danger": "high",
    },
    {
        "name": "read_file",
        "description": (
            "Read a UTF-8 text file from disk. Supply offset and limit for large "
            "files. For binaries use inspect_binary instead."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "offset": {"type": "integer", "description": "First line to return, 1-indexed."},
                "limit": {"type": "integer", "description": "Maximum lines to return."},
            },
            "required": ["path"],
        },
        "danger": "none",
    },
    {
        "name": "write_file",
        "description": (
            "Create or overwrite a text file. The previous contents are backed "
            "up alongside it as <name>.bak. Prefer this over shell redirection "
            "so the operator sees exactly what is being written."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
                "why": {"type": "string", "description": "One line the operator will see on the approval card."},
            },
            "required": ["path", "content", "why"],
        },
        "danger": "medium",
    },
    {
        "name": "list_dir",
        "description": "List a directory. Set recursive for a bounded tree walk.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "recursive": {"type": "boolean"},
                "pattern": {"type": "string", "description": "Optional glob, e.g. **/*.py"},
            },
            "required": ["path"],
        },
        "danger": "none",
    },
    {
        "name": "inspect_binary",
        "description": (
            "Reverse-engineering triage on a file: size, MD5/SHA-256, overall and "
            "per-section Shannon entropy, PE or ELF header summary, and a sample "
            "of printable strings. Run this before any decompiler -- high "
            "section entropy indicates packing or encryption, and the import "
            "and string picture usually identifies the binary's purpose on its "
            "own."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "min_string_len": {"type": "integer"},
                "max_strings": {"type": "integer"},
            },
            "required": ["path"],
        },
        "danger": "none",
    },
    {
        "name": "ghidra_headless",
        "description": (
            "Run Ghidra's headless analyzer over a binary and return its log. "
            "Slow (minutes). Use only after inspect_binary indicates a full "
            "decompile is warranted. Optionally runs a post-analysis script."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "binary": {"type": "string"},
                "project_name": {"type": "string"},
                "post_script": {"type": "string", "description": "Optional Ghidra script name to run after analysis."},
                "why": {"type": "string"},
            },
            "required": ["binary", "why"],
        },
        "danger": "medium",
    },
    {
        "name": "rea_cli",
        "description": (
            "Run a REA (Reverse Engineer Anything) CLI command, e.g. "
            "analyze-javascript-application, inspect-artifact, "
            "audit-release-exposure, inspect-pe-imports, inspect-elf-notes, "
            "inspect-analysis-view. Follow the reverse-engineer-anything skill "
            "for which command fits the target. Uses an installed `rea` if one "
            "is on PATH, otherwise `npx -y rea-agents@latest`. The full stdout "
            "is saved to a file under data/rea/results and only a preview is "
            "returned; read the saved file, or pass it to inspect-analysis-view, "
            "for the rest. Run `rea <command> --help` (command 'help' is not a "
            "command; pass extra_args ['--help']) when unsure of a command's flags."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "REA subcommand in kebab-case, e.g. analyze-javascript-application.",
                },
                "target": {
                    "type": "string",
                    "description": "Optional absolute path to the file or folder to analyze. Passed first after the command.",
                },
                "extra_args": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Further CLI arguments, e.g. ['--provider', 'ghidra'] or ['--help'].",
                },
                "json_output": {
                    "type": "boolean",
                    "description": "Append --json (default true).",
                },
                "stdin_json": {
                    "type": "object",
                    "description": "Optional JSON request sent on stdin; '-' is appended to the arguments.",
                },
                "why": {"type": "string"},
            },
            "required": ["command", "why"],
        },
        "danger": "medium",
    },
]

BY_NAME = {d["name"]: d for d in DEFINITIONS}


def schemas_for_api() -> list[dict]:
    """Strip the local-only `danger` key before sending to the API."""
    return [{k: v for k, v in d.items() if k != "danger"} for d in DEFINITIONS]


# ==========================================================================
# Executor
# ==========================================================================

ApprovalFn = Callable[[str, dict, str], Awaitable[bool]]


class Executor:
    def __init__(self, approve: ApprovalFn, autonomous: bool = False):
        self._approve = approve
        self.autonomous = autonomous

    async def _gate(self, name: str, payload: dict) -> None:
        danger = BY_NAME.get(name, {}).get("danger", "none")
        if danger == "none" or self.autonomous:
            return
        why = payload.get("why") or "No rationale supplied."
        if not await self._approve(name, payload, why):
            raise ToolDenied(f"{name} was declined by the operator")

    async def run(self, name: str, payload: dict) -> tuple[str, bool]:
        """Execute one tool call. Returns (result_text, is_error)."""
        try:
            await self._gate(name, payload)
            handler = getattr(self, f"_t_{name}", None)
            if handler is None:
                return f"Error: unknown tool {name!r}", True
            return await handler(payload), False
        except ToolDenied as exc:
            return (
                f"Declined: {exc}. Do not retry this call. Either propose a "
                f"different approach or ask the operator what they would prefer."
            ), True
        except (ValueError, OSError) as exc:
            return f"Error: {exc.__class__.__name__}: {exc}", True

    # -- implementations ---------------------------------------------------
    async def _t_run_shell(self, p: dict) -> str:
        command = p["command"]
        cwd = _confine(p["cwd"], must_exist=True) if p.get("cwd") else config.ROOT
        proc = await asyncio.create_subprocess_exec(
            "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command,
            cwd=str(cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.DEVNULL,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(), timeout=SHELL_TIMEOUT)
        except asyncio.TimeoutError:
            proc.kill()
            return f"Error: command exceeded {SHELL_TIMEOUT}s and was killed."
        return self._format_proc(proc.returncode, out, err)

    @staticmethod
    def _format_proc(code: int | None, out: bytes, err: bytes, cap: int = 30_000) -> str:
        def dec(b: bytes) -> str:
            s = b.decode("utf-8", "replace").rstrip()
            return s if len(s) <= cap else s[:cap] + f"\n…(truncated, {len(s)} chars total)"
        parts = [f"exit code: {code}"]
        if out.strip():
            parts.append("stdout:\n" + dec(out))
        if err.strip():
            parts.append("stderr:\n" + dec(err))
        if len(parts) == 1:
            parts.append("(no output)")
        return "\n\n".join(parts)

    async def _t_read_file(self, p: dict) -> str:
        target = _confine(p["path"], must_exist=True)
        if target.is_dir():
            raise ValueError("path is a directory; use list_dir")
        if target.stat().st_size > MAX_READ_BYTES:
            raise ValueError(
                f"file is {target.stat().st_size} bytes (limit {MAX_READ_BYTES}); "
                "use offset/limit or inspect_binary"
            )
        lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
        start = max(1, int(p.get("offset", 1)))
        limit = int(p.get("limit", 2000))
        window = lines[start - 1:start - 1 + limit]
        body = "\n".join(f"{i + start:>5}\t{ln}" for i, ln in enumerate(window))
        suffix = "" if start - 1 + limit >= len(lines) else f"\n…({len(lines)} lines total)"
        return body + suffix

    async def _t_write_file(self, p: dict) -> str:
        target = _confine(p["path"])
        content = p.get("content", "")
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target.with_suffix(target.suffix + ".bak").write_bytes(target.read_bytes())
        target.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} chars to {target}"

    async def _t_list_dir(self, p: dict) -> str:
        target = _confine(p["path"], must_exist=True)
        pattern = p.get("pattern") or ("**/*" if p.get("recursive") else "*")
        entries = sorted(target.glob(pattern))[:800]
        if not entries:
            return f"{target}: no matches for {pattern!r}"
        lines = [f"{target}  ({len(entries)} entries, pattern {pattern!r})"]
        for e in entries:
            rel = e.relative_to(target).as_posix()
            lines.append(f"  {rel}/" if e.is_dir() else f"  {rel}  {e.stat().st_size} B")
        return "\n".join(lines)

    async def _t_inspect_binary(self, p: dict) -> str:
        target = _confine(p["path"], must_exist=True)
        data = target.read_bytes()
        report: list[str] = [
            f"file:    {target}",
            f"size:    {len(data):,} bytes",
            f"md5:     {hashlib.md5(data).hexdigest()}",
            f"sha256:  {hashlib.sha256(data).hexdigest()}",
            f"entropy: {_shannon(data):.3f} / 8.0",
        ]
        if _shannon(data) > 7.2:
            report.append(
                "note:    whole-file entropy above 7.2 — packed, compressed, or encrypted."
            )
        header = _pe_summary(data) or _elf_summary(data)
        if header:
            report.append("")
            report.append(f"format:  {header['format']}  machine: {header.get('machine')}")
            for s in header.get("sections", []):
                flag = "  <-- high entropy" if s["entropy"] > 7.0 else ""
                report.append(
                    f"  section {s['name']:<10} vaddr {s['vaddr']:<12} "
                    f"raw {s['rawsize']:>9,}  H={s['entropy']:.3f}{flag}"
                )
        else:
            report.append("format:  not PE or ELF (check magic bytes: " +
                          data[:8].hex(" ") + ")")
        strings = _extract_strings(
            data,
            int(p.get("min_string_len", 5)),
            int(p.get("max_strings", 120)),
        )
        report.append("")
        report.append(f"strings ({len(strings)} shown):")
        report.extend(f"  {s}" for s in strings)
        return "\n".join(report)

    async def _t_ghidra_headless(self, p: dict) -> str:
        binary = _confine(p["binary"], must_exist=True)
        headless = Path(r"D:\ghidra\ghidra_12.1.4_PUBLIC\support\analyzeHeadless.bat")
        if not headless.exists():
            return f"Error: Ghidra headless analyzer not found at {headless}"
        projects = config.DATA_DIR / "ghidra_projects"
        projects.mkdir(parents=True, exist_ok=True)
        name = p.get("project_name") or binary.stem
        args = [str(headless), str(projects), name, "-import", str(binary), "-overwrite"]
        if p.get("post_script"):
            args += ["-postScript", p["post_script"]]
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.DEVNULL,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(), timeout=GHIDRA_TIMEOUT)
        except asyncio.TimeoutError:
            proc.kill()
            return f"Error: Ghidra exceeded {GHIDRA_TIMEOUT}s and was killed."
        return self._format_proc(proc.returncode, out, err, cap=40_000)

    async def _t_rea_cli(self, p: dict) -> str:
        command = str(p.get("command", "")).strip()
        if not REA_COMMAND_RE.match(command):
            raise ValueError(f"not a REA command name: {command!r}")
        rea = shutil.which("rea")
        npx = shutil.which("npx")
        if rea:
            base = [rea]
        elif npx:
            base = [npx, "-y", "rea-agents@latest"]
        else:
            return "Error: neither `rea` nor `npx` is on PATH. Install Node.js, or run `npm install --global rea-agents`."
        args = [command]
        if p.get("target"):
            args.append(str(_confine(p["target"], must_exist=True)))
        extra = p.get("extra_args") or []
        if not isinstance(extra, list) or not all(isinstance(a, str) for a in extra):
            raise ValueError("extra_args must be a list of strings")
        args.extend(extra)
        if p.get("json_output", True) and "--json" not in args and "--help" not in args:
            args.append("--json")
        stdin_bytes = None
        if p.get("stdin_json") is not None:
            stdin_bytes = json.dumps(p["stdin_json"]).encode("utf-8")
            args.append("-")
        # REA asks to be run from a trusted directory outside the target.
        workdir = config.DATA_DIR / "rea"
        results = workdir / "results"
        results.mkdir(parents=True, exist_ok=True)
        proc = await asyncio.create_subprocess_exec(
            *base, *args,
            cwd=str(workdir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE if stdin_bytes is not None else asyncio.subprocess.DEVNULL,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(stdin_bytes), timeout=REA_TIMEOUT)
        except asyncio.TimeoutError:
            proc.kill()
            return f"Error: REA exceeded {REA_TIMEOUT}s and was killed."
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        saved = results / f"{stamp}-{command}.json"
        saved.write_bytes(out)
        text = out.decode("utf-8", "replace")
        preview = text[:REA_PREVIEW_CHARS]
        report = [
            f"exit code: {proc.returncode}",
            f"command: {' '.join(['rea', *args])}",
            f"full stdout ({len(out)} bytes) saved to: {saved}",
        ]
        if len(text) > REA_PREVIEW_CHARS:
            report.append(f"preview below is the first {REA_PREVIEW_CHARS} characters; it is incomplete, do not parse it as JSON")
        report += ["", "stdout:", preview]
        if err:
            report += ["", "stderr:", err.decode("utf-8", "replace")[-8_000:]]
        return "\n".join(report)
