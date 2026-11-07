"""J.A.R.V.I.S. Video Engine & Multi-Track Studio Core.

Provides high-level integration between:
1. CapCut Desktop Drafts Engine (`com.lveditor.draft` JSON schemas)
2. Higgsfield AI Generative Studio (`@higgsfield/cli`)
3. Host FFmpeg Render & Streaming Pipeline
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import os
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import config

logger = logging.getLogger("jarvis.video")

# Paths
CAPCUT_APP_DIR = Path(os.environ.get("LOCALAPPDATA", "C:\\Users\\plata\\AppData\\Local")) / "CapCut"
CAPCUT_DRAFTS_DIR = CAPCUT_APP_DIR / "User Data" / "Projects" / "com.lveditor.draft"
RENDERS_DIR = config.DATA_DIR / "renders"
RENDERS_DIR.mkdir(parents=True, exist_ok=True)
FFMPEG_BIN = shutil.which("ffmpeg") or "D:/Apps/ffmpeg/bin/ffmpeg.exe"


# ==============================================================================
# 1. CapCut Desktop Drafts Integration
# ==============================================================================

def get_capcut_status() -> Dict[str, Any]:
    installed = CAPCUT_APP_DIR.is_dir()
    drafts_exist = CAPCUT_DRAFTS_DIR.is_dir()
    count = 0
    if drafts_exist:
        count = len([d for d in CAPCUT_DRAFTS_DIR.iterdir() if d.is_dir() and not d.name.startswith(".")])
    return {
        "ok": True,
        "installed": installed,
        "app_dir": str(CAPCUT_APP_DIR),
        "drafts_dir": str(CAPCUT_DRAFTS_DIR),
        "drafts_exist": drafts_exist,
        "draft_count": count,
    }


def list_capcut_drafts() -> List[Dict[str, Any]]:
    if not CAPCUT_DRAFTS_DIR.is_dir():
        return []

    drafts = []
    for d in CAPCUT_DRAFTS_DIR.iterdir():
        if not d.is_dir() or d.name.startswith("."):
            continue

        meta_file = d / "draft_meta_info.json"
        content_file = d / "draft_content.json"

        name = d.name
        draft_name = d.name
        duration_us = 0
        updated_time = 0
        fps = 30.0
        width = 1920
        height = 1080
        video_count = 0
        audio_count = 0

        if meta_file.is_file():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8", errors="replace"))
                draft_name = meta.get("draft_name") or draft_name
                duration_us = meta.get("duration_us") or meta.get("duration") or 0
                updated_time = meta.get("tm_duration") or meta.get("draft_root_path_modified_time") or 0
            except Exception:
                pass

        if content_file.is_file():
            try:
                content = json.loads(content_file.read_text(encoding="utf-8", errors="replace"))
                fps = content.get("fps", 30.0)
                canvas = content.get("canvas_config", {})
                width = canvas.get("width", 1920)
                height = canvas.get("height", 1080)
                if not duration_us:
                    duration_us = content.get("duration", 0)

                tracks = content.get("tracks", [])
                for t in tracks:
                    if t.get("type") == "video":
                        video_count += len(t.get("segments", []))
                    elif t.get("type") == "audio":
                        audio_count += len(t.get("segments", []))
            except Exception:
                pass

        # Look for cover image
        cover_path = None
        for img in d.glob("*.png"):
            cover_path = str(img)
            break

        drafts.append({
            "name": name,
            "draft_name": draft_name,
            "path": str(d),
            "duration_sec": round(duration_us / 1_000_000, 2),
            "duration_us": duration_us,
            "fps": fps,
            "width": width,
            "height": height,
            "video_count": video_count,
            "audio_count": audio_count,
            "has_content": content_file.is_file(),
            "cover_path": cover_path,
        })

    # Sort newest first
    drafts.sort(key=lambda x: x.get("duration_sec", 0), reverse=True)
    return drafts


def get_capcut_draft_detail(name: str) -> Dict[str, Any]:
    draft_dir = CAPCUT_DRAFTS_DIR / name
    if not draft_dir.is_dir():
        return {"ok": False, "error": f"Draft '{name}' not found on host."}

    content_file = draft_dir / "draft_content.json"
    meta_file = draft_dir / "draft_meta_info.json"

    content = {}
    meta = {}
    if content_file.is_file():
        try:
            content = json.loads(content_file.read_text(encoding="utf-8", errors="replace"))
        except Exception as e:
            content = {"error": str(e)}

    if meta_file.is_file():
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass

    # Extract clean timeline tracks for web editor
    timeline_tracks = []
    tracks = content.get("tracks", [])
    materials_videos = {v.get("id"): v for v in content.get("materials", {}).get("videos", [])}
    materials_audios = {a.get("id"): a for a in content.get("materials", {}).get("audios", [])}

    for idx, tr in enumerate(tracks):
        tr_type = tr.get("type", "video")
        clean_segments = []
        for seg in tr.get("segments", []):
            mat_id = seg.get("material_id")
            mat = materials_videos.get(mat_id) if tr_type == "video" else materials_audios.get(mat_id)

            target_tr = seg.get("target_timerange", {})
            start_sec = round(target_tr.get("start", 0) / 1_000_000, 3)
            duration_sec = round(target_tr.get("duration", 0) / 1_000_000, 3)

            clean_segments.append({
                "id": seg.get("id"),
                "material_id": mat_id,
                "name": mat.get("material_name") if mat else "Clip",
                "path": mat.get("path") if mat else "",
                "start": start_sec,
                "duration": duration_sec,
                "speed": seg.get("speed", 1.0),
                "volume": seg.get("volume", 1.0),
            })

        timeline_tracks.append({
            "id": tr.get("id", str(uuid.uuid4())),
            "type": tr_type,
            "name": f"{tr_type.capitalize()} Track {idx + 1}",
            "segments": clean_segments,
        })

    return {
        "ok": True,
        "name": name,
        "path": str(draft_dir),
        "fps": content.get("fps", 30.0),
        "duration_sec": round(content.get("duration", 0) / 1_000_000, 2),
        "canvas": content.get("canvas_config", {"ratio": "16:9", "width": 1920, "height": 1080}),
        "tracks": timeline_tracks,
        "raw_content": content,
        "meta": meta,
    }


def create_capcut_draft_project(name: str, duration_sec: float = 30.0) -> Dict[str, Any]:
    safe_name = re.sub(r"[^\w\-_() ]", "", name).strip() or f"Jarvis_Project_{int(time.time())}"
    draft_dir = CAPCUT_DRAFTS_DIR / safe_name
    draft_dir.mkdir(parents=True, exist_ok=True)

    proj_id = str(uuid.uuid4()).upper()
    duration_us = int(duration_sec * 1_000_000)

    draft_content = {
        "id": proj_id,
        "version": 360000,
        "new_version": "183.0.0",
        "name": safe_name,
        "duration": duration_us,
        "fps": 30.0,
        "canvas_config": {"ratio": "16:9", "width": 1920, "height": 1080, "background": None},
        "tracks": [
            {
                "id": str(uuid.uuid4()).upper(),
                "type": "video",
                "segments": [],
                "name": "Main Video Track",
                "is_default_name": True,
            },
            {
                "id": str(uuid.uuid4()).upper(),
                "type": "audio",
                "segments": [],
                "name": "Audio BGM Track",
                "is_default_name": True,
            }
        ],
        "materials": {
            "videos": [],
            "audios": [],
            "texts": [],
            "effects": [],
            "transitions": [],
            "canvases": [],
            "speeds": [],
        },
        "platform": {
            "os": "windows",
            "os_version": "10.0.26100",
            "app_id": 359289,
            "app_version": "9.3.0",
            "app_source": "cc",
        }
    }

    draft_meta = {
        "draft_id": proj_id,
        "draft_name": safe_name,
        "duration_us": duration_us,
        "tm_duration": int(time.time() * 1000),
        "draft_root_path": str(draft_dir),
    }

    (draft_dir / "draft_content.json").write_text(json.dumps(draft_content, indent=2), encoding="utf-8")
    (draft_dir / "draft_meta_info.json").write_text(json.dumps(draft_meta, indent=2), encoding="utf-8")

    return {
        "ok": True,
        "name": safe_name,
        "path": str(draft_dir),
        "message": f"CapCut project '{safe_name}' created. It is ready for editing in J.A.R.V.I.S. or CapCut desktop."
    }


# ==============================================================================
# 2. Higgsfield AI Generative Studio Integration
# ==============================================================================

def _exec_higgsfield_sync(args: List[str], timeout: float) -> Tuple[int, str, str]:
    res = subprocess.run(
        ["higgsfield"] + args,
        shell=(os.name == "nt"),
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="ignore",
    )
    return res.returncode, res.stdout, res.stderr


async def run_higgsfield_cmd(args: List[str], timeout: float = 30.0) -> Tuple[int, str, str]:
    return await asyncio.to_thread(_exec_higgsfield_sync, args, timeout)


async def get_higgsfield_account() -> Dict[str, Any]:
    try:
        rc, stdout, stderr = await run_higgsfield_cmd(["account", "status"])
        raw = stdout.strip()
        email_m = re.search(r"[\w\.-]+@[\w\.-]+", raw)
        plan_m = re.search(r"([a-zA-Z\s]+plan)", raw, re.IGNORECASE)
        cred_m = re.search(r"([\d\.]+)\s*credits?", raw, re.IGNORECASE)
        email = email_m.group(0) if email_m else "dominicano872007@gmail.com"
        plan = plan_m.group(0).strip() if plan_m else "free plan"
        credits = float(cred_m.group(1)) if cred_m else 0.0
        return {
            "ok": True,
            "authenticated": bool(email_m),
            "account": {
                "email": email,
                "plan": plan,
                "credits": credits,
                "raw": raw,
            }
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "authenticated": False}


async def list_higgsfield_models() -> List[Dict[str, Any]]:
    try:
        rc, stdout, stderr = await run_higgsfield_cmd(["model", "list", "--json"])
        models = json.loads(stdout)
        normalized = []
        for m in models:
            normalized.append({
                "id": m.get("job_type") or m.get("id"),
                "job_type": m.get("job_type") or m.get("id"),
                "name": m.get("display_name") or m.get("name") or m.get("job_type"),
                "display_name": m.get("display_name") or m.get("name") or m.get("job_type"),
                "type": m.get("type", "video"),
            })
        return normalized
    except Exception as e:
        logger.error(f"Failed to list Higgsfield models: {e}")
        return [
            {"id": "veo3_1", "job_type": "veo3_1", "name": "Google Veo 3.1", "display_name": "Google Veo 3.1", "type": "video"},
            {"id": "kling4_0", "job_type": "kling4_0", "name": "Kling 4.0", "display_name": "Kling 4.0", "type": "video"},
            {"id": "wan3_0", "job_type": "wan3_0", "name": "Wan 3.0 Video", "display_name": "Wan 3.0 Video", "type": "video"},
            {"id": "seedance_2_5", "job_type": "seedance_2_5", "name": "Seedance 2.5", "display_name": "Seedance 2.5", "type": "video"},
            {"id": "minimax_h3", "job_type": "minimax_h3", "name": "MiniMax H3", "display_name": "MiniMax H3", "type": "video"},
            {"id": "grok_video", "job_type": "grok_video", "name": "Grok Video", "display_name": "Grok Video", "type": "video"},
            {"id": "nano_banana_2", "job_type": "nano_banana_2", "name": "Nano Banana Pro", "display_name": "Nano Banana Pro", "type": "image"},
            {"id": "flux_3_image", "job_type": "flux_3_image", "name": "FLUX 3 Image", "display_name": "FLUX 3 Image", "type": "image"},
        ]


async def list_higgsfield_history() -> List[Dict[str, Any]]:
    try:
        rc, stdout, stderr = await run_higgsfield_cmd(["generate", "list", "--json"])
        jobs = json.loads(stdout)
        return jobs
    except Exception as e:
        logger.error(f"Failed to list Higgsfield history: {e}")
        return []


async def generate_higgsfield_job(
    model: str,
    prompt: str,
    aspect_ratio: str = "16:9",
    camera_motion: Optional[str] = None
) -> Dict[str, Any]:
    full_prompt = prompt.strip()
    if camera_motion and camera_motion.lower() != "static":
        full_prompt = f"{full_prompt}, camera {camera_motion}"

    try:
        args = ["generate", "create", model, "--prompt", full_prompt, "--json"]
        rc, stdout, stderr = await run_higgsfield_cmd(args, timeout=60.0)
        output = stdout.strip()
        try:
            res_json = json.loads(output)
            return {"ok": True, "job": res_json}
        except Exception:
            return {"ok": True, "raw": output}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ==============================================================================
# 3. Host FFmpeg Render & Concat Pipeline
# ==============================================================================

async def render_timeline_sequence(
    clips: List[Dict[str, Any]],
    output_name: Optional[str] = None
) -> Dict[str, Any]:
    if not clips:
        return {"ok": False, "error": "No clips provided in timeline sequence."}

    out_file = RENDERS_DIR / (output_name or f"jarvis_render_{int(time.time())}.mp4")

    # If single clip, copy/transcode directly
    if len(clips) == 1 and os.path.exists(clips[0].get("path", "")):
        src = clips[0]["path"]
        cmd = [FFMPEG_BIN, "-y", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(out_file)]
        await asyncio.to_thread(subprocess.run, cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "output_path": str(out_file), "filename": out_file.name}

    # Multi-clip concat script
    concat_list = RENDERS_DIR / f"concat_{int(time.time())}.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for c in clips:
            p = c.get("path", "")
            if os.path.exists(p):
                f.write(f"file '{p.replace('\\', '/')}'\n")

    cmd = [
        FFMPEG_BIN, "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        str(out_file)
    ]
    await asyncio.to_thread(subprocess.run, cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        concat_list.unlink(missing_ok=True)
    except Exception:
        pass

    return {
        "ok": out_file.is_file(),
        "output_path": str(out_file),
        "filename": out_file.name,
        "size_bytes": out_file.stat().st_size if out_file.is_file() else 0,
    }
