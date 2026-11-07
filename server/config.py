"""Central configuration for J.A.R.V.I.S.

Everything that varies by machine, key, or taste lives here. No secrets are
stored in this file -- they are read from the environment or from a .env file
sitting next to it.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# --- Filesystem layout ----------------------------------------------------
DATA_DIR = ROOT / "data"
MEMORY_DIR = DATA_DIR / "memories"          # the memory tool's sandbox root
RESEARCH_DIR = DATA_DIR / "research"        # cached deep-research dossiers
LOG_DIR = ROOT / "logs"
DB_PATH = DATA_DIR / "jarvis.db"
WEB_DIR = ROOT / "web"

for _d in (DATA_DIR, MEMORY_DIR, RESEARCH_DIR, LOG_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# --- Identity -------------------------------------------------------------
# The single operator this instance serves. Used in the system prompt and to
# scope memory. Change it here, not in a dozen prompt strings.
PRINCIPAL = os.environ.get("JARVIS_PRINCIPAL", "Jonathan")
ADDRESS_AS = os.environ.get("JARVIS_ADDRESS_AS", "Sir")

# --- Model backend --------------------------------------------------------
# "anthropic" is the only backend that streams real reasoning deltas, which is
# what the cognition pane renders. "ollama" is the local/offline lane.
BACKEND = os.environ.get("JARVIS_BACKEND", "anthropic").lower()

ANTHROPIC_MODEL = os.environ.get("JARVIS_MODEL", "claude-opus-5")
# Opus 5 supports the full ladder: low | medium | high | xhigh | max.
DEFAULT_EFFORT = os.environ.get("JARVIS_EFFORT", "high")
MAX_TOKENS = int(os.environ.get("JARVIS_MAX_TOKENS", "64000"))

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("JARVIS_OLLAMA_MODEL", "qwen3:32b")

# --- Agent loop limits ----------------------------------------------------
MAX_TOOL_ITERATIONS = int(os.environ.get("JARVIS_MAX_ITERATIONS", "40"))
MAX_PAUSE_RESUMES = 5

# --- Deep research --------------------------------------------------------
# "search six times to confirm it doesn't exist" -- implemented as a bounded
# multi-pass sweep with an early exit once two consecutive passes find nothing
# new. Six is the ceiling, not a quota to burn.
RESEARCH_MAX_PASSES = int(os.environ.get("JARVIS_RESEARCH_PASSES", "6"))
RESEARCH_DRY_PASSES_TO_STOP = 2

# --- Safety gates ---------------------------------------------------------
# When False, every shell command and file write waits for a click in the HUD.
# The toggle is in the UI; this is only the boot default.
AUTONOMOUS_DEFAULT = os.environ.get("JARVIS_AUTONOMOUS", "0") == "1"

# Shell commands are confined to these roots unless autonomous mode is on.
# System32 is deliberately absent.
WORKSPACE_ROOTS = [
    Path(p) for p in os.environ.get(
        "JARVIS_WORKSPACE_ROOTS",
        r"D:\;C:\Users\plata\dev;C:\Users\plata\Documents;C:\Users\plata\Desktop",
    ).split(";") if p.strip()
]

# --- Server ---------------------------------------------------------------
HOST = os.environ.get("JARVIS_HOST", "127.0.0.1")
PORT = int(os.environ.get("JARVIS_PORT", "8777"))


def api_key_present() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
