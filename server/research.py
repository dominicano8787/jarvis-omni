"""Deep research: a bounded, multi-angle sweep with an objective stop rule.

The brief was "search six times to confirm something does or does not exist."
Six identical searches confirm nothing — a search engine returns the same page
six times. So each pass attacks the question from a deliberately different
angle, and convergence is measured on evidence rather than on the model's own
opinion of whether it is finished: a pass counts as *dry* if it surfaced no URL
the sweep had not already seen. Two dry passes in a row and the sweep stops,
because the question has been answered as well as public sources allow.

Output is a dated Markdown dossier under data/research, and (when the operator
asks) a distilled note in the memory directory so the next session starts from
the conclusion instead of repeating the sweep.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Awaitable, Callable

from . import config, tools
from .brain import Engine

Emit = Callable[[dict], Awaitable[None]]


@dataclass
class Pass:
    key: str
    label: str
    instruction: str


# Each angle is written to find things the others structurally cannot.
PASSES: list[Pass] = [
    Pass(
        "canonical", "Primary sources",
        "Establish the ground truth. Find the authoritative material: official "
        "documentation, specifications, the source repository, the original "
        "paper or announcement, the vendor's own pages. Quote the version "
        "numbers and dates you find. If the subject has a canonical home, "
        "identify it.",
    ),
    Pass(
        "recent", "Current state",
        "Find what changed recently. Releases, changelogs, deprecations, "
        "pricing changes, and announcements from roughly the last six months, "
        "weighted toward the last ninety days. Explicitly state the most "
        "recent development you can date, and say how stale the primary "
        "sources from pass one are.",
    ),
    Pass(
        "practitioner", "Practitioner reports",
        "Find what people building with this actually report. GitHub issues "
        "and discussions, Hacker News, Reddit, Stack Overflow, engineering "
        "blogs, conference talks. You are looking for the gap between the "
        "documentation and the lived experience: undocumented limits, common "
        "failure modes, workarounds that circulate informally.",
    ),
    Pass(
        "video", "Video and demonstrations",
        "Search video platforms, YouTube above all, for talks, tutorials, "
        "walkthroughs, teardowns, and demos. Search site-scoped "
        "(site:youtube.com and similar) and also for conference recordings. "
        "Fetch descriptions and any transcript or summary pages you can reach. "
        "Report what is actually demonstrated on screen versus claimed in "
        "text, and name the channels or speakers worth following.",
    ),
    Pass(
        "adversarial", "Adversarial check",
        "Attack the picture built so far. Search for criticism, benchmarks "
        "that disagree, security advisories, reports that it does not work, "
        "abandoned-project signals, and competing approaches that claim to be "
        "better. If an earlier pass produced a confident claim, actively try "
        "to falsify it and report whether it survived.",
    ),
    Pass(
        "existence", "Existence and alternatives",
        "Settle the existence question directly. If the operator asked for "
        "something that may not exist, search for it by every plausible name, "
        "synonym, and adjacent framing, including academic phrasing and "
        "vendor marketing phrasing. Then search the nearest neighbours: what "
        "is the closest thing that does exist? Conclude with one of: it "
        "exists (here it is), it partially exists (this is the gap), or no "
        "public evidence of it exists (and this is what would be needed to "
        "build it).",
    ),
]

URL_RE = re.compile(r"https?://[^\s<>\")\]]+", re.I)


@dataclass
class SweepState:
    question: str
    seen_urls: set[str] = field(default_factory=set)
    pass_log: list[dict] = field(default_factory=list)
    dry_streak: int = 0


def _slug(text: str, limit: int = 60) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s[:limit].rstrip("-")) or "sweep"


class DeepResearch:
    def __init__(self, engine: Engine):
        self.engine = engine

    async def sweep(
        self,
        session_id: str,
        question: str,
        expert_key: str | None,
        emit: Emit,
        max_passes: int | None = None,
    ) -> str:
        """Run the sweep and return the dossier text."""
        limit = min(max_passes or config.RESEARCH_MAX_PASSES, len(PASSES))
        state = SweepState(question=question)

        # Research runs with web tools and memory only. A sweep has no business
        # executing shell commands, so the local kit is withheld rather than
        # merely discouraged.
        executor = tools.Executor(approve=_deny_all, autonomous=False)

        for index in range(limit):
            spec = PASSES[index]
            await emit({
                "type": "research_phase",
                "pass": index + 1,
                "total": limit,
                "key": spec.key,
                "label": spec.label,
            })

            found_here: set[str] = set()

            async def pass_emit(event: dict, _found=found_here) -> None:
                if event.get("type") == "source" and event.get("url"):
                    _found.add(event["url"])
                await emit(event)

            prompt = self._pass_prompt(spec, state, index + 1, limit)
            scratch: list = [{"role": "user", "content": prompt}]
            await self.engine.run(
                session_id=session_id,
                messages=scratch,
                expert_key=expert_key,
                effort="high",
                executor=executor,
                emit=pass_emit,
                local_tools=False,
                persist=False,
            )

            summary = _last_text(scratch)
            found_here |= set(URL_RE.findall(summary))
            fresh = found_here - state.seen_urls
            state.seen_urls |= found_here
            state.pass_log.append({
                "key": spec.key,
                "label": spec.label,
                "summary": summary,
                "new_sources": sorted(fresh),
                "total_sources": len(found_here),
            })

            state.dry_streak = state.dry_streak + 1 if not fresh else 0
            await emit({
                "type": "research_result",
                "pass": index + 1,
                "label": spec.label,
                "new_sources": len(fresh),
                "dry_streak": state.dry_streak,
            })

            if state.dry_streak >= config.RESEARCH_DRY_PASSES_TO_STOP:
                await emit({
                    "type": "notice",
                    "text": (
                        f"Converged after pass {index + 1}: "
                        f"{config.RESEARCH_DRY_PASSES_TO_STOP} consecutive passes "
                        f"surfaced no new sources."
                    ),
                })
                break

        await emit({"type": "research_phase", "pass": limit, "total": limit,
                    "key": "synthesis", "label": "Synthesis"})
        dossier = await self._synthesise(session_id, state, expert_key, executor, emit)
        path = self._write(state.question, dossier, state)
        await emit({"type": "research_done", "path": str(path),
                    "passes": len(state.pass_log),
                    "sources": len(state.seen_urls)})
        return dossier

    # ------------------------------------------------------------------
    def _pass_prompt(self, spec: Pass, state: SweepState, n: int, total: int) -> str:
        prior = ""
        if state.pass_log:
            bullets = "\n".join(
                f"- {p['label']}: {_first_line(p['summary'])}" for p in state.pass_log
            )
            prior = f"\n\nEstablished so far:\n{bullets}\n"
        already = ""
        if state.seen_urls:
            sample = list(sorted(state.seen_urls))[:40]
            already = (
                "\n\nAlready consulted (do not re-summarise these; find "
                "material they do not cover):\n" + "\n".join(f"- {u}" for u in sample)
            )
        return (
            f"DEEP RESEARCH — pass {n} of {total}: {spec.label}\n\n"
            f"Question: {state.question}\n"
            f"{prior}{already}\n\n"
            f"This pass: {spec.instruction}\n\n"
            "Search and fetch aggressively — several queries, several fetches. "
            "Then report, in prose: what you found, where (give full URLs "
            "inline), how confident you are in each claim, and what remains "
            "unresolved. If this angle genuinely produced nothing new, say so "
            "in one sentence rather than padding. Do not write a conclusion "
            "for the whole question yet; that comes at synthesis."
        )

    async def _synthesise(self, session_id: str, state: SweepState,
                          expert_key: str | None, executor: tools.Executor,
                          emit: Emit) -> str:
        transcript = "\n\n".join(
            f"### Pass: {p['label']}\n{p['summary']}" for p in state.pass_log
        )
        prompt = (
            f"Synthesise the sweep into a dossier.\n\n"
            f"Question: {state.question}\n\n"
            f"Passes run: {len(state.pass_log)} of {config.RESEARCH_MAX_PASSES}. "
            f"Distinct sources consulted: {len(state.seen_urls)}.\n\n"
            f"{transcript}\n\n---\n\n"
            "Write the dossier in Markdown with these sections:\n"
            "1. **Verdict** — the direct answer in two or three sentences. If "
            "the question was whether something exists, answer exists / "
            "partially exists / no public evidence, and say so plainly.\n"
            "2. **What is established** — claims you would defend, each with "
            "its source.\n"
            "3. **What is contested or uncertain** — where sources disagree, "
            "and which you weight more heavily and why.\n"
            "4. **Gaps** — what the public record does not answer, and what it "
            "would take to answer it.\n"
            "5. **Actionable next steps** — concrete, for this operator.\n"
            "6. **Sources** — grouped by pass, full URLs.\n\n"
            "Do not hedge uniformly. Say which parts you are confident about "
            "and which you are not. If the sweep converged early because the "
            "topic is thin, say that outright."
        )
        scratch: list = [{"role": "user", "content": prompt}]
        await self.engine.run(
            session_id=session_id,
            messages=scratch,
            expert_key=expert_key,
            effort="high",
            executor=executor,
            emit=emit,
            local_tools=False,
            persist=False,
        )
        return _last_text(scratch)

    def _write(self, question: str, dossier: str, state: SweepState):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        path = config.RESEARCH_DIR / f"{stamp}-{_slug(question)}.md"
        header = (
            f"# Deep research dossier\n\n"
            f"**Question:** {question}\n\n"
            f"**Run:** {datetime.now(timezone.utc).isoformat(timespec='seconds')}  \n"
            f"**Passes:** {len(state.pass_log)} "
            f"({', '.join(p['label'] for p in state.pass_log)})  \n"
            f"**Distinct sources:** {len(state.seen_urls)}\n\n---\n\n"
        )
        path.write_text(header + dossier, encoding="utf-8")
        return path


# ----------------------------------------------------------------------
def _last_text(messages: list) -> str:
    """Pull the final assistant prose out of a scratch message list."""
    for msg in reversed(messages):
        if msg.get("role") != "assistant":
            continue
        chunks = []
        for block in msg.get("content", []):
            if getattr(block, "type", None) == "text":
                chunks.append(block.text)
            elif isinstance(block, dict) and block.get("type") == "text":
                chunks.append(block.get("text", ""))
        if chunks:
            return "\n".join(chunks).strip()
    return ""


def _first_line(text: str, limit: int = 220) -> str:
    line = next((l.strip() for l in text.splitlines() if l.strip()), "")
    return line if len(line) <= limit else line[:limit] + "…"


async def _deny_all(name: str, payload: dict, why: str) -> bool:
    """Research passes carry no local-tool privileges."""
    return False
