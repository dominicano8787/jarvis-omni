# J.A.R.V.I.S. v4.2 — Omni-Workstation, Autonomous Agent & GitHub Cloud Server
### Just A Rather Very Intelligent System
**Windows Native (`.exe`) • Samsung Galaxy Z Fold 7 (`SM-F966U` `.apk`) • 24/7 GitHub Cloud Server (`dominicano8787/jarvis-omni`)**

---

## 🌟 Complete Capability Matrix (v4.2)

### 1. 🛡️ CompTIA Security+ (`SY0-701`) & LabEx Vector RAG Knowledge Base (`server/security_plus_rag.py`)
- **Cloned LabEx Training Repository**: Ingests all 14 hands-on Linux security labs from `labex-labs/comptia-security-plus-training-labs` with full command breakdowns (`nmap`, `openssl`, `ufw`, `tcpdump`, `dd`, `docker`, `sha256sum`, `sysctl`, `lynis`, `fail2ban`).
- **Complete `SY0-701` Blueprint Coverage**: Covers all 5 official domains (1.0 General Security Concepts, 2.0 Threats/Vulnerabilities/Mitigations, 3.0 Security Architecture, 4.0 Security Operations, 5.0 Security Program Management & Oversight) and all 28 sub-objectives (`1.1`–`5.6`).
- **Vector RAG + Practice Quiz & PBQ Simulator**: Hybrid Cosine-Similarity + BM25 search (`data/security_plus/secplus_rag.db`), 100+ acronyms, 33+ ports/protocols, 8 cybersecurity frameworks, interactive multiple-choice & Performance-Based Questions (PBQs), and the **Explain-My-Command** CLI analyzer.

### 2. 🧠 "Never Forget" Persistent Long-Term Memory & PC ↔ Phone Sync (`server/long_term_memory.py`)
- **Durable Storage**: SQLite (`data/never_forget.db`) + JSON (`data/memory/NEVER_FORGET_SYNC.json`) + Markdown (`data/memory/NEVER_FORGET.md`) vault that persists preferences, active projects, and conversation facts across restarts.
- **Full CRUD Commands**: View, Add (`remember that...`), Edit (`edit memory <id>: <value>`), and Delete (`delete memory <id>`) via voice/chat or `/api/memory/never-forget`.
- **Bi-Directional Cross-Device Sync**: Conflict-free versioned synchronization between Windows PC (`JARVIS.exe`) and Samsung Galaxy Z Fold 7 (`SM-F966U` `.apk` / GitHub Cloud).

### 3. 🛠️ Phase 3 Autonomous Modules & Callable Tools
1. **Advanced Multi-File Coding & Project Architect (`server/coding_agent_engine.py`)**: Plans, scaffolds, compiles, tests, and auto-debugs full-stack web projects (Frontend SPA, FastAPI Backend, SQLite Schema, Dockerfile, `docker-compose.yml`, and automated integration tests).
2. **Premium Anime Animation Studio (`server/anime_studio_engine.py`)**: Connects ComfyUI (`COMFYUI_URL`) + OpenArt/Higgsfield + NLE Video Renderer with locked **3-Panel Character Turnaround Sheets (`settei`)**, deterministic seeds, **`e-konte` storyboards**, and multi-scene stitched `.mp4` episodes with `.srt` subtitles.
3. **ElevenLabs & Multi-Harmonic Audio Studio (`server/audio_studio_engine.py`)**: Synthesizes music, songs, and sci-fi/anime sound effects via ElevenLabs Sound Generation API (`ELEVENLABS_API_KEY` in `.env`) + 44.1 kHz Stereo PCM WAV synthesis.
4. **5-Stage Premium Image Editor (`server/image_editing_engine.py`)**: Background removal (`bg_remover`), 4K upscaling (`upscale`), context-aware `inpaint`, cinema LUT `color_grade`, and reference `style_match`.
5. **Live Anime Database (`server/anime_db_engine.py`)**: Queries **AniList GraphQL API** (`https://graphql.anilist.co`) and **Jikan v4 MyAnimeList REST API** (`https://api.jikan.moe/v4`) with SQLite caching (`data/anime_cache.db`).
6. **Live Finance & Market Intelligence (`server/finance_engine.py`)**: Analyzes crypto (CoinGecko), stocks/ETFs, and 10-year personal finance compound growth with technical chart PNGs (`SMA-20`, Bollinger Bands). **Provides information & analysis only (never executes trades) and always displays mandatory Risk Disclosures.**
7. **Autonomic Self-Repair & Auto-Rollback (`server/self_repair_engine.py`)**: Logs errors (`logs/self_repair.jsonl`), diagnoses root causes, creates `.bak` snapshots, verifies patches, and **automatically rolls back** if any test fails.

### 4. 🌐 Core Workstation, Reverse Engineering, Physical AI & Native Builds
- **Ghidra 12.1.4 SRE Suite (`server/ghidra_engine.py`)**: PE/ELF static binary triage, Shannon entropy scoring, and C decompilation.
- **WendyOS & Physical AI Edge Harness (`server/wendy_engine.py`)**: Full `wendylabsinc` 10-repository integration + NVIDIA Jetson Orin Nano A/B OTA updates.
- **Autonomous ReAct Agentic Core (`server/agentic_engine.py`)**: 16-tool multi-step ReAct agent loop + 24/7 GitHub Cloud Server (`https://dominicano8787.github.io/jarvis-omni/`).
- **Native Executables**:
  - Windows Standalone Launcher: `JARVIS.exe`
  - Windows Self-Extracting Installer: `JARVIS-Setup-v4.0-x64.exe`
  - Samsung Galaxy Z Fold 7 (`SM-F966U`) Signed APK: `JARVIS-ZFold7-SM-F966U-v4.0.apk`

---

## 🔒 Security Rules
- All API keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `OPENART_API_KEY`, `HIGGSFIELD_API_KEY`, etc.) belong exclusively in `.env` (template provided in `.env.example`) and are protected by `.gitignore` so they are never committed to GitHub.

---

## 🧪 Verification & 36-Point Regression Suite

Run the complete 36-point end-to-end verification suite with latency benchmarking:
```powershell
D:\Jarvis\.venv\Scripts\python.exe D:\Jarvis\verify_all.py
```
