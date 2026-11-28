"""Brain and voice switchboard -- "Jarvis, switch to your local brain."

Holds which brain answers (the cloud Anthropic model, a local Ollama model, or
the local "uncensored" model) and which voice speaks (Edge neural, ElevenLabs,
or a local voice), persists the choice across restarts, and recognises the
spoken commands that change it. The commands are handled before any model
call, so switching is instant and works even when the current brain is down.

"Uncensored" here means a local open-weights model the operator chooses
(`JARVIS_UNCENSORED_MODEL`), typically an abliterated GGUF loaded into Ollama.
It answers without a cloud provider's moderation layer. It does NOT bypass
Jarvis's own approval gate: shell, file writes and computer control still need
a click unless autonomous mode is on, because a model without refusals will
also follow instructions injected by the web pages and files it reads.
"""

from __future__ import annotations

import json
import os
import re
import threading
from dataclasses import asdict, dataclass

import httpx

from . import config

STATE_PATH = config.DATA_DIR / "switchboard.json"

BRAINS = ("cloud", "local", "uncensored")
VOICES = ("edge", "elevenlabs", "local")

UNCENSORED_MODEL = os.environ.get("JARVIS_UNCENSORED_MODEL", "").strip()


@dataclass
class State:
    brain: str = "cloud" if config.BACKEND != "ollama" else "local"
    local_model: str = config.OLLAMA_MODEL
    voice: str = os.environ.get("JARVIS_VOICE", "edge").lower()

    def active_model(self) -> str:
        if self.brain == "cloud":
            return config.ANTHROPIC_MODEL
        if self.brain == "uncensored":
            return UNCENSORED_MODEL or self.local_model
        return self.local_model

    def describe(self) -> dict:
        return {**asdict(self), "active_model": self.active_model(),
                "uncensored_model": UNCENSORED_MODEL or None}


_lock = threading.Lock()
_state: State | None = None


def state() -> State:
    global _state
    with _lock:
        if _state is None:
            _state = State()
            try:
                saved = json.loads(STATE_PATH.read_text(encoding="utf-8"))
                if saved.get("brain") in BRAINS:
                    _state.brain = saved["brain"]
                if isinstance(saved.get("local_model"), str) and saved["local_model"]:
                    _state.local_model = saved["local_model"]
                if saved.get("voice") in VOICES:
                    _state.voice = saved["voice"]
            except (OSError, ValueError):
                pass
        return _state


def _save() -> None:
    s = state()
    STATE_PATH.write_text(json.dumps(asdict(s), indent=2), encoding="utf-8")


def set_brain(brain: str, model: str | None = None) -> State:
    if brain not in BRAINS:
        raise ValueError(f"unknown brain {brain!r}; choose one of {BRAINS}")
    s = state()
    with _lock:
        s.brain = brain
        if model and brain == "local":
            s.local_model = model
    _save()
    return s


def set_voice(voice: str) -> State:
    if voice not in VOICES:
        raise ValueError(f"unknown voice {voice!r}; choose one of {VOICES}")
    s = state()
    with _lock:
        s.voice = voice
    _save()
    return s


# --------------------------------------------------------------------------
# Ollama inventory
# --------------------------------------------------------------------------

async def installed_models(host: str | None = None) -> list[str] | None:
    """Model tags Ollama has pulled, or None if Ollama is not reachable."""
    base = (host or config.OLLAMA_HOST).rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{base}/api/tags")
            r.raise_for_status()
            return [m.get("name", "") for m in r.json().get("models", [])]
    except (httpx.HTTPError, ValueError):
        return None


def _squash(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def match_model(spoken: str, installed: list[str]) -> str | None:
    """Map "gemma 4 12b" or "qwen three point five" onto an installed tag."""
    words = spoken.lower().replace(" point ", ".").replace(" dot ", ".")
    for num, digit in (("three", "3"), ("four", "4"), ("five", "5"), ("two", "2"), ("one", "1")):
        words = re.sub(rf"\b{num}\b", digit, words)
    want = _squash(words)
    if not want:
        return None
    # Exact tag, then tag without ":latest", then prefix/containment.
    for tag in installed:
        if _squash(tag) == want or _squash(tag.removesuffix(":latest")) == want:
            return tag
    hits = [t for t in installed if want in _squash(t) or _squash(t.split(":")[0]) == want]
    return min(hits, key=len) if hits else None


# --------------------------------------------------------------------------
# Spoken commands
# --------------------------------------------------------------------------

_LEAD = r"^\s*(?:hey\s+|ok(?:ay)?\s+)?(?:jarvis[\s,]+)?(?:please\s+)?(?:can\s+you\s+)?"

_BRAIN_RE = re.compile(
    _LEAD + r"(?:switch|change|go|swap|flip|turn)\s+(?:back\s+)?(?:over\s+)?(?:to|into|on)\s+"
    r"(?:your\s+|the\s+|my\s+)?(?P<target>.+?)[\s.!?]*$",
    re.I,
)
_STATUS_RE = re.compile(
    _LEAD + r"(?:which|what)\s+(?:brain|model|voice)\s+(?:are\s+you|is)\s+(?:using|on|running|active)",
    re.I,
)


@dataclass
class Command:
    kind: str            # "brain" | "voice" | "status"
    target: str = ""     # brain/voice name
    model: str = ""      # spoken model name for a local brain


def parse(text: str) -> Command | None:
    """Recognise a switch command. Returns None for ordinary prompts."""
    if len(text) > 120:
        return None
    if _STATUS_RE.search(text):
        return Command("status")
    m = _BRAIN_RE.match(text)
    if not m:
        return None
    target = m.group("target").lower().strip()
    target = re.sub(r"\s+(?:mode|please|now|again)$", "", target).strip()

    if re.search(r"\bvoice\b", target):
        if re.search(r"eleven\s*labs|premium|cloud|online", target):
            return Command("voice", "elevenlabs")
        if re.search(r"local|offline|clone", target):
            return Command("voice", "local")
        if re.search(r"edge|default|neural|normal|standard", target):
            return Command("voice", "edge")
        return None

    if re.search(r"uncensored|unfiltered|unrestricted|abliterated", target):
        return Command("brain", "uncensored")
    if re.search(r"\b(?:cloud|online|claude|opus|anthropic)\b", target):
        return Command("brain", "cloud")
    model = re.sub(r"\b(?:local|offline|brain|model|llm|the|a)\b", " ", target).strip()
    if re.search(r"\b(?:local|offline)\b", target) and not model:
        return Command("brain", "local")
    if model and re.search(r"\d|qwen|gemma|llama|mistral|phi|deepseek|hermes|dolphin|gpt-?oss", model):
        return Command("brain", "local", model)
    if re.search(r"\b(?:local|offline)\b", target):
        return Command("brain", "local", model)
    return None


async def apply(cmd: Command) -> tuple[bool, str]:
    """Carry out a command. Returns (changed, spoken confirmation)."""
    s = state()
    addr = config.ADDRESS_AS

    if cmd.kind == "status":
        voice = {"edge": "the Edge neural voice", "elevenlabs": "the ElevenLabs voice",
                 "local": "the local voice"}[s.voice]
        return False, f"I'm on the {s.brain} brain ({s.active_model()}), speaking with {voice}, {addr}."

    if cmd.kind == "voice":
        if cmd.target == "elevenlabs" and not os.environ.get("ELEVENLABS_API_KEY", "").strip():
            return False, f"There's no ElevenLabs key in my .env, {addr}, so I'll keep the current voice."
        set_voice(cmd.target)
        label = {"edge": "my standard voice", "elevenlabs": "the ElevenLabs voice",
                 "local": "my local voice"}[cmd.target]
        return True, f"Switched to {label}, {addr}."

    if cmd.target == "cloud":
        set_brain("cloud")
        return True, f"Back on the cloud brain, {config.ANTHROPIC_MODEL}, {addr}."

    installed = await installed_models()
    if installed is None:
        return False, (f"Ollama isn't answering at {config.OLLAMA_HOST}, {addr}. Start Ollama "
                       "and I'll switch.")

    if cmd.target == "uncensored":
        if not UNCENSORED_MODEL:
            return False, (f"No uncensored model is configured, {addr}. Pull one into Ollama and "
                           "set JARVIS_UNCENSORED_MODEL in .env.")
        tag = match_model(UNCENSORED_MODEL, installed) or (UNCENSORED_MODEL if UNCENSORED_MODEL in installed else None)
        if not tag:
            return False, f"{UNCENSORED_MODEL} isn't pulled yet, {addr}. Run: ollama pull {UNCENSORED_MODEL}"
        set_brain("uncensored")
        return True, f"Uncensored brain online: {tag}. Approval gates stay on, {addr}."

    if cmd.model:
        tag = match_model(cmd.model, installed)
        if not tag:
            have = ", ".join(installed) or "none"
            return False, f"I don't have {cmd.model} installed, {addr}. Installed models: {have}."
        set_brain("local", tag)
        return True, f"Local brain online: {tag}, {addr}."

    if s.local_model not in installed:
        if not installed:
            return False, f"Ollama has no models pulled yet, {addr}. Try: ollama pull qwen3:8b"
        set_brain("local", installed[0])
    else:
        set_brain("local")
    return True, f"Local brain online: {state().local_model}, {addr}."
