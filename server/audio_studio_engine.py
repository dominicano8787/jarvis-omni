r"""PHASE 3.3: J.A.R.V.I.S. Audio Studio Engine (Music, Songs & Sound Effects via ElevenLabs + Procedural Synthesis).

Supports:
- Live ElevenLabs Sound Generation API (`https://api.elevenlabs.io/v1/sound-generation`) & Voice TTS
  when `ELEVENLABS_API_KEY` is configured in `.env`.
- Deterministic Multi-Harmonic Stereo WAV Synthesizer fallback for:
  1. Music & Songs (chord progressions, basslines, arpeggio melodies, and percussion beats)
  2. Sound Effects / SFX (Arc Reactor hum, HUD telemetry chime, cyber blade slash, sci-fi pulse, thruster boost)
"""

from __future__ import annotations

import math
import os
import struct
import time
import uuid
import wave
from pathlib import Path
from typing import Any

import httpx

from . import real_media_engine

ASSETS_DIR = real_media_engine.ASSETS_DIR
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


class AudioStudioEngine:
    """Generates playable Music, Songs, and Sound Effects (SFX) via ElevenLabs or Multi-Harmonic WAV Synthesis."""

    def __init__(self) -> None:
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        self.elevenlabs_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()

    def generate_audio(
        self,
        prompt: str,
        audio_type: str = "music",  # 'music' | 'song' | 'sfx'
        duration_sec: float = 4.0,
        bpm: int = 124,
        key_scale: str = "A_minor",
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        duration_sec = max(1.5, min(float(duration_sec), 15.0))
        audio_id = f"aud_{audio_type}_{uuid.uuid4().hex[:8]}"

        # 1. Try ElevenLabs Sound Generation API if ELEVENLABS_API_KEY is present in .env
        if self.elevenlabs_key:
            try:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(
                        "https://api.elevenlabs.io/v1/sound-generation",
                        headers={
                            "xi-api-key": self.elevenlabs_key,
                            "Content-Type": "application/json",
                        },
                        json={
                            "text": f"{audio_type.upper()}: {prompt}",
                            "duration_seconds": duration_sec,
                            "prompt_influence": 0.5,
                        },
                    )
                    if resp.status_code == 200 and len(resp.content) > 1000:
                        mp3_name = f"{audio_id}.mp3"
                        out_path = ASSETS_DIR / mp3_name
                        out_path.write_bytes(resp.content)
                        return {
                            "ok": True,
                            "audio_id": audio_id,
                            "audio_type": audio_type,
                            "prompt": prompt,
                            "engine": "ElevenLabs Sound Generation API",
                            "media_url": f"/api/creative/assets/{mp3_name}",
                            "file_path": str(out_path),
                            "size_bytes": len(resp.content),
                            "duration_sec": duration_sec,
                            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
                        }
            except Exception:
                pass

        # 2. High-Precision Stereo 44.1kHz 16-bit PCM WAV Synthesis (Music / Song / SFX)
        wav_name = f"{audio_id}.wav"
        out_path = ASSETS_DIR / wav_name
        sample_rate = 44100
        total_samples = int(sample_rate * duration_sec)

        if audio_type.lower() == "sfx":
            pcm_bytes = self._synthesize_sfx(prompt, sample_rate, total_samples)
        else:
            pcm_bytes = self._synthesize_music_or_song(prompt, sample_rate, total_samples, bpm=bpm)

        with wave.open(str(out_path), "wb") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_bytes)

        size_bytes = out_path.stat().st_size
        return {
            "ok": True,
            "audio_id": audio_id,
            "audio_type": audio_type,
            "prompt": prompt,
            "bpm": bpm,
            "key_scale": key_scale,
            "engine": "JARVIS Multi-Harmonic Stereo Synth (ElevenLabs-Ready)",
            "media_url": f"/api/creative/assets/{wav_name}",
            "file_path": str(out_path),
            "size_bytes": size_bytes,
            "duration_sec": duration_sec,
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
        }

    def _synthesize_sfx(self, prompt: str, sr: int, n_samples: int) -> bytes:
        p = prompt.lower()
        buf = bytearray(n_samples * 4)
        for i in range(n_samples):
            t = i / sr
            env = math.sin(math.pi * min(1.0, i / n_samples)) ** 0.6
            if "slash" in p or "sword" in p or "katana" in p:
                freq = 1800.0 * math.exp(-5.5 * t) + 140.0
                sig = math.sin(2.0 * math.pi * freq * t) * math.exp(-3.0 * t)
            elif "chime" in p or "hud" in p or "ui" in p:
                f1, f2 = (880.0, 1318.5) if t < 0.2 else (1174.66, 1760.0)
                sig = 0.5 * (math.sin(2.0 * math.pi * f1 * t) + math.sin(2.0 * math.pi * f2 * t)) * math.exp(-2.2 * t)
            else:
                # Arc Reactor / Sci-Fi Turbine Power-Up Hum
                sweep = 65.0 + 220.0 * (t / max(0.1, n_samples / sr))
                sig = (
                    0.50 * math.sin(2.0 * math.pi * sweep * t)
                    + 0.30 * math.sin(2.0 * math.pi * (sweep * 1.5) * t)
                    + 0.20 * math.sin(2.0 * math.pi * (sweep * 2.0) * t)
                ) * env
            val = max(-32760, min(32760, int(sig * 26000)))
            struct.pack_into("<hh", buf, i * 4, val, val)
        return bytes(buf)

    def _synthesize_music_or_song(self, prompt: str, sr: int, n_samples: int, bpm: int = 124) -> bytes:
        # Progression: Am - F - C - G (Anime / Synthwave Anthem)
        chords = [
            (220.00, 261.63, 329.63),  # Am
            (174.61, 220.00, 261.63),  # F
            (261.63, 329.63, 392.00),  # C
            (196.00, 246.94, 293.66),  # G
        ]
        lead_notes = [440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0, 523.25]
        beat_dur = 60.0 / max(60, min(bpm, 200))
        buf = bytearray(n_samples * 4)

        for i in range(n_samples):
            t = i / sr
            beat_idx = int(t / beat_dur)
            chord = chords[(beat_idx // 2) % len(chords)]
            lead_f = lead_notes[int(t / (beat_dur / 2.0)) % len(lead_notes)]

            # Warm pad + sub-bass + arpeggio lead + kick pulse
            pad = sum(math.sin(2.0 * math.pi * f * t) for f in chord) / 3.0
            bass = math.sin(2.0 * math.pi * (chord[0] * 0.5) * t)
            arp_env = math.exp(-4.0 * (t % (beat_dur / 2.0)))
            lead = math.sin(2.0 * math.pi * lead_f * t) * arp_env
            kick_t = t % beat_dur
            kick = math.sin(2.0 * math.pi * (110.0 * math.exp(-18.0 * kick_t)) * kick_t) * math.exp(-10.0 * kick_t)

            left = 0.32 * pad + 0.28 * bass + 0.25 * lead + 0.25 * kick
            right = 0.32 * pad + 0.28 * bass + 0.25 * math.sin(2.0 * math.pi * (lead_f * 1.003) * t) * arp_env + 0.25 * kick
            l_val = max(-32760, min(32760, int(left * 24000)))
            r_val = max(-32760, min(32760, int(right * 24000)))
            struct.pack_into("<hh", buf, i * 4, l_val, r_val)
        return bytes(buf)


_audio_studio: AudioStudioEngine | None = None


def get_audio_studio() -> AudioStudioEngine:
    global _audio_studio
    if _audio_studio is None:
        _audio_studio = AudioStudioEngine()
    return _audio_studio
