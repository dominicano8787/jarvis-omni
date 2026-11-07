# J.A.R.V.I.S. v2.0 (Windows Architecture)
### Just A Rather Very Intelligent System
Autonomous Private Cognition Engine, 3D Arc Reactor Holographic HUD, Temporal Durable Orchestration, CapCut Desktop Draft Engine & Higgsfield AI Generative Studio.

```powershell
D:\Jarvis> .\Launch-JARVIS.bat    # Master Windows Orchestrator
```

---

## 🌟 What's New in v2.0

### 1. 🎬 CapCut Video Editor & Native Desktop Draft Engine
* **Deconstructed Architecture**: Full reverse-engineered support for CapCut's native timeline draft format (`draft_content.json` and `draft_meta_info.json`).
* **Direct Desktop Sync**: Seamless bidirectional synchronization with the official CapCut desktop installation at:
  `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft`
* **Multi-Track NLE HUD**: Interactive timeline interface with Video, Audio, Voiceover, and Captions tracks.
* **Microsecond-Precision Controls**: Scrubber playhead with timecode display (`HH:MM:SS:FF`), clip split (`Ctrl+B`), trim, delete, speed curve, and host FFmpeg concat rendering.

### 2. 🌌 Higgsfield AI Generative Studio
* **Unified Video & 3D Generation**: Directly integrated with `@higgsfield/cli` across 111 state-of-the-art models:
  * Google Veo 3.1, Kling 4.0, Wan 3.0 Video, Seedance 2.5, MiniMax H3, Grok Video
  * Nano Banana Pro, FLUX 3 Image, Hunyuan 3D v3.1, SAM 3D Body
* **Camera Dynamics**: Pan (left/right), Tilt (up/down), Zoom (in/out), Dolly, Roll, and Orbit cinematic motions.
* **Timeline Export**: One-click "Add to Timeline" pushes generated AI clips directly into the CapCut editor.

### 3. ⚙️ Temporal Durable Orchestrator
* **Fault-Tolerant Engine**: Long-running research sweeps, multi-stage video renders, and complex agent workflows run as durable Temporal workflows.
* **Zero Lost Work**: Workflows resume automatically after machine restarts, network drops, or API rate limits.
* **Temporal Web UI**: Visual workflow inspectability and execution trace graphs at `http://localhost:8233`.

### 4. 🔮 3D Arc Reactor Holographic HUD
* **Three.js Cybernetic Interface**: Real-time rotating Arc Reactor core with kinetic particle rings and telemetry HUD.
* **Second Brain Architecture**: Live SQLite conversation vault, markdown note manager, task board, and active session synchronizer.
* **Bi-Directional Voice & Audio**: Real-time speech recognition, audio transcription pipeline, and vocal synthesis.

---

## 🖥️ System Architecture & Ports

| Subsystem | Port / Protocol | Description |
| :--- | :--- | :--- |
| **3D Holographic HUD** | `http://localhost:5173/` | React 18, Three.js, Lucide, Vite UI |
| **Cognitive Core Backend** | `http://127.0.0.1:8777/` | FastAPI, WebSockets, SSE telemetry streaming |
| **Swagger Interactive API** | `http://127.0.0.1:8777/docs` | Live REST OpenAPI documentation |
| **Temporal gRPC Service** | `127.0.0.1:7233` | Temporal Server cluster frontend |
| **Temporal Admin Web UI** | `http://localhost:8233/` | Workflow visual monitoring dashboard |

---

## 📁 Repository Layout

```
D:\Jarvis\
  server\
    main.py             FastAPI backend, WebSockets & REST endpoints
    video_engine.py     CapCut draft manager, Higgsfield bridge & FFmpeg concat
    temporal_engine.py  Temporal workflow & activity definitions
    worker.py           Temporal task queue worker daemon
    cognitive_core.py   Multi-model agentic loop (Claude + Gemini)
    brain.py            Streaming reasoning engine & thinking blocks
    research.py         Multi-angle autonomous research sweep
    memory.py           SQLite conversation ledger & durable memory
    tools.py            Host triage, filesystem, shell, and Ghidra bridge
    config.py           Central pathing, API keys, and environment limits
  ui\
    src\
      App.tsx                   Main Holographic HUD interface
      components\
        Core3D.tsx              Three.js Arc Reactor 3D simulation
        VideoStudio.tsx         CapCut & Higgsfield Video Studio modal
        CreativeStudio.tsx      OpenArt generative image suite
        CommandInput.tsx        Multimodal text & voice command dock
        GlassPanel.tsx          Frosted cybernetic HUD container
      utils\
        speech.ts               Web Speech API synthesizer & audio capture
        sound.ts                Synthesized audio telemetry & sound effects
  data\
    jarvis.db           SQLite database
    memories\           Durable agent notes
    research\           Synthesized deep research dossiers
    renders\            FFmpeg exported MP4 timelines
  Launch-JARVIS.bat     One-click Windows master orchestrator
  Setup-JARVIS.ps1      Comprehensive Windows environment setup & installer
  run.ps1               Python FastAPI backend launcher
  pyproject.toml        Python package specification (v2.0.0)
  requirements.txt      Python dependencies
  verify_all.py         Comprehensive end-to-end self-test suite
```

---

## 🚀 Quick Start (Windows)

### Initial Setup
Run PowerShell as Administrator or regular user:
```powershell
.\Setup-JARVIS.ps1
```
This script audits your Python, Node.js, FFmpeg, Temporal, and Higgsfield installations, configures the `.venv`, builds the UI production assets, and creates a **`JARVIS HUD.lnk`** shortcut on your Desktop.

### Launching All Subsystems
Double-click the desktop shortcut or run:
```cmd
Launch-JARVIS.bat
```
This script automatically checks ports, starts the Temporal cluster, starts the Cognitive Core backend, starts the 3D Holographic HUD, and opens `http://localhost:5173/` in your browser.

---

## 🧪 Verification & Self-Test

To run the complete diagnostic and verification suite:
```powershell
D:\Jarvis\.venv\Scripts\python.exe verify_all.py
```
Validates:
1. Temporal Durable Engine status
2. OpenArt Creative Studio endpoints
3. CapCut Desktop Draft read/write synchronization
4. Higgsfield AI model catalog and account authentication
5. Cognitive Core math, shell, file read, hardware diagnostics
6. Audio speech-to-text pipeline
