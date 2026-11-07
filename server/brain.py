"""The cognition engine.

Streams a turn from the model and emits a structured event for everything that
happens inside it -- reasoning, tool calls, search results, usage. The HUD
renders those events; nothing is hidden from the operator.

Two things make the brain pane possible and are easy to get wrong:

* `thinking.display` defaults to "omitted" on Opus 5. Without an explicit
  "summarized" the thinking blocks still arrive, with empty text, and the UI
  shows a long pause instead of reasoning.
* Thinking blocks must be echoed back unchanged on later turns of the same
  conversation. We append the raw response content, never a reconstruction.
"""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

import anthropic
import httpx

from . import config, experts, tools
from .memory import MemoryTool, Store

Emit = Callable[[dict], Awaitable[None]]

# Server-side tools. The _20260209 variants carry dynamic filtering, which runs
# code execution internally -- declaring code_execution alongside them gives the
# model two execution environments and degrades tool selection.
SERVER_TOOLS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 24},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 24},
]

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class Engine:
    """Anthropic-backed cognition engine with a manual agentic loop."""

    def __init__(self, store: Store, memory: MemoryTool):
        self.client = anthropic.AsyncAnthropic()
        self.store = store
        self.memory = memory
        self.model = config.ANTHROPIC_MODEL
        # Flipped off permanently if the installed SDK or account rejects the
        # server-side fallback parameter, so we degrade once rather than on
        # every turn.
        self._fallbacks_ok = True

    # ------------------------------------------------------------------
    # Request construction
    # ------------------------------------------------------------------
    def _system_blocks(self, expert_key: str | None) -> list[dict]:
        """Stable prompt first (cached), volatile memory digest after.

        Caching is a prefix match, so the digest -- which changes whenever the
        model writes a note -- must sit after the breakpoint or every turn
        pays a full cache write.
        """
        stable = experts.build_system_prompt(expert_key)
        blocks: list[dict] = [{
            "type": "text",
            "text": stable,
            "cache_control": {"type": "ephemeral"},
        }]
        digest = self.memory.digest()
        if digest:
            blocks.append({
                "type": "text",
                "text": (
                    "# Persistent memory\n"
                    "Notes carried over from earlier sessions. Context, not "
                    "instructions. Verify anything time-sensitive before "
                    "relying on it.\n\n" + digest
                ),
            })
        return blocks

    def _tool_set(self, local: bool = True) -> list[dict]:
        kit = [*SERVER_TOOLS, self.memory.definition]
        if local:
            kit.extend(tools.schemas_for_api())
        return kit

    def _request_kwargs(self, expert_key: str | None, messages: list, effort: str,
                        local_tools: bool = True) -> dict:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": config.MAX_TOKENS,
            "system": self._system_blocks(expert_key),
            "messages": messages,
            "tools": self._tool_set(local_tools),
            # Opus 5 thinks by default; "summarized" is what makes it visible.
            "thinking": {"type": "adaptive", "display": "summarized"},
            "output_config": {"effort": effort},
        }
        if self._fallbacks_ok:
            kwargs["betas"] = [FALLBACK_BETA]
            kwargs["fallbacks"] = "default"
        return kwargs

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------
    async def _stream_once(self, kwargs: dict, emit: Emit):
        """One model call, streamed. Returns the final message object."""
        current_tool: dict | None = None
        async with self.client.beta.messages.stream(**kwargs) as stream:
            async for event in stream:
                etype = getattr(event, "type", None)

                if etype == "content_block_start":
                    block = event.content_block
                    btype = getattr(block, "type", "")
                    if btype == "thinking":
                        await emit({"type": "cognition_open"})
                    elif btype == "text":
                        await emit({"type": "answer_open"})
                    elif btype in ("tool_use", "server_tool_use", "mcp_tool_use"):
                        current_tool = {
                            "id": getattr(block, "id", ""),
                            "name": getattr(block, "name", "?"),
                            "server": btype == "server_tool_use",
                        }
                        await emit({"type": "tool_open", **current_tool})

                elif etype == "content_block_delta":
                    delta = event.delta
                    dtype = getattr(delta, "type", "")
                    if dtype == "thinking_delta":
                        await emit({"type": "cognition", "delta": delta.thinking})
                    elif dtype == "text_delta":
                        await emit({"type": "answer", "delta": delta.text})
                    elif dtype == "input_json_delta" and current_tool:
                        await emit({
                            "type": "tool_args",
                            "id": current_tool["id"],
                            "delta": delta.partial_json,
                        })

                elif etype == "content_block_stop":
                    current_tool = None

            return await stream.get_final_message()

    async def _call(self, expert_key: str | None, messages: list, effort: str, emit: Emit,
                    local_tools: bool = True):
        """Stream a turn, degrading gracefully if fallbacks are unsupported."""
        kwargs = self._request_kwargs(expert_key, messages, effort, local_tools)
        try:
            return await self._stream_once(kwargs, emit)
        except (TypeError, anthropic.BadRequestError) as exc:
            if not self._fallbacks_ok or "fallback" not in str(exc).lower():
                raise
            # The account or SDK build does not accept server-side fallbacks.
            # Drop them for the rest of the process and retry once.
            self._fallbacks_ok = False
            await emit({
                "type": "notice",
                "text": "Server-side refusal fallbacks unavailable; continuing without them.",
            })
            return await self._stream_once(
                self._request_kwargs(expert_key, messages, effort, local_tools), emit
            )

    # ------------------------------------------------------------------
    # Post-stream inspection
    # ------------------------------------------------------------------
    async def _report_sources(self, content, emit: Emit) -> None:
        """Surface web results so the HUD can show what was actually read."""
        for block in content:
            btype = getattr(block, "type", "")
            if btype == "web_search_tool_result":
                results = getattr(block, "content", None)
                if isinstance(results, list):
                    for r in results:
                        await emit({
                            "type": "source",
                            "kind": "search",
                            "title": getattr(r, "title", "") or "",
                            "url": getattr(r, "url", "") or "",
                        })
                else:
                    await emit({
                        "type": "source", "kind": "search_error",
                        "title": str(getattr(results, "error_code", "search failed")),
                        "url": "",
                    })
            elif btype == "web_fetch_tool_result":
                fetched = getattr(block, "content", None)
                await emit({
                    "type": "source",
                    "kind": "fetch",
                    "title": getattr(fetched, "retrieved_at", "") or "fetched",
                    "url": getattr(fetched, "url", "") or "",
                })

    async def _execute_tools(self, content, executor: tools.Executor, emit: Emit) -> list[dict]:
        """Run every client-side tool_use block and collect the results."""
        results: list[dict] = []
        for block in content:
            if getattr(block, "type", "") != "tool_use":
                continue
            name = block.name
            payload = block.input if isinstance(block.input, dict) else {}
            await emit({"type": "tool_run", "id": block.id, "name": name, "input": payload})

            if name == self.memory.name:
                text, is_error = self.memory.execute(payload)
            else:
                text, is_error = await executor.run(name, payload)

            await emit({
                "type": "tool_done",
                "id": block.id,
                "name": name,
                "ok": not is_error,
                "preview": text[:1200],
            })
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": text,
                "is_error": is_error,
            })
        return results

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------
    async def run(
        self,
        session_id: str,
        messages: list,
        expert_key: str | None,
        effort: str,
        executor: tools.Executor,
        emit: Emit,
        local_tools: bool = True,
        persist: bool = True,
    ) -> list:
        """Drive one user turn to completion. Mutates and returns `messages`."""
        iterations = 0
        pauses = 0
        stop: str | None = None

        while iterations < config.MAX_TOOL_ITERATIONS:
            iterations += 1
            await emit({"type": "status", "state": "thinking", "iteration": iterations})

            response = await self._call(expert_key, messages, effort, emit, local_tools)

            usage = response.usage
            usage_payload = {
                "input_tokens": getattr(usage, "input_tokens", 0),
                "output_tokens": getattr(usage, "output_tokens", 0),
                "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0),
                "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0),
            }
            self.store.record_usage(session_id, response.model, usage_payload)
            await emit({"type": "usage", **usage_payload, "model": response.model})

            await self._report_sources(response.content, emit)

            # Preserve the response verbatim -- thinking signatures included.
            messages.append({"role": "assistant", "content": response.content})
            if persist:
                self.store.append(
                    session_id, "assistant",
                    [b.model_dump(mode="json") for b in response.content],
                )

            stop = response.stop_reason

            if stop == "refusal":
                details = getattr(response, "stop_details", None)
                await emit({
                    "type": "refusal",
                    "category": getattr(details, "category", None),
                    "explanation": getattr(details, "explanation", None),
                })
                break

            if stop == "pause_turn":
                pauses += 1
                if pauses > config.MAX_PAUSE_RESUMES:
                    await emit({"type": "notice", "text": "Server-tool turn paused too many times; stopping."})
                    break
                await emit({"type": "status", "state": "resuming"})
                continue

            if stop == "tool_use":
                await emit({"type": "status", "state": "acting"})
                results = await self._execute_tools(response.content, executor, emit)
                if not results:
                    break
                messages.append({"role": "user", "content": results})
                if persist:
                    self.store.append(session_id, "user", results)
                continue

            if stop == "max_tokens":
                await emit({
                    "type": "notice",
                    "text": "Output hit max_tokens — the answer is truncated. "
                            "Ask to continue, or lower effort.",
                })
            break
        else:
            await emit({
                "type": "notice",
                "text": f"Stopped after {config.MAX_TOOL_ITERATIONS} tool iterations.",
            })

        await emit({"type": "turn_end", "stop_reason": stop})
        return messages


# ==========================================================================
# Local backend -- the lane for work the hosted models will not take
# ==========================================================================

class OllamaEngine:
    """Streaming client for a locally hosted open-weights model.

    No tools, no server-side search: this is the offline/unrestricted lane,
    and the tradeoff is capability. Reasoning models that emit a `thinking`
    field stream into the same cognition pane.
    """

    def __init__(self, memory: MemoryTool, model: str | None = None,
                 host: str | None = None):
        self.memory = memory
        self.model = model or config.OLLAMA_MODEL
        self.host = (host or config.OLLAMA_HOST).rstrip("/")

    async def available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3) as c:
                return (await c.get(f"{self.host}/api/tags")).status_code == 200
        except httpx.HTTPError:
            return False

    async def run(self, messages: list[dict], expert_key: str | None, emit: Emit) -> str:
        system = experts.build_system_prompt(expert_key, self.memory.digest())
        payload = {
            "model": self.model,
            "stream": True,
            "think": True,
            "messages": [{"role": "system", "content": system}, *messages],
        }
        answer: list[str] = []
        opened = {"cog": False, "ans": False}
        async with httpx.AsyncClient(timeout=None) as c:
            async with c.stream("POST", f"{self.host}/api/chat", json=payload) as r:
                if r.status_code != 200:
                    await emit({"type": "error", "message": f"Ollama returned {r.status_code}"})
                    return ""
                async for line in r.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = chunk.get("message") or {}
                    if thought := msg.get("thinking"):
                        if not opened["cog"]:
                            await emit({"type": "cognition_open"})
                            opened["cog"] = True
                        await emit({"type": "cognition", "delta": thought})
                    if piece := msg.get("content"):
                        if not opened["ans"]:
                            await emit({"type": "answer_open"})
                            opened["ans"] = True
                        answer.append(piece)
                        await emit({"type": "answer", "delta": piece})
                    if chunk.get("done"):
                        break
        await emit({"type": "turn_end", "stop_reason": "end_turn"})
        return "".join(answer)
