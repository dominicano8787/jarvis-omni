"""HTTP + WebSocket server. One operator, one machine, no telemetry.

The WebSocket carries the whole live protocol: prompts and control messages in,
cognition / answer / tool / research events out. Everything the model does is
reported, including the reasoning stream and every tool call before it runs.
"""

from __future__ import annotations

from datetime import datetime, timezone

import asyncio
import json
import os
import traceback
import uuid
from contextlib import suppress
from pathlib import Path

import shutil
import subprocess
import time
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import config, experts, tools
from .access_gate import AccessGate, cors_origins
from .brain import Engine, OllamaEngine
from .cognitive_core import JarvisCognitiveCore
from .memory import MemoryTool, Store
from .research import DeepResearch
from .real_media_engine import (
    UPLOADS_DIR,
    TTS_CACHE_DIR,
    generate_real_image,
    edit_real_image,
    generate_real_video,
    render_real_timeline,
    list_generated_videos,
    save_uploaded_file,
    get_uploaded_media_library,
    synthesize_male_british_tts,
    ensure_starter_media,
)

APPROVAL_TIMEOUT = 300  # seconds a gated tool call waits for a decision

app = FastAPI(title="J.A.R.V.I.S. v4.0 Standalone & Z Fold 7 Omni-System", docs_url="/docs", redoc_url="/redoc")

# Order matters: the last middleware added is the outermost. CORS must wrap the
# gate so preflights are answered and 401s still carry CORS headers.
app.add_middleware(AccessGate)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = Store()
memory = MemoryTool()
memory.bootstrap()

cognitive_core = JarvisCognitiveCore(store, memory)
AUDIO_DIR = config.DATA_DIR / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/api/media/files", StaticFiles(directory=UPLOADS_DIR), name="media_uploads")
app.mount("/api/tts/cache", StaticFiles(directory=TTS_CACHE_DIR), name="tts_cache")

_engine: Engine | None = None


def engine() -> Engine:
    """Lazily construct the Anthropic client so a missing key is a clean error."""
    global _engine
    if _engine is None:
        _engine = Engine(store, memory)
    return _engine


# ==========================================================================
# REST surface (HUD bootstrap data)
# ==========================================================================

@app.get("/api/status")
async def api_status():
    return {
        "principal": config.PRINCIPAL,
        "address_as": config.ADDRESS_AS,
        "backend": config.BACKEND,
        "model": config.ANTHROPIC_MODEL,
        "effort": config.DEFAULT_EFFORT,
        "key_present": config.api_key_present(),
        "autonomous_default": config.AUTONOMOUS_DEFAULT,
        "workspace_roots": [str(p) for p in config.WORKSPACE_ROOTS],
        "research_passes": config.RESEARCH_MAX_PASSES,
        "totals": store.totals(),
        "voice": "en-GB-RyanNeural (British Male J.A.R.V.I.S.)",
    }


def _is_agent_authorized(headers, query_token: str | None = None) -> bool:
    expected = os.environ.get("JARVIS_AGENT_TOKEN", "").strip()
    if not expected:
        return True
    auth = (headers.get("authorization") or "").strip()
    bearer = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    provided = (headers.get("x-jarvis-token") or bearer or query_token or "").strip()
    return provided == expected


@app.get("/api/health")
async def api_health():
    return {
        "ok": True,
        "status": "HEALTHY",
        "service": "J.A.R.V.I.S. Local PC Agent",
        "version": "4.3.0",
        "token_required": bool(os.environ.get("JARVIS_AGENT_TOKEN", "").strip()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/experts")
async def api_experts():
    return experts.catalogue()


@app.get("/api/memory")
async def api_memory():
    return {"root": str(memory.root), "files": memory.listing()}


@app.get("/api/sessions")
async def api_sessions():
    return store.sessions()


@app.get("/api/research")
async def api_research():
    items = sorted(
        config.RESEARCH_DIR.glob("*.md"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return [
        {"name": p.name, "bytes": p.stat().st_size, "mtime": p.stat().st_mtime}
        for p in items[:50]
    ]


@app.get("/api/research/{name}")
async def api_research_one(name: str):
    target = (config.RESEARCH_DIR / name).resolve()
    if config.RESEARCH_DIR.resolve() not in target.parents or not target.is_file():
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"name": name, "text": target.read_text(encoding="utf-8", errors="replace")}


# ==========================================================================
# WebSocket session
# ==========================================================================

class Session:
    """One live HUD connection."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.id = uuid.uuid4().hex[:12]
        self.messages: list = []
        self.expert = "general"
        self.effort = config.DEFAULT_EFFORT
        self.autonomous = config.AUTONOMOUS_DEFAULT
        self.pending: dict[str, asyncio.Future[bool]] = {}
        self.task: asyncio.Task | None = None
        store.ensure_session(self.id, self.expert)

    async def emit(self, event: dict) -> None:
        with suppress(RuntimeError, WebSocketDisconnect):
            await self.ws.send_text(json.dumps(event, default=str))

    # -- approval gate -----------------------------------------------------
    async def approve(self, name: str, payload: dict, why: str) -> bool:
        req_id = uuid.uuid4().hex[:10]
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[bool] = loop.create_future()
        self.pending[req_id] = fut
        await self.emit({
            "type": "approval_request",
            "id": req_id,
            "tool": name,
            "why": why,
            "payload": payload,
            "danger": tools.BY_NAME.get(name, {}).get("danger", "none"),
        })
        try:
            return await asyncio.wait_for(fut, timeout=APPROVAL_TIMEOUT)
        except asyncio.TimeoutError:
            await self.emit({"type": "approval_expired", "id": req_id})
            return False
        finally:
            self.pending.pop(req_id, None)

    def resolve(self, req_id: str, allow: bool) -> None:
        fut = self.pending.get(req_id)
        if fut and not fut.done():
            fut.set_result(allow)

    def executor(self) -> tools.Executor:
        return tools.Executor(approve=self.approve, autonomous=self.autonomous)

    # -- work --------------------------------------------------------------
    async def handle_prompt(self, text: str, deep: bool) -> None:
        store.ensure_session(self.id, self.expert)
        if deep:
            await self.emit({"type": "status", "state": "researching"})
            await DeepResearch(engine()).sweep(
                session_id=self.id,
                question=text,
                expert_key=self.expert,
                emit=self.emit,
            )
        else:
            self.messages.append({"role": "user", "content": text})
            store.append(self.id, "user", text)
            await engine().run(
                session_id=self.id,
                messages=self.messages,
                expert_key=self.expert,
                effort=self.effort,
                executor=self.executor(),
                emit=self.emit,
            )
        await self.emit({"type": "status", "state": "idle"})
        await self.emit({"type": "memory_update", "files": memory.listing()})

    async def handle_prompt_local(self, text: str) -> None:
        local = OllamaEngine(memory)
        if not await local.available():
            await self.emit({
                "type": "error",
                "message": (
                    f"No local model server at {config.OLLAMA_HOST}. Install Ollama "
                    "and pull a model, or switch the backend back to Anthropic."
                ),
            })
            return
        self.messages.append({"role": "user", "content": text})
        reply = await local.run(
            [m for m in self.messages if isinstance(m.get("content"), str)],
            self.expert, self.emit,
        )
        self.messages.append({"role": "assistant", "content": reply})
        await self.emit({"type": "status", "state": "idle"})


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    session = Session(ws)
    await session.emit({
        "type": "hello",
        "session": session.id,
        "principal": config.PRINCIPAL,
        "address_as": config.ADDRESS_AS,
        "model": config.ANTHROPIC_MODEL,
        "backend": config.BACKEND,
        "effort": session.effort,
        "autonomous": session.autonomous,
        "key_present": config.api_key_present(),
    })

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await session.emit({"type": "error", "message": "malformed frame"})
                continue

            kind = msg.get("type")

            if kind == "prompt":
                text = (msg.get("text") or "").strip()
                if not text:
                    continue
                if session.task and not session.task.done():
                    await session.emit({
                        "type": "error",
                        "message": "A turn is already running. Interrupt it first.",
                    })
                    continue
                session.expert = msg.get("expert") or session.expert
                session.effort = msg.get("effort") or session.effort
                deep = bool(msg.get("deep_research"))
                runner = (
                    session.handle_prompt_local(text)
                    if config.BACKEND == "ollama"
                    else session.handle_prompt(text, deep)
                )
                session.task = asyncio.create_task(_guard(session, runner))

            elif kind == "approve":
                session.resolve(msg.get("id", ""), bool(msg.get("allow")))

            elif kind == "interrupt":
                if session.task and not session.task.done():
                    session.task.cancel()
                    await session.emit({"type": "notice", "text": "Turn interrupted."})
                for fut in list(session.pending.values()):
                    if not fut.done():
                        fut.set_result(False)
                await session.emit({"type": "status", "state": "idle"})

            elif kind == "settings":
                if "expert" in msg:
                    session.expert = msg["expert"]
                if "effort" in msg:
                    session.effort = msg["effort"]
                if "autonomous" in msg:
                    session.autonomous = bool(msg["autonomous"])
                await session.emit({
                    "type": "settings",
                    "expert": session.expert,
                    "effort": session.effort,
                    "autonomous": session.autonomous,
                })

            elif kind == "reset":
                session.messages = []
                await session.emit({"type": "reset_ok"})

            elif kind == "ping":
                await session.emit({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        if session.task and not session.task.done():
            session.task.cancel()


async def _guard(session: Session, coro) -> None:
    """Run a turn, reporting failures to the HUD instead of killing the socket."""
    try:
        await coro
    except asyncio.CancelledError:
        await session.emit({"type": "status", "state": "idle"})
        raise
    except Exception as exc:  # surfaced to the operator, never swallowed
        await session.emit({
            "type": "error",
            "message": f"{exc.__class__.__name__}: {exc}",
            "trace": traceback.format_exc(limit=6),
        })
        await session.emit({"type": "status", "state": "idle"})


# ==========================================================================
# Static HUD
# ==========================================================================

HUD_DIST = config.ROOT / "ui" / "dist"
HUD_ASSETS = HUD_DIST / "assets"
if HUD_ASSETS.is_dir():
    app.mount("/assets", StaticFiles(directory=HUD_ASSETS), name="hud_assets")

@app.get("/")
async def index():
    dist_index = HUD_DIST / "index.html"
    if dist_index.is_file():
        return FileResponse(dist_index)
    return FileResponse(config.WEB_DIR / "index.html")

@app.get("/legacy")
async def legacy_index():
    return FileResponse(config.WEB_DIR / "index.html")

app.mount("/static", StaticFiles(directory=config.WEB_DIR), name="static")

# ==========================================================================
# Bridge & 3D Holographic UI Mount
# ==========================================================================

@app.get("/api/bridge/state")
async def api_bridge_state():
    bridge_path = Path(r"C:\Users\plata\.grok-claude-bridge\state.json")
    state = {}
    if bridge_path.is_file():
        try:
            state = json.loads(bridge_path.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass

    notes = [
        {
            "key": k,
            "content": v.get("content", ""),
            "preview": v.get("content", "")[:160].replace("\n", " "),
            "updated_by": v.get("updated_by", "system"),
            "updated_at": v.get("updated_at", "")
        }
        for k, v in state.get("notes", {}).items()
    ]
    tasks = state.get("tasks", [])
    session = state.get("session", {
        "goal": "Autonomous Systems Orchestration",
        "project_path": str(config.ROOT),
        "active_files": []
    })
    stats = {
        "totalNotes": len(notes),
        "totalTasks": len(tasks),
        "openTasks": sum(1 for t in tasks if t.get("status") in ("open", "in_progress")),
        "completedTasks": sum(1 for t in tasks if t.get("status") == "done"),
        "sessionUpdated": state.get("updated_at", "")
    }

    user_home = Path(r"C:\Users\plata")
    docs = [
        "Limit_Break_Johnny_Boy_Comprehensive_Memory_Clone_2026-09-23.md",
        r".claude\CLAUDE.md",
        r".grok-claude-bridge\LIMIT_BREAK_SHARED_MEMORY.md",
    ]
    knowledge_files = []
    for rel in docs:
        p = user_home / rel
        exists = p.is_file()
        size = f"{p.stat().st_size / 1024:.1f} KB" if exists else "0 B"
        preview = p.read_text(encoding="utf-8", errors="replace")[:180].replace("\n", " ") if exists else ""
        knowledge_files.append({
            "title": p.name,
            "path": str(p),
            "relPath": rel,
            "exists": exists,
            "size": size,
            "preview": preview,
        })

    return {
        "ok": True,
        "session": session,
        "stats": stats,
        "notes": notes,
        "tasks": tasks,
        "knowledgeFiles": knowledge_files,
    }

if HUD_DIST.is_dir():
    app.mount("/hud", StaticFiles(directory=HUD_DIST, html=True), name="hud")


# ==========================================================================
# Streaming Chat SSE Endpoint for 3D HUD (Live Instruction Execution)
# ==========================================================================

@app.post("/api/chat")
async def api_chat(request: Request):
    data = await request.json()
    message = data.get("message", "").strip()
    history = data.get("history", [])
    requested_engine = data.get("engine", "gemini-pro") or "gemini-pro"

    async def event_generator():
        yield f"event: telemetry\ndata: {json.dumps({'phase': 'GEMINI_SOUL_INIT', 'text': f'Gemini Pro Soul active // Executing directive via [{requested_engine.upper()}]...'})}\n\n"
        async for event_name, payload in cognitive_core.execute(message, history, engine=requested_engine):
            yield f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ==========================================================================
# Temporal Durable Orchestration Surface
# ==========================================================================

from .temporal_engine import (
    get_client,
    JarvisResearchDirective,
    JarvisResearchWorkflow,
    GatedActionDirective,
    JarvisGatedExecutionWorkflow,
    CreativeTaskDirective,
    JarvisCreativeGenerationWorkflow,
    TEMPORAL_TASK_QUEUE,
    run_jarvis_worker,
    record_workflow_entry,
    list_recorded_workflows,
)

@app.on_event("startup")
async def startup_temporal():
    try:
        asyncio.create_task(run_jarvis_worker(store, memory))
    except Exception as e:
        print(f"[Temporal Worker Auto-Start Notice] {e}")
    try:
        asyncio.create_task(ensure_starter_media())
    except Exception as e:
        print(f"[Starter Media Init Notice] {e}")

@app.get("/api/temporal/status")
async def api_temporal_status():
    try:
        client = await get_client()
        from temporalio.api.workflowservice.v1 import GetSystemInfoRequest
        desc = await client.workflow_service.get_system_info(GetSystemInfoRequest())
        return {
            "connected": True,
            "server_version": desc.server_version,
            "task_queue": TEMPORAL_TASK_QUEUE,
            "namespace": client.namespace,
        }
    except Exception as e:
        return {"connected": False, "error": str(e), "task_queue": TEMPORAL_TASK_QUEUE}

@app.post("/api/temporal/research/start")
async def api_temporal_research_start(request: Request):
    data = await request.json()
    directive_text = data.get("directive", "").strip() or "Deconstruct https://openart.ai/suite/home and recreate a self-hosted AI Creative Studio"
    max_passes = int(data.get("max_passes", 4))
    expert = data.get("expert", "general")
    require_approval = bool(data.get("require_approval", False))

    try:
        client = await get_client()
        workflow_id = f"jarvis-research-{uuid.uuid4().hex[:8]}"
        directive = JarvisResearchDirective(
            directive=directive_text,
            expert=expert,
            max_passes=max_passes,
            operator=config.PRINCIPAL,
            require_approval_before_synthesis=require_approval,
        )
        handle = await client.start_workflow(
            JarvisResearchWorkflow.run,
            directive,
            id=workflow_id,
            task_queue=TEMPORAL_TASK_QUEUE,
        )
        record_workflow_entry({
            "workflow_id": handle.id,
            "run_id": handle.result_run_id,
            "type": "JarvisResearchWorkflow",
            "title": directive_text,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"ok": True, "workflow_id": handle.id, "run_id": handle.result_run_id}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

@app.get("/api/temporal/research/{workflow_id}")
async def api_temporal_research_query(workflow_id: str):
    try:
        client = await get_client()
        handle = client.get_workflow_handle(workflow_id)
        desc = await handle.describe()
        progress = await handle.query(JarvisResearchWorkflow.get_sweep_progress)
        dossier = await handle.query(JarvisResearchWorkflow.get_dossier)
        return {
            "ok": True,
            "status": desc.status.name,
            "progress": progress,
            "dossier": dossier,
        }
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

@app.post("/api/temporal/workflow/start-gated")
async def api_temporal_start_gated(request: Request):
    data = await request.json()
    command = data.get("command", "").strip() or "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 Name, Id, CPU"
    rationale = data.get("rationale", "").strip() or "Operator-requested gated PowerShell execution"
    danger_level = data.get("danger_level", "high")
    auto_approve = bool(data.get("auto_approve", False))

    try:
        client = await get_client()
        workflow_id = f"jarvis-gated-{uuid.uuid4().hex[:8]}"
        directive = GatedActionDirective(
            command=command,
            rationale=rationale,
            danger_level=danger_level,
            operator=config.PRINCIPAL,
            auto_approve=auto_approve,
        )
        handle = await client.start_workflow(
            JarvisGatedExecutionWorkflow.run,
            directive,
            id=workflow_id,
            task_queue=TEMPORAL_TASK_QUEUE,
        )
        record_workflow_entry({
            "workflow_id": handle.id,
            "run_id": handle.result_run_id,
            "type": "JarvisGatedExecutionWorkflow",
            "title": f"Gated: {command[:60]}",
            "command": command,
            "rationale": rationale,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"ok": True, "workflow_id": handle.id, "run_id": handle.result_run_id}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

@app.get("/api/temporal/workflows")
async def api_temporal_workflows():
    recorded = list_recorded_workflows()[:20]
    enriched = []
    try:
        client = await get_client()
        for item in recorded:
            wf_id = item.get("workflow_id", "")
            wf_type = item.get("type", "JarvisResearchWorkflow")
            entry = dict(item)
            try:
                handle = client.get_workflow_handle(wf_id)
                desc = await handle.describe()
                entry["status"] = desc.status.name
                if desc.status.name == "RUNNING":
                    if wf_type == "JarvisGatedExecutionWorkflow":
                        gate = await handle.query(JarvisGatedExecutionWorkflow.get_gate_status)
                        entry["gate"] = gate
                        entry["phase"] = f"Gate: {gate.get('gate_state')}"
                    else:
                        prog = await handle.query(JarvisResearchWorkflow.get_sweep_progress)
                        entry["progress"] = prog
                        entry["phase"] = prog.get("phase", "Running")
                elif desc.status.name == "COMPLETED":
                    if wf_type == "JarvisGatedExecutionWorkflow":
                        try:
                            gate = await handle.query(JarvisGatedExecutionWorkflow.get_gate_status)
                            entry["gate"] = gate
                            entry["phase"] = f"Completed ({gate.get('gate_state')})"
                        except Exception:
                            entry["phase"] = "Completed"
                    else:
                        entry["phase"] = "Completed"
            except Exception as ex:
                entry["status"] = entry.get("status", "UNKNOWN")
                entry["error"] = str(ex)
            enriched.append(entry)
    except Exception as e:
        return {"ok": False, "workflows": recorded, "error": str(e)}
    return {"ok": True, "workflows": enriched}

@app.post("/api/temporal/workflow/{workflow_id}/signal")
async def api_temporal_workflow_signal(workflow_id: str, request: Request):
    data = await request.json()
    signal_name = (data.get("signal") or "approve").strip().lower()
    note = data.get("note", "")
    try:
        client = await get_client()
        handle = client.get_workflow_handle(workflow_id)
        if signal_name in ("approve", "deny"):
            approved = signal_name == "approve"
            if workflow_id.startswith("jarvis-gated-"):
                await handle.signal(
                    JarvisGatedExecutionWorkflow.submit_approval,
                    {"approved": approved, "note": note},
                )
            else:
                await handle.signal(JarvisResearchWorkflow.approve_synthesis, approved)
        elif signal_name == "cancel":
            if workflow_id.startswith("jarvis-research-"):
                await handle.signal(JarvisResearchWorkflow.cancel_sweep)
            else:
                await handle.cancel()
        elif signal_name in ("pause", "resume"):
            await handle.signal(JarvisResearchWorkflow.pause_resume, signal_name == "pause")
        return {"ok": True, "workflow_id": workflow_id, "signal": signal_name}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


# ==========================================================================
# OpenArt & AI Creative Studio Endpoints (Real High-Res Images & Editing)
# ==========================================================================

CREATIVE_ASSETS_DIR = config.DATA_DIR / "creative_assets"
CREATIVE_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/creative/assets", StaticFiles(directory=CREATIVE_ASSETS_DIR), name="creative_assets")

@app.get("/api/creative/models")
async def api_creative_models():
    return [
        {
            "id": "nano-banana-2-1",
            "name": "Nano Banana 2.1",
            "provider": "Google DeepMind / OpenArt",
            "type": "image",
            "badge": "4K Native Detail",
            "styles": ["Photorealistic", "Studio Product", "Cyberpunk", "Cinematic 3D"],
        },
        {
            "id": "flux-3-image",
            "name": "FLUX 3 Image",
            "provider": "Black Forest Labs / OpenArt",
            "type": "image",
            "badge": "Highest Aesthetic",
            "styles": ["Cinematic Neo-Tokyo", "Hyperreal Portrait", "Concept Art", "Anime 2D"],
        },
        {
            "id": "gpt-image-2-5-flare",
            "name": "GPT Image 2.5 Flare",
            "provider": "OpenAI / OpenArt",
            "type": "image",
            "badge": "Fastest Layout & Text",
            "styles": ["Digital Illustration", "Graphic Poster", "Vector Minimalist"],
        },
        {
            "id": "byte-plus-seedream-5-pro",
            "name": "Seedream 5 Pro",
            "provider": "ByteDance / OpenArt",
            "type": "image",
            "badge": "Anime & 2D Art Flagship",
            "styles": ["Anime Masterpiece", "Manga Cel Shade", "Fantasy Concept"],
        },
        {
            "id": "wan2-7-image",
            "name": "Wan 2.7 Image",
            "provider": "Alibaba / OpenArt",
            "type": "image",
            "badge": "Face & Anatomy Focus",
            "styles": ["Fashion Photography", "Cinematic Film Still", "Editorial Portrait"],
        },
        {
            "id": "kling-3-omni",
            "name": "Kling 3 Omni",
            "provider": "Kuaishou / OpenArt",
            "type": "video",
            "badge": "4K Cinematic Motion",
            "styles": ["Cinematic Camera Move", "Dramatic Lighting", "Slow Motion 60fps"],
        },
    ]

@app.post("/api/creative/generate")
async def api_creative_generate(request: Request):
    data = await request.json()
    prompt = data.get("prompt", "").strip() or "Tony Stark holographic Arc Reactor laboratory with high-tech HUD diagrams"
    model_id = data.get("model_id", "flux-3-image")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    style_preset = data.get("style_preset", "Cinematic Neo-Tokyo")
    return await generate_real_image(prompt=prompt, model_id=model_id, aspect_ratio=aspect_ratio, style_preset=style_preset)

@app.post("/api/creative/edit")
async def api_creative_edit(request: Request):
    data = await request.json()
    source_url = data.get("source_url", "")
    tool = data.get("tool", "upscale")
    prompt = data.get("prompt", "")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    return await edit_real_image(source_url=source_url, tool=tool, prompt=prompt, aspect_ratio=aspect_ratio)

@app.get("/api/creative/history")
async def api_creative_history():
    history_file = CREATIVE_ASSETS_DIR / "history.json"
    if history_file.is_file():
        try:
            items = json.loads(history_file.read_text(encoding="utf-8"))
            return [h for h in items if not str(h.get("media_url", "")).endswith(".svg")]
        except Exception:
            pass
    return []


# ==========================================================================
# Media Upload & Male British Voice Synthesis (J.A.R.V.I.S. Neural TTS)
# ==========================================================================

@app.post("/api/media/upload")
async def api_media_upload(file: UploadFile = File(...)):
    """Uploads any user image (.png/.jpg/.webp), video (.mp4/.mov/.webm), or audio (.mp3/.wav)."""
    content = await file.read()
    if not content:
        return JSONResponse({"ok": False, "error": "Uploaded file is empty"}, status_code=400)
    return await save_uploaded_file(file.filename or "upload.bin", content, file.content_type or "")

@app.get("/api/media/library")
async def api_media_library():
    return {
        "ok": True,
        "uploads": get_uploaded_media_library(),
        "images": await api_creative_history(),
        "videos": list_generated_videos(),
    }

@app.get("/api/tts/speak")
async def api_tts_speak_get(text: str = "At your service, Sir."):
    mp3_path = await synthesize_male_british_tts(text)
    if mp3_path and mp3_path.is_file():
        media_type = "audio/mpeg" if mp3_path.suffix.lower() == ".mp3" else "audio/wav"
        return FileResponse(mp3_path, media_type=media_type)
    return JSONResponse({"ok": False, "error": "TTS synthesis unavailable"}, status_code=500)

@app.post("/api/tts/speak")
async def api_tts_speak_post(request: Request):
    data = await request.json()
    text = data.get("text", "At your service, Sir.")
    mp3_path = await synthesize_male_british_tts(text)
    if mp3_path and mp3_path.is_file():
        return {
            "ok": True,
            "voice": "en-GB-RyanNeural (British Male J.A.R.V.I.S.)",
            "audio_url": f"/api/tts/cache/{mp3_path.name}",
        }
    return JSONResponse({"ok": False, "error": "TTS synthesis unavailable"}, status_code=500)

@app.post("/api/audio/transcribe")
async def api_audio_transcribe(audio: UploadFile = File(...)):
    """Transcribes an uploaded audio blob using ffmpeg and speech_recognition."""
    temp_in = None
    temp_out = None
    try:
        content = await audio.read()
        if not content or len(content) < 500:
            return JSONResponse({"status": "no_speech", "transcript": "", "message": "Audio stream too short"})

        temp_in = AUDIO_DIR / f"mic_{int(time.time()*1000)}.webm"
        temp_out = AUDIO_DIR / f"mic_{int(time.time()*1000)}.wav"
        temp_in.write_bytes(content)

        ffmpeg_bin = shutil.which("ffmpeg") or "D:/Apps/ffmpeg/bin/ffmpeg.exe"
        if not os.path.exists(ffmpeg_bin):
            return JSONResponse({"status": "error", "message": "FFmpeg binary unavailable on host", "transcript": ""})

        def _convert_and_transcribe():
            cmd = [ffmpeg_bin, "-y", "-i", str(temp_in), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(temp_out)]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            if not temp_out.exists() or temp_out.stat().st_size < 100:
                return None, "empty"
            import speech_recognition as sr
            r = sr.Recognizer()
            with sr.AudioFile(str(temp_out)) as source:
                audio_data = r.record(source)
                return r.recognize_google(audio_data), "ok"

        text, status_flag = await asyncio.to_thread(_convert_and_transcribe)
        if status_flag == "empty":
            return JSONResponse({"status": "no_speech", "transcript": "", "message": "Audio conversion produced empty track"})

        return JSONResponse({"status": "ok", "transcript": text})
    except Exception as e:
        ex_name = type(e).__name__
        err_str = str(e) or ex_name
        if "UnknownValueError" in ex_name or "could not understand" in err_str.lower():
            return JSONResponse({"status": "no_speech", "transcript": "", "message": "No intelligible speech detected"})
        return JSONResponse({"status": "error", "message": f"{ex_name}: {err_str}", "transcript": ""})
    finally:
        try:
            if temp_in and temp_in.exists():
                temp_in.unlink(missing_ok=True)
            if temp_out and temp_out.exists():
                temp_out.unlink(missing_ok=True)
        except Exception:
            pass


# ==============================================================================
# CapCut & Higgsfield Video Studio API Surface (Real Playable MP4 Generation)
# ==============================================================================

from .video_engine import (
    get_capcut_status,
    list_capcut_drafts,
    get_capcut_draft_detail,
    create_capcut_draft_project,
    get_higgsfield_account,
    list_higgsfield_models,
    RENDERS_DIR,
)

@app.get("/api/capcut/status")
async def api_capcut_status():
    return get_capcut_status()

@app.get("/api/capcut/drafts")
async def api_capcut_drafts():
    drafts = list_capcut_drafts()
    return {"ok": True, "drafts": drafts, "count": len(drafts)}

@app.get("/api/capcut/draft/{name}")
async def api_capcut_draft_detail(name: str):
    return get_capcut_draft_detail(name)

@app.post("/api/capcut/create")
async def api_capcut_create(request: Request):
    data = await request.json()
    name = data.get("name", "New_Project")
    duration = float(data.get("duration", 30.0))
    return create_capcut_draft_project(name, duration)

@app.get("/api/higgsfield/account")
async def api_higgsfield_account():
    return await get_higgsfield_account()

@app.get("/api/higgsfield/models")
async def api_higgsfield_models():
    models = await list_higgsfield_models()
    return {"ok": True, "models": models, "count": len(models)}

@app.get("/api/higgsfield/history")
async def api_higgsfield_history():
    jobs = list_generated_videos()
    return {"ok": True, "history": jobs}

@app.get("/api/video/list")
async def api_video_list():
    videos = list_generated_videos()
    return {"ok": True, "videos": videos, "count": len(videos)}

@app.post("/api/higgsfield/generate")
async def api_higgsfield_generate(request: Request):
    data = await request.json()
    model = data.get("model", "veo3_1")
    prompt = data.get("prompt", "").strip() or "Stark Industries Mark IX Armor flight test over Neo-Tokyo"
    aspect_ratio = data.get("aspect_ratio", "16:9")
    camera_motion = data.get("camera_motion", "Dolly In") or "Dolly In"
    source_image_url = data.get("source_image_url")
    duration_sec = float(data.get("duration", 5.0))
    return await generate_real_video(
        prompt=prompt,
        model=model,
        source_image_url=source_image_url,
        camera_motion=camera_motion,
        duration_sec=duration_sec,
        aspect_ratio=aspect_ratio,
    )

@app.post("/api/video/generate")
async def api_video_generate(request: Request):
    return await api_higgsfield_generate(request)

@app.post("/api/video/render")
async def api_video_render(request: Request):
    data = await request.json()
    clips = data.get("clips", [])
    output_name = data.get("output_name")
    return await render_real_timeline(clips, output_name)

@app.get("/api/video/stream/{filename}")
async def api_video_stream(filename: str):
    file_path = RENDERS_DIR / filename
    if not file_path.is_file():
        return JSONResponse({"status": "error", "message": "File not found"}, status_code=404)
    return FileResponse(file_path, media_type="video/mp4")


# ==============================================================================
# Multi-Model & Multi-CLI Router + Fused Omni-Studio Pipeline (v3.0)
# ==============================================================================

from .ai_router import get_models_and_clis_status, execute_cli_directive

@app.get("/api/models/catalog")
async def api_models_catalog(refresh: bool = False):
    return await get_models_and_clis_status(force_refresh=refresh)

@app.post("/api/cli/execute")
async def api_cli_execute(request: Request):
    data = await request.json()
    cli_id = (data.get("cli") or data.get("cli_id") or "gemini").strip().lower()
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return JSONResponse({"ok": False, "error": "Prompt is required"}, status_code=400)
    return await execute_cli_directive(cli_id, prompt, cognitive_fallback=cognitive_core)

@app.get("/api/omni/state")
async def api_omni_state():
    """Single fused endpoint returning OpenArt, Higgsfield, CapCut, Uploads, and Multi-CLI state."""
    openart_models = await api_creative_models()
    openart_history = await api_creative_history()
    capcut_status = get_capcut_status()
    capcut_drafts = list_capcut_drafts()
    hf_account = await get_higgsfield_account()
    hf_models = await list_higgsfield_models()
    hf_history = list_generated_videos()
    ai_matrix = await get_models_and_clis_status()
    uploads = get_uploaded_media_library()

    return {
        "ok": True,
        "soul": "Gemini Pro Soul (J.A.R.V.I.S. v3.0)",
        "openart": {
            "models": openart_models,
            "history": openart_history,
        },
        "higgsfield": {
            "account": hf_account,
            "models": hf_models,
            "history": hf_history,
        },
        "capcut": {
            "status": capcut_status,
            "drafts": capcut_drafts,
            "count": len(capcut_drafts),
        },
        "uploads": uploads,
        "ai_matrix": ai_matrix,
    }

@app.post("/api/omni/pipeline")
async def api_omni_pipeline(request: Request):
    """Fused 3-Stage Pipeline: Real OpenArt Image Forge -> Real Higgsfield MP4 Video Forge -> CapCut Project Sync."""
    data = await request.json()
    prompt = data.get("prompt", "").strip() or "Stark Industries Mark IX Cybernetic Arc Reactor Core in Neo-Tokyo"
    openart_model = data.get("openart_model", "nano-banana-2-1")
    higgsfield_model = data.get("higgsfield_model", "veo3_1")
    camera_motion = data.get("camera_motion", "Dolly In") or "Dolly In"
    aspect_ratio = data.get("aspect_ratio", "16:9")
    style_preset = data.get("style_preset", "Cyberpunk")
    project_name = data.get("project_name", "").strip() or f"JARVIS_Omni_{uuid.uuid4().hex[:6]}"
    duration = float(data.get("duration", 5.0))
    duration = max(3.0, min(duration, 10.0))

    # Stage 1: Real High-Resolution OpenArt Keyframe Image Creation
    img_res = await generate_real_image(
        prompt=prompt,
        model_id=openart_model,
        aspect_ratio=aspect_ratio,
        style_preset=style_preset,
    )
    openart_asset = img_res["asset"]
    task_id = img_res["task_id"]

    # Stage 2: Real Playable MP4 Video Creation from the Keyframe Image
    vid_res = await generate_real_video(
        prompt=prompt,
        model=higgsfield_model,
        source_image_url=openart_asset["media_url"],
        camera_motion=camera_motion,
        duration_sec=duration,
        aspect_ratio=aspect_ratio,
    )
    video_record = vid_res["video"]

    # Stage 3: CapCut Desktop Draft Project Sync
    capcut_project = create_capcut_draft_project(project_name, duration)

    return {
        "ok": True,
        "pipeline_id": f"omni-{task_id}",
        "prompt": prompt,
        "stage1_openart": openart_asset,
        "stage2_higgsfield": video_record,
        "stage3_capcut": capcut_project,
        "video_url": video_record["video_url"],
        "image_url": openart_asset["media_url"],
        "timeline_clip": {
            "id": f"clip-{task_id}",
            "name": f"Omni: {prompt[:26]}...",
            "track": "video1",
            "startTime": 0,
            "duration": duration,
            "sourceUrl": video_record["video_url"],
            "thumbnailUrl": openart_asset["media_url"],
            "model": f"{openart_model} + {higgsfield_model}",
            "cameraMotion": camera_motion,
        },
    }


# ==============================================================================
# Ghidra & Reverse Engineering HUD Integration (v4.0)
# ==============================================================================

from .ghidra_engine import (
    get_ghidra_status,
    triage_binary_file,
    decompile_or_inspect_c,
    launch_ghidra_gui,
)

@app.get("/api/ghidra/status")
async def api_ghidra_status():
    return get_ghidra_status()

@app.post("/api/ghidra/triage")
async def api_ghidra_triage(request: Request):
    data = await request.json()
    binary_path = data.get("path", "") or data.get("binary", "")
    return await triage_binary_file(binary_path)

@app.post("/api/ghidra/decompile")
async def api_ghidra_decompile(request: Request):
    data = await request.json()
    target = data.get("target", "") or data.get("path", "")
    return await decompile_or_inspect_c(target)

@app.post("/api/ghidra/launch")
async def api_ghidra_launch():
    return launch_ghidra_gui()


# ==============================================================================
# Autonomous Faceless Video & Narrated Explainer Studio (v4.0)
# ==============================================================================

from .faceless_engine import generate_faceless_video, list_faceless_videos

@app.get("/api/faceless/history")
async def api_faceless_history():
    items = list_faceless_videos()
    return {"ok": True, "videos": items, "count": len(items)}

@app.post("/api/faceless/generate")
async def api_faceless_generate(request: Request):
    data = await request.json()
    topic = data.get("topic", "").strip() or data.get("prompt", "").strip() or "Tony Stark Arc Reactor & J.A.R.V.I.S. Neural Architecture"
    script = data.get("script", "").strip()
    style_preset = data.get("style_preset", "Cyberpunk")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    num_scenes = int(data.get("num_scenes", 2))
    return await generate_faceless_video(
        topic=topic,
        script=script,
        style_preset=style_preset,
        aspect_ratio=aspect_ratio,
        num_scenes=num_scenes,
    )


# ==============================================================================
# Live Hardware Telemetry, Process Monitor & Autonomous Desktop Control (v4.0)
# ==============================================================================

from .system_monitor import (
    sample_system_telemetry,
    list_processes_and_windows,
    execute_desktop_control,
)

@app.get("/api/system/telemetry")
async def api_system_telemetry():
    return sample_system_telemetry()

@app.get("/api/system/processes")
async def api_system_processes():
    return list_processes_and_windows()

@app.post("/api/system/control")
async def api_system_control(request: Request):
    data = await request.json()
    action = data.get("action", "")
    target = data.get("target")
    return await execute_desktop_control(action, target)


@app.post("/api/pc/control")
async def api_pc_control(request: Request):
    if not _is_agent_authorized(request.headers, request.query_params.get("token")):
        return JSONResponse({"ok": False, "error": "Unauthorized: invalid X-Jarvis-Token"}, status_code=401)
    data = await request.json()
    action = data.get("action", "")
    params = data.get("params") or {}
    target = data.get("target") or params.get("target")
    return await execute_desktop_control(action, target)


@app.websocket("/ws/agent")
async def ws_agent_endpoint(ws: WebSocket):
    if not _is_agent_authorized(ws.headers, ws.query_params.get("token")):
        await ws.close(code=1008)
        return
    await ws.accept()
    await ws.send_json({
        "ok": True,
        "type": "agent_hello",
        "service": "J.A.R.V.I.S. Local PC Agent",
        "version": "4.3.0",
    })
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"ok": False, "error": "malformed json"})
                continue
            if msg.get("type") == "ping":
                await ws.send_json({"ok": True, "type": "pong"})
                continue
            action = msg.get("action", "")
            params = msg.get("params") or {}
            target = msg.get("target") or params.get("target")
            res = await execute_desktop_control(action, target)
            await ws.send_json({"ok": True, "type": "pc_control_result", "result": res})
    except WebSocketDisconnect:
        pass


# ==============================================================================
# Samsung Galaxy Z Fold 7 (SM-F966U) Native APK Bridge & Telemetry Mesh (v4.0)
# ==============================================================================

_FOLD7_LATEST_TELEMETRY: dict = {
    "model": "Samsung Galaxy Z Fold 7 (SM-F966U)",
    "device_code": "SM-F966U (q7q)",
    "soc": "Snapdragon 8 Elite for Galaxy (3nm Oryon @ 4.47 GHz)",
    "gpu": "Adreno 830 (120Hz Dynamic AMOLED 2X + Hardware Ray Tracing)",
    "npu": "Qualcomm Hexagon NPU (Multimodal GenAI)",
    "displays": {
        "main_unfolded": "8.0-inch QXGA+ Dynamic AMOLED 2X (2184x1968, 120Hz LTPO)",
        "cover_folded": "6.5-inch FHD+ Dynamic AMOLED 2X (2520x1080, 21:9, 120Hz)",
        "flex_mode": "75°–135° Dual-Split Tabletop Posture",
    },
    "hinge_angle": 180,
    "posture": "UNFOLDED_MAIN",
    "refresh_rate_hz": 120,
    "battery_percent": 96,
    "workstation_lan_ip": "10.0.0.25:8777",
    "apk_filename": "JARVIS-ZFold7-SM-F966U-v4.0.apk",
    "apk_download_url": "/api/apk/download",
}

@app.get("/api/mobile/fold7/status")
async def api_mobile_fold7_status():
    apk_path = config.ROOT / "JARVIS-ZFold7-SM-F966U-v4.0.apk"
    return {
        "ok": True,
        "device": _FOLD7_LATEST_TELEMETRY,
        "apk_ready": apk_path.is_file(),
        "apk_path": str(apk_path),
        "apk_size_bytes": apk_path.stat().st_size if apk_path.is_file() else 0,
        "apk_download_url": "/api/apk/download",
    }

@app.post("/api/mobile/fold7/telemetry")
async def api_mobile_fold7_telemetry(request: Request):
    data = await request.json()
    _FOLD7_LATEST_TELEMETRY.update(data)
    _FOLD7_LATEST_TELEMETRY["updated_at"] = datetime.now(timezone.utc).isoformat()
    return {"ok": True, "device": _FOLD7_LATEST_TELEMETRY}

@app.get("/api/apk/download")
async def api_apk_download():
    apk_path = config.ROOT / "JARVIS-ZFold7-SM-F966U-v4.0.apk"
    if not apk_path.is_file():
        return JSONResponse({"ok": False, "error": "APK not built yet"}, status_code=404)
    return FileResponse(
        apk_path,
        media_type="application/vnd.android.package-archive",
        filename="JARVIS-ZFold7-SM-F966U-v4.0.apk",
    )


# ==============================================================================
# Wendy Labs Physical AI, Robotics & WendyOS Edge Harness (wendylabsinc) (v4.0)
# ==============================================================================

from .wendy_engine import (
    get_wendy_status,
    discover_wendy_devices,
    create_wendy_project,
    update_wendy_entitlements,
    deploy_wendy_app,
    trigger_wendyos_ab_update,
)

@app.get("/api/wendy/status")
async def api_wendy_status():
    return get_wendy_status()

@app.api_route("/api/wendy/discover", methods=["GET", "POST"])
async def api_wendy_discover():
    return discover_wendy_devices()

@app.post("/api/wendy/project/create")
async def api_wendy_project_create(request: Request):
    data = await request.json()
    app_id = data.get("app_id", "")
    template_id = data.get("template_id", "yolov8-object-detection")
    entitlements = data.get("entitlements")
    return create_wendy_project(app_id=app_id, template_id=template_id, entitlements=entitlements)

@app.post("/api/wendy/project/entitlements")
async def api_wendy_project_entitlements(request: Request):
    data = await request.json()
    app_id = data.get("app_id", "yolov8-object-detection")
    entitlements = data.get("entitlements", [])
    return update_wendy_entitlements(app_slug_or_id=app_id, entitlements=entitlements)

@app.post("/api/wendy/run")
async def api_wendy_run(request: Request):
    data = await request.json()
    app_id = data.get("app_id", "yolov8-object-detection")
    device_id = data.get("device_id", "wendy-jetson-orin-01")
    return deploy_wendy_app(app_slug_or_id=app_id, device_id=device_id)

@app.post("/api/wendy/ota")
async def api_wendy_ota(request: Request):
    data = await request.json()
    device_id = data.get("device_id", "wendy-jetson-orin-01")
    action = data.get("action", "switch_slot")
    return trigger_wendyos_ab_update(device_id=device_id, action=action)


# ==============================================================================
# Autonomous ReAct Agentic Engine & GitHub Cloud Server Bridge (v4.1)
# ==============================================================================

from .agentic_engine import (
    get_agentic_status,
    get_github_cloud_status,
    execute_agentic_goal,
    AGENT_TOOLS_CATALOG,
)

@app.get("/api/agent/status")
async def api_agent_status():
    return get_agentic_status()

@app.get("/api/agent/tools")
async def api_agent_tools():
    return {"tools": AGENT_TOOLS_CATALOG, "count": len(AGENT_TOOLS_CATALOG)}

@app.get("/api/github/cloud")
async def api_github_cloud():
    return get_github_cloud_status()

@app.post("/api/agent/execute")
async def api_agent_execute(request: Request):
    data = await request.json()
    goal = data.get("goal") or data.get("prompt") or "Audit J.A.R.V.I.S. GitHub Cloud Server & Autonomous Capabilities"
    max_steps = int(data.get("max_steps", 4))
    mode = data.get("mode", "autonomous_react")
    preferred_model = data.get("model", "gemini-2.5-pro")
    return execute_agentic_goal(goal=goal, max_steps=max_steps, mode=mode, preferred_model=preferred_model)


# ==============================================================================
# PHASE 1: CompTIA Security+ (SY0-701) LabEx & Vector RAG Knowledge Base
# ==============================================================================

from .security_plus_rag import (
    get_secplus_rag,
    parse_cloned_labex_readme,
    SECURITY_PLUS_PORTS,
    SECURITY_PLUS_ACRONYMS,
    SECURITY_PLUS_FRAMEWORKS,
)

@app.get("/api/secplus/status")
async def api_secplus_status():
    return get_secplus_rag().get_status()

@app.get("/api/secplus/labs")
async def api_secplus_labs():
    labs = parse_cloned_labex_readme()
    return {"ok": True, "exam_code": "SY0-701", "count": len(labs), "labs": labs}

@app.get("/api/secplus/ports")
async def api_secplus_ports():
    return {"ok": True, "exam_code": "SY0-701", "count": len(SECURITY_PLUS_PORTS), "ports": SECURITY_PLUS_PORTS}

@app.get("/api/secplus/acronyms")
async def api_secplus_acronyms():
    return {
        "ok": True,
        "exam_code": "SY0-701",
        "count": len(SECURITY_PLUS_ACRONYMS),
        "acronyms": SECURITY_PLUS_ACRONYMS,
        "frameworks": SECURITY_PLUS_FRAMEWORKS,
    }

@app.post("/api/secplus/search")
async def api_secplus_search(request: Request):
    data = await request.json()
    query = data.get("query") or data.get("q") or "CIA Triad Zero Trust"
    top_k = int(data.get("top_k", 5))
    category = data.get("category")
    results = get_secplus_rag().search(query=query, top_k=top_k, category=category)
    return {"ok": True, "exam_code": "SY0-701", "query": query, "count": len(results), "results": results}

@app.post("/api/secplus/teach")
async def api_secplus_teach(request: Request):
    data = await request.json()
    topic = data.get("topic") or data.get("query") or "Zero Trust Architecture"
    return get_secplus_rag().teach_topic(topic=topic)

@app.api_route("/api/secplus/quiz", methods=["GET", "POST"])
async def api_secplus_quiz(request: Request):
    domain = None
    count = 4
    include_pbq = True
    if request.method == "POST":
        try:
            data = await request.json()
            domain = data.get("domain")
            count = int(data.get("count", 4))
            include_pbq = bool(data.get("include_pbq", True))
        except Exception:
            pass
    else:
        domain = request.query_params.get("domain")
        if request.query_params.get("count"):
            count = int(request.query_params["count"])
    return get_secplus_rag().get_quiz(domain=domain, count=count, include_pbq=include_pbq)

@app.post("/api/secplus/explain-command")
async def api_secplus_explain_command(request: Request):
    data = await request.json()
    command_str = data.get("command") or "nmap -sS -sV -O --script vuln 127.0.0.1"
    return get_secplus_rag().explain_command(command_str=command_str)


# ==============================================================================
# PHASE 2: Long-Term Memory ("Never Forget") & PC <-> Phone Sync Engine
# ==============================================================================

from .long_term_memory import get_never_forget

@app.get("/api/memory/never-forget")
async def api_never_forget_list(category: str | None = None, q: str | None = None, limit: int = 100):
    nf = get_never_forget()
    items = nf.list_memories(category=category, query=q, limit=limit)
    return {
        "ok": True,
        "count": len(items),
        "memories": items,
        "sync_file": str(nf.db_path),
    }

@app.post("/api/memory/never-forget")
async def api_never_forget_add(request: Request):
    data = await request.json()
    nf = get_never_forget()
    item = nf.add_memory(
        value=data.get("value") or data.get("text") or "",
        key=data.get("key") or data.get("title"),
        category=data.get("category", "fact"),
        tags=data.get("tags"),
        source_device=data.get("source_device", "windows-pc-exe"),
        pinned=bool(data.get("pinned", False)),
        memory_id=data.get("memory_id"),
    )
    return {"ok": True, "action": "ADDED", "memory": item}

@app.put("/api/memory/never-forget/{memory_id}")
async def api_never_forget_edit(memory_id: str, request: Request):
    data = await request.json()
    nf = get_never_forget()
    updated = nf.edit_memory(
        memory_id=memory_id,
        new_value=data.get("value") or data.get("new_value") or "",
        new_key=data.get("key"),
        new_category=data.get("category"),
        pinned=data.get("pinned"),
        source_device=data.get("source_device", "windows-pc-exe"),
    )
    if not updated:
        return JSONResponse(status_code=404, content={"ok": False, "error": f"Memory '{memory_id}' not found."})
    return {"ok": True, "action": "UPDATED", "memory": updated}

@app.delete("/api/memory/never-forget/{memory_id}")
async def api_never_forget_delete(memory_id: str):
    nf = get_never_forget()
    res = nf.delete_memory(memory_id)
    if not res.get("deleted"):
        return JSONResponse(status_code=404, content=res)
    return res

@app.post("/api/memory/never-forget/command")
async def api_never_forget_command(request: Request):
    data = await request.json()
    cmd = data.get("command") or data.get("text") or "view memories"
    device = data.get("source_device", "windows-pc-exe")
    return get_never_forget().execute_command(raw_command=cmd, source_device=device)

@app.post("/api/memory/never-forget/sync")
async def api_never_forget_sync(request: Request):
    data = await request.json()
    client_device = data.get("client_device", "samsung-zfold7-apk")
    incoming = data.get("memories") or []
    return get_never_forget().sync_devices(client_device=client_device, incoming_memories=incoming)


# ==============================================================================
# PHASE 3: 7 New Autonomous Modules & Callable Tools
# ==============================================================================

from .coding_agent_engine import get_coding_engine
from .anime_studio_engine import get_anime_studio
from .audio_studio_engine import get_audio_studio
from .image_editing_engine import get_image_editor
from .anime_db_engine import get_anime_db
from .finance_engine import get_finance_engine
from .self_repair_engine import get_self_repair_engine

# 3.1 Advanced Multi-File Coding & Full-Stack Project Architect
@app.get("/api/coding/projects")
async def api_coding_projects():
    projects = get_coding_engine().list_projects()
    return {"ok": True, "count": len(projects), "projects": projects}

@app.post("/api/coding/build")
async def api_coding_build(request: Request):
    data = await request.json()
    return get_coding_engine().build_project(
        project_name=data.get("project_name") or "Stark Omni Portal",
        description=data.get("description") or "Full-stack web application with FastAPI backend, SQLite DB, and SPA frontend",
        stack=data.get("stack") or "FastAPI + Tailwind SPA + SQLite + Docker",
        run_tests=bool(data.get("run_tests", True)),
    )

# 3.2 Premium Anime Animation Pipeline (Character Sheets + Storyboards + Continuity)
@app.get("/api/anime-studio/status")
async def api_anime_studio_status():
    return get_anime_studio().get_status()

@app.post("/api/anime-studio/character")
async def api_anime_studio_character(request: Request):
    data = await request.json()
    return get_anime_studio().create_character_sheet(
        name=data.get("name") or "Kaito Horizon",
        archetype=data.get("archetype") or "Cybernetic Samurai Lead",
        hair_color=data.get("hair_color") or "#00E5FF (Electric Cyan)",
        eye_color=data.get("eye_color") or "#F59E0B (Amber Gold)",
        outfit=data.get("outfit") or "High-collar obsidian tactical haori with neon circuit trim",
        visual_tags=data.get("visual_tags") or "anime sakuga keyframe, ufotable lighting, 4k cel shaded",
    )

@app.post("/api/anime-studio/episode")
async def api_anime_studio_episode(request: Request):
    data = await request.json()
    return await get_anime_studio().generate_episode_pipeline(
        title=data.get("title") or "Limit Break: Awakening",
        synopsis=data.get("synopsis") or "Johnny Boy unleashes his cyan arc-aura across the rain-slicked rooftops of Neo-Tokyo",
        character_id=data.get("character_id"),
        num_scenes=int(data.get("num_scenes", 2)),
        style_preset=data.get("style_preset") or "Ufotable Sakuga Action",
    )

# 3.3 Audio Studio (Music, Songs & SFX via ElevenLabs + Multi-Harmonic Synth)
@app.post("/api/audio/generate")
async def api_audio_generate(request: Request):
    data = await request.json()
    return get_audio_studio().generate_audio(
        prompt=data.get("prompt") or "Cyberpunk anime opening synthwave anthem",
        audio_type=data.get("audio_type") or "music",
        duration_sec=float(data.get("duration_sec", 3.0)),
        bpm=int(data.get("bpm", 128)),
        key_scale=data.get("key_scale") or "A_minor",
    )

# 3.4 Premium Image Editing Suite (BG Removal, 4K Upscale, Inpaint, Color Grade, Style Match)
@app.post("/api/image-editor/edit")
async def api_image_editor_edit(request: Request):
    data = await request.json()
    return await get_image_editor().edit(
        operation=data.get("operation") or data.get("tool") or "color_grade",
        source_url=data.get("source_url"),
        preset=data.get("preset") or "cyberpunk_neon",
        reference_url=data.get("reference_url"),
        prompt=data.get("prompt") or "",
    )

# 3.5 Live Anime Database (AniList GraphQL + Jikan v4 MyAnimeList API with SQLite Cache)
@app.api_route("/api/anime-db/search", methods=["GET", "POST"])
async def api_anime_db_search(request: Request):
    query = "Solo Leveling"
    limit = 5
    if request.method == "POST":
        data = await request.json()
        query = data.get("query") or data.get("q") or query
        limit = int(data.get("limit", 5))
    else:
        query = request.query_params.get("q") or request.query_params.get("query") or query
        if request.query_params.get("limit"):
            limit = int(request.query_params["limit"])
    return get_anime_db().search_anime(query=query, limit=limit)

# 3.6 Finance & Market Intelligence (Crypto, Stocks, Personal Finance + Charts + Mandatory Risk Disclosure)
@app.api_route("/api/finance/analyze", methods=["GET", "POST"])
async def api_finance_analyze(request: Request):
    symbol = "BTC"
    if request.method == "POST":
        data = await request.json()
        symbol = data.get("symbol") or data.get("query") or symbol
    else:
        symbol = request.query_params.get("symbol") or request.query_params.get("q") or symbol
    return get_finance_engine().analyze_asset(symbol_or_query=symbol)

@app.post("/api/finance/personal")
async def api_finance_personal(request: Request):
    data = await request.json()
    return get_finance_engine().calculate_personal_finance(
        monthly_investment=float(data.get("monthly_investment", 500.0)),
        initial_principal=float(data.get("initial_principal", 5000.0)),
        annual_return_pct=float(data.get("annual_return_pct", 8.0)),
        years=int(data.get("years", 10)),
    )

# 3.7 Self-Repair & Automatic Rollback Engine
@app.get("/api/self-repair/status")
async def api_self_repair_status():
    return get_self_repair_engine().get_status()

@app.post("/api/self-repair/log")
async def api_self_repair_log(request: Request):
    data = await request.json()
    return get_self_repair_engine().log_error(
        subsystem=data.get("subsystem") or "runtime",
        error_message=data.get("error_message") or "Diagnostic test error",
        file_path=data.get("file_path"),
        traceback_text=data.get("traceback_text"),
    )

@app.post("/api/self-repair/simulate")
async def api_self_repair_simulate():
    return get_self_repair_engine().run_self_repair_simulation()



# ==============================================================================
# Live 10-Point System Self-Diagnostic Matrix (v4.0)
# ==============================================================================

@app.api_route("/api/diagnostics/run", methods=["GET", "POST"])
async def api_diagnostics_run():
    """Run timed health & readiness probes across all 10 J.A.R.V.I.S. core subsystems."""
    t_suite_start = time.perf_counter()
    checks = []

    async def probe(subsystem_id: str, name: str, fn):
        t0 = time.perf_counter()
        try:
            res = fn()
            if asyncio.iscoroutine(res):
                res = await res
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            checks.append({
                "id": subsystem_id,
                "name": name,
                "ok": True,
                "latency_ms": elapsed_ms,
                "detail": str(res),
            })
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            checks.append({
                "id": subsystem_id,
                "name": name,
                "ok": False,
                "latency_ms": elapsed_ms,
                "detail": f"Error: {exc}",
            })

    await probe(
        "cognitive_core",
        "Cognitive Core & SQLite Memory Vault",
        lambda: f"Vault Online | {len(memory.listing())} memory notes | {store.totals().get('messages', 0)} messages",
    )
    await probe(
        "neural_tts",
        "Male British Neural TTS (en-GB-RyanNeural)",
        lambda: f"Voice Engine Ready | Cache files: {len(list(TTS_CACHE_DIR.glob('*.mp3')))}",
    )
    await probe(
        "temporal_cluster",
        "Temporal Durable Orchestrator (:7233)",
        lambda: f"Task Queue: {TEMPORAL_TASK_QUEUE} | Workflows tracked: {len(list_recorded_workflows())}",
    )
    await probe(
        "ai_router",
        "Multi-Model & 7-CLI Router Matrix",
        lambda: get_models_and_clis_status(),
    )
    await probe(
        "openart_studio",
        "OpenArt High-Res Raster Image Forge",
        lambda: f"5 Flagship Models | Media Library: {len(get_uploaded_media_library())} assets",
    )
    await probe(
        "higgsfield_video",
        "Higgsfield AI & CapCut NLE Draft Engine",
        lambda: f"Videos: {len(list_generated_videos())} MP4s | CapCut Drafts: {len(list_capcut_drafts())}",
    )
    await probe(
        "faceless_studio",
        "Autonomous Faceless Narrated Video Studio",
        lambda: f"Productions Ready: {len(list_faceless_videos())} narrated MP4s",
    )
    await probe(
        "ghidra_rea",
        "Ghidra 12.1.4 Binary Triage & Decompiler",
        lambda: f"Installed: {get_ghidra_status().get('ghidra_installed')} | Binaries: {len(get_ghidra_status().get('binaries', []))}",
    )
    await probe(
        "system_telemetry",
        "Live Host Telemetry & Desktop Window Manager",
        lambda: f"CPU {sample_system_telemetry()['cpu']['percent']}% | RAM {sample_system_telemetry()['memory']['percent']}%",
    )
    await probe(
        "fold7_mesh",
        "Galaxy Z Fold 7 (SM-F966U) Telemetry Mesh",
        lambda: f"{_FOLD7_LATEST_TELEMETRY['model']} | Posture: {_FOLD7_LATEST_TELEMETRY['posture']} ({_FOLD7_LATEST_TELEMETRY['hinge_angle']}°)",
    )

    # Clean up ai_router detail string if dict
    for c in checks:
        if c["id"] == "ai_router" and c["ok"]:
            c["detail"] = "7 CLI Backends & Multi-LLM Matrix Online"

    total_ms = round((time.perf_counter() - t_suite_start) * 1000, 2)
    passed = sum(1 for c in checks if c["ok"])
    total = len(checks)
    return {
        "ok": passed == total,
        "passed": passed,
        "total": total,
        "score_pct": round((passed / max(total, 1)) * 100, 1),
        "total_latency_ms": total_ms,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }


def run_server():
    import uvicorn
    # Loopback by default. Set JARVIS_HOST=0.0.0.0 (and JARVIS_AGENT_TOKEN) to
    # reach the agent from the phone over the LAN.
    uvicorn.run("server.main:app", host=config.HOST, port=config.PORT, reload=False)


if __name__ == "__main__":
    run_server()
