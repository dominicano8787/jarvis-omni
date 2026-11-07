"""J.A.R.V.I.S. Autonomous Faceless Video & Narrated Explainer Pipeline.

End-to-End Automated Production:
Topic / Script -> Multi-Scene Storyboard -> Male British Neural Voiceover (en-GB-RyanNeural)
-> AI Keyframe Generation -> Burned-In Cybernetic Captions + Camera Motion
-> Concatenated Master MP4 + CapCut Desktop Draft Sync.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import os
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image, ImageDraw, ImageFont

from . import config
from .real_media_engine import (
    CREATIVE_DIR,
    FFMPEG_BIN,
    RENDERS_DIR,
    _get_dimensions,
    generate_real_image,
    synthesize_male_british_tts,
)
from .video_engine import create_capcut_draft_project

FACELESS_HISTORY_FILE = RENDERS_DIR / "faceless_history.json"


def _probe_audio_duration(audio_path: Path) -> float:
    """Returns exact audio duration in seconds using ffmpeg/ffprobe, or estimates from size."""
    ffprobe_bin = FFMPEG_BIN.replace("ffmpeg.exe", "ffprobe.exe") if "ffmpeg" in FFMPEG_BIN.lower() else "ffprobe"
    try:
        res = subprocess.run(
            [
                ffprobe_bin,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=10.0,
        )
        val = float(res.stdout.strip())
        if val > 1.0:
            return round(val, 2)
    except Exception:
        pass
    # Fallback estimate (~16 KB/sec for edge-tts mp3)
    if audio_path.is_file():
        return max(3.5, min(12.0, round(audio_path.stat().st_size / 6000.0, 2)))
    return 4.5


def _stamp_caption_on_image(
    src_img_path: Path,
    dest_img_path: Path,
    caption_text: str,
    scene_index: int,
    total_scenes: int,
    topic_title: str,
) -> None:
    """Renders a sleek lower-third subtitle & HUD telemetry overlay onto the scene keyframe."""
    im = Image.open(src_img_path).convert("RGBA")
    w, h = im.size

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Top-left subtle scene badge
    badge_w, badge_h = 290, 34
    draw.rectangle([28, 24, 28 + badge_w, 24 + badge_h], fill=(4, 12, 28, 210), outline=(0, 240, 255, 190), width=1)
    draw.text((40, 34), f"J.A.R.V.I.S. // SCENE 0{scene_index} OF 0{total_scenes}", fill=(0, 240, 255, 255))

    # Bottom lower-third caption box
    box_margin_x = max(40, int(w * 0.08))
    box_bottom = h - 34
    box_top = h - 128
    draw.rectangle(
        [box_margin_x, box_top, w - box_margin_x, box_bottom],
        fill=(3, 10, 24, 225),
        outline=(0, 240, 255, 210),
        width=2,
    )
    # Accent left bar
    draw.rectangle([box_margin_x, box_top, box_margin_x + 6, box_bottom], fill=(0, 240, 255, 255))

    # Wrap caption text cleanly into 1-2 lines
    words = (caption_text or "").strip().split()
    lines: List[str] = []
    cur: List[str] = []
    max_chars = 78 if w >= 1000 else 44
    for word in words:
        if len(" ".join(cur + [word])) <= max_chars:
            cur.append(word)
        else:
            lines.append(" ".join(cur))
            cur = [word]
    if cur:
        lines.append(" ".join(cur))
    lines = lines[:2]

    try:
        font_title = ImageFont.truetype("arialbd.ttf", 15)
        font_cap = ImageFont.truetype("arialbd.ttf", 22 if w >= 1000 else 18)
    except Exception:
        font_title = ImageFont.load_default()
        font_cap = ImageFont.load_default()

    draw.text(
        (box_margin_x + 22, box_top + 12),
        f"NARRATION // {topic_title[:48].upper()}",
        fill=(0, 240, 255, 235),
        font=font_title,
    )
    y_text = box_top + 36
    for ln in lines:
        draw.text((box_margin_x + 22, y_text), ln, fill=(245, 252, 255, 255), font=font_cap)
        y_text += 26

    combined = Image.alpha_composite(im, overlay).convert("RGB")
    combined.save(dest_img_path, "JPEG", quality=95)


def _render_narrated_scene_mp4_sync(
    captioned_img: Path,
    voice_audio: Optional[Path],
    out_mp4: Path,
    camera_motion: str,
    duration_sec: float,
    width: int,
    height: int,
) -> bool:
    """Renders a single scene MP4 combining camera motion + Male British Neural Voiceover."""
    fps = 30
    dur = max(3.0, min(14.0, float(duration_sec)))
    frames = max(60, int(dur * fps))
    mot = (camera_motion or "Dolly In").lower()

    if "out" in mot:
        zp = f"zoompan=z='if(eq(on,1),1.24,max(1.0,zoom-0.0018))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={width}x{height}:fps={fps}"
    elif "pan" in mot:
        zp = f"zoompan=z='1.14':x='(iw-iw/zoom)*(on/{frames})':y='ih/2-(ih/zoom/2)':d={frames}:s={width}x{height}:fps={fps}"
    else:
        zp = f"zoompan=z='min(zoom+0.0016,1.22)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={width}x{height}:fps={fps}"

    if voice_audio and voice_audio.is_file():
        cmd = [
            FFMPEG_BIN,
            "-y",
            "-loop",
            "1",
            "-i",
            str(captioned_img),
            "-i",
            str(voice_audio),
            "-vf",
            f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},{zp},format=yuv420p",
            "-t",
            str(dur),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "21",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-b:a",
            "160k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(out_mp4),
        ]
    else:
        audio_expr = "0.08*sin(2*PI*110*t)+0.05*sin(2*PI*220*t)"
        cmd = [
            FFMPEG_BIN,
            "-y",
            "-loop",
            "1",
            "-i",
            str(captioned_img),
            "-f",
            "lavfi",
            "-i",
            f"aevalsrc='{audio_expr}|{audio_expr}':s=44100:d={dur}",
            "-vf",
            f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},{zp},format=yuv420p",
            "-t",
            str(dur),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-shortest",
            "-movflags",
            "+faststart",
            str(out_mp4),
        ]

    res = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=60.0)
    return res.returncode == 0 and out_mp4.is_file() and out_mp4.stat().st_size > 1000


def _build_scenes_for_topic(topic: str, custom_script: str = "", num_scenes: int = 3, style: str = "Cyberpunk 4K") -> List[Dict[str, str]]:
    clean_topic = (topic or "Tony Stark Arc Reactor & Autonomous AI Architecture").strip()
    motions = ["Dolly In", "Pan Right", "Zoom Out", "Dolly In", "Pan Left"]

    if custom_script and len(custom_script.strip()) > 20:
        raw_parts = [p.strip() for p in re.split(r"\n+|(?<=[.!?])\s+", custom_script.strip()) if p.strip()]
        chunks: List[str] = []
        step = max(1, len(raw_parts) // max(1, num_scenes))
        for i in range(0, len(raw_parts), step):
            chunks.append(" ".join(raw_parts[i : i + step]))
        chunks = chunks[:num_scenes]
    else:
        chunks = [
            f"Good day, Sir. Today we examine {clean_topic}, engineered with high-density cybernetic precision.",
            f"Inside the core architecture of {clean_topic}, real-time telemetry and autonomous neural engines operate in parallel.",
            f"With full durable orchestration and holographic visualization, {clean_topic} achieves peak operational mastery.",
        ][: max(2, min(5, num_scenes))]

    scenes: List[Dict[str, str]] = []
    visual_angles = [
        "wide cinematic establishing shot, glowing holographic blueprints, volumetric lighting",
        "macro close-up of intricate cybernetic core circuitry and glowing energy conduits",
        "futuristic command center HUD overview, high-contrast neon aesthetics, 8k detail",
        "orbital camera perspective with dramatic rim lighting and particle telemetry",
    ]
    for idx, narration in enumerate(chunks):
        scenes.append(
            {
                "scene_number": idx + 1,
                "narration": narration,
                "caption": narration,
                "visual_prompt": f"{clean_topic}, {visual_angles[idx % len(visual_angles)]}, {style}",
                "camera_motion": motions[idx % len(motions)],
            }
        )
    return scenes


async def generate_faceless_video(
    topic: str,
    script: str = "",
    style_preset: str = "Cyberpunk",
    aspect_ratio: str = "16:9",
    num_scenes: int = 2,
    voice: str = "en-GB-RyanNeural",
) -> Dict[str, Any]:
    """Executes the complete multi-scene Faceless Video Pipeline and produces a narrated MP4."""
    clean_topic = (topic or "Autonomous J.A.R.V.I.S. Cybernetic Architecture").strip()
    num_scenes = max(1, min(4, int(num_scenes or 2)))
    w, h = _get_dimensions(aspect_ratio)
    prod_id = uuid.uuid4().hex[:8]
    ts = int(time.time())

    scenes_spec = _build_scenes_for_topic(clean_topic, script, num_scenes, style_preset)
    scene_outputs: List[Dict[str, Any]] = []
    segment_mp4s: List[Path] = []
    total_duration = 0.0

    for spec in scenes_spec:
        s_num = spec["scene_number"]
        narration = spec["narration"]
        vis_prompt = spec["visual_prompt"]
        cam_motion = spec["camera_motion"]

        # 1. Synthesize British Male Neural Voiceover
        voice_path = await synthesize_male_british_tts(narration, voice=voice)
        dur = await asyncio.to_thread(_probe_audio_duration, voice_path) if voice_path else 4.5
        dur = max(3.5, min(10.0, dur + 0.4))

        # 2. Generate Scene Keyframe Image
        img_res = await generate_real_image(
            prompt=vis_prompt,
            model_id="flux-3-image",
            aspect_ratio=aspect_ratio,
            style_preset=style_preset,
        )
        raw_img_path = Path(img_res["asset"]["local_path"])

        # 3. Burn Cybernetic Lower-Third Captions onto Frame
        captioned_name = f"faceless_cap_{prod_id}_s{s_num}.jpg"
        captioned_path = CREATIVE_DIR / captioned_name
        await asyncio.to_thread(
            _stamp_caption_on_image,
            raw_img_path,
            captioned_path,
            narration,
            s_num,
            len(scenes_spec),
            clean_topic,
        )

        # 4. Render Scene MP4 with Camera Motion + Voiceover Audio
        seg_mp4 = RENDERS_DIR / f"_faceless_seg_{prod_id}_{s_num}.mp4"
        await asyncio.to_thread(
            _render_narrated_scene_mp4_sync,
            captioned_path,
            voice_path,
            seg_mp4,
            cam_motion,
            dur,
            w,
            h,
        )
        if seg_mp4.is_file():
            segment_mp4s.append(seg_mp4)
            total_duration += dur

        scene_outputs.append(
            {
                "scene_number": s_num,
                "narration": narration,
                "visual_prompt": vis_prompt,
                "camera_motion": cam_motion,
                "duration_sec": round(dur, 2),
                "image_url": f"/api/creative/assets/{captioned_name}",
                "audio_url": f"/api/tts/cache/{voice_path.name}" if voice_path else None,
            }
        )

    # 5. Concatenate all narrated scenes into the Master Faceless MP4
    master_filename = f"faceless_{prod_id}.mp4"
    master_mp4 = RENDERS_DIR / master_filename

    if len(segment_mp4s) == 1:
        shutil.move(str(segment_mp4s[0]), str(master_mp4))
    elif len(segment_mp4s) > 1:
        concat_txt = RENDERS_DIR / f"_concat_fl_{prod_id}.txt"
        concat_txt.write_text("\n".join(f"file '{p.name}'" for p in segment_mp4s), encoding="utf-8")
        cmd = [
            FFMPEG_BIN,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_txt),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(master_mp4),
        ]
        await asyncio.to_thread(
            subprocess.run,
            cmd,
            cwd=str(RENDERS_DIR),
            stdin=subprocess.DEVNULL,
            capture_output=True,
        )
        concat_txt.unlink(missing_ok=True)
        for seg in segment_mp4s:
            seg.unlink(missing_ok=True)

    # 6. Sync CapCut Desktop Draft Project
    safe_proj = re.sub(r"[^\w\-]", "_", f"Faceless_{clean_topic[:20]}_{prod_id}")
    capcut_draft = create_capcut_draft_project(safe_proj, round(total_duration, 1))

    video_url = f"/api/video/stream/{master_filename}"
    thumb_url = scene_outputs[0]["image_url"] if scene_outputs else ""
    size_bytes = master_mp4.stat().st_size if master_mp4.is_file() else 0

    record = {
        "id": prod_id,
        "job_id": f"faceless-{prod_id}",
        "topic": clean_topic,
        "style_preset": style_preset,
        "aspect_ratio": aspect_ratio,
        "voice": voice,
        "scenes_count": len(scene_outputs),
        "scenes": scene_outputs,
        "duration_sec": round(total_duration, 2),
        "video_url": video_url,
        "result_url": video_url,
        "thumbnail_url": thumb_url,
        "filename": master_filename,
        "size_bytes": size_bytes,
        "capcut_draft": capcut_draft,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    # Record in faceless_history.json and video_history.json
    fl_hist = list_faceless_videos()
    fl_hist.insert(0, record)
    FACELESS_HISTORY_FILE.write_text(json.dumps(fl_hist[:40], indent=2), encoding="utf-8")

    vid_hist_file = RENDERS_DIR / "video_history.json"
    v_hist: List[Dict[str, Any]] = []
    if vid_hist_file.is_file():
        try:
            v_hist = json.loads(vid_hist_file.read_text(encoding="utf-8"))
        except Exception:
            v_hist = []
    v_hist.insert(
        0,
        {
            "id": prod_id,
            "job_id": f"faceless-{prod_id}",
            "job_type": "faceless-narrated",
            "model": "Faceless Studio (Ryan TTS + Flux + FFmpeg)",
            "display_name": f"FACELESS: {clean_topic[:32]}",
            "prompt": clean_topic,
            "camera_motion": "Multi-Scene Narrated",
            "aspect_ratio": aspect_ratio,
            "duration_sec": round(total_duration, 2),
            "status": "completed",
            "result_url": video_url,
            "video_url": video_url,
            "thumbnail_url": thumb_url,
            "media_type": "video",
            "size_bytes": size_bytes,
            "created_at": record["created_at"],
        },
    )
    vid_hist_file.write_text(json.dumps(v_hist[:60], indent=2), encoding="utf-8")

    return {
        "ok": master_mp4.is_file(),
        "production": record,
        "video_url": video_url,
        "thumbnail_url": thumb_url,
        "scenes": scene_outputs,
        "capcut_draft": capcut_draft,
    }


def list_faceless_videos() -> List[Dict[str, Any]]:
    if FACELESS_HISTORY_FILE.is_file():
        try:
            return json.loads(FACELESS_HISTORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []
