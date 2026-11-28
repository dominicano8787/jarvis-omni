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
- **REA skill (`skills/reverse-engineer-anything/`)**: The Reverse Engineering profile now carries the [REA](https://github.com/morluto/rea) "reverse-engineer-anything" skill (v63) and its 8 reference guides, and runs REA through the `rea_cli` tool (an installed `rea`, or `npx -y rea-agents@latest`; needs Node.js). Results are saved under `data/rea/results`.
- **WendyOS & Physical AI Edge Harness (`server/wendy_engine.py`)**: Full `wendylabsinc` 10-repository integration + NVIDIA Jetson Orin Nano A/B OTA updates.
- **Autonomous ReAct Agentic Core (`server/agentic_engine.py`)**: 16-tool multi-step ReAct agent loop + 24/7 GitHub Cloud Server (`https://dominicano8787.github.io/jarvis-omni/`).
- **Native Executables**:
  - Windows Standalone Launcher: `JARVIS.exe`
  - Windows Self-Extracting Installer: `JARVIS-Setup-v4.0-x64.exe`
  - Samsung Galaxy Z Fold 7 (`SM-F966U`) Signed APK: `JARVIS-ZFold7-SM-F966U-v4.0.apk`

---

## 🎙️ Brain & Voice Switching, Local "Uncensored" Brain, Computer Takeover

Modeled on the abilities in Zubair Trabzada's "Jarvis" videos (AI Workshop), built on this codebase.

### Say it, and Jarvis switches (no model call, instant)
| Say | What happens |
|---|---|
| "Jarvis, switch to your local brain" | Answers with your Ollama model (`JARVIS_OLLAMA_MODEL`) |
| "Switch to Gemma 4 12B" / "switch to qwen three point five 9b" | Checks Ollama has that model pulled, then switches; lists what is installed if not |
| "Switch to uncensored mode" | Uses `JARVIS_UNCENSORED_MODEL` (see below) |
| "Go back to your cloud brain" | Back to Claude (`JARVIS_MODEL`) |
| "Switch to your ElevenLabs voice" / "local voice" / "standard voice" | Changes how `/api/tts/speak` talks |
| "Which brain are you using?" | Reports brain, model and voice |

The choice is saved in `data/switchboard.json` and survives restarts. It can also be set over the WebSocket `settings` frame (`brain`, `local_model`, `voice`) or `POST /api/switchboard` (`{"command": "switch to your local brain"}`); `GET /api/switchboard` lists installed Ollama models.

**The local brain now has tools.** It uses the same shell, file, Ghidra, REA and computer-control tools as the cloud brain, through Ollama function calling and the same approval cards. Use a model that supports tools (Qwen 3.x, Gemma 3/4, Llama 3.x and gpt-oss do); others answer without tools. The local brain has no server-side web search.

Size models to Platano's memory: roughly 0.6 GB per billion parameters at 4-bit (a 9B model needs about 6 GB, 27B about 16 GB).

### Uncensored brain
"Uncensored" means a local open-weights model with no cloud provider's moderation, typically an *abliterated* GGUF. Pick one on Hugging Face, load it into Ollama (`ollama pull hf.co/<user>/<repo>:Q4_K_M`, or `ollama create` with a Modelfile), then set `JARVIS_UNCENSORED_MODEL` to its tag. **The approval gate still applies:** a model without refusals will follow instructions injected by web pages and files it reads, so shell, file writes and computer control still need a click unless autonomous mode is on.

### Computer takeover
Two new tools: `screen_capture` (look at the screen) and `computer_action` (click, double/right click, move, drag, type, key, hotkey, scroll, wait). Every action returns a fresh screenshot, so Jarvis checks the result before the next step. Coordinates are mapped back from the scaled screenshot and are DPI-aware on Windows. Only the newest 3 screenshots stay in the conversation.

**Kill switch**, any of these stops the next action: slam the mouse into a screen corner, press interrupt in the HUD, or `POST /api/computer/stop`. A new prompt re-arms it. Every action needs approval unless autonomous mode is on.

Needs `pip install pyautogui mss` (added to `requirements.txt`). Jarvis must run in your logged-in desktop session, not as a service.

### Voices
- `edge` (default): Edge neural `en-GB-RyanNeural`, with Windows SAPI as the offline fallback.
- `elevenlabs`: needs `ELEVENLABS_API_KEY`; optional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_TTS_MODEL` (default `eleven_flash_v2_5`).
- `local`: no cloud at all. Windows SAPI, or a local voice-clone server if `JARVIS_LOCAL_TTS_URL` points at an endpoint that takes `POST {"text": ...}` and returns audio. VoiceStudio is one option; check its API docs and wrap it if its request format differs. Clone only voices you have permission to use.

---

## 🔒 Security Rules
- All API keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `OPENART_API_KEY`, `HIGGSFIELD_API_KEY`, etc.) belong exclusively in `.env` (template provided in `.env.example`) and are protected by `.gitignore` so they are never committed to GitHub.

---

## 🧪 Verification & 36-Point Regression Suite

Run the complete 36-point end-to-end verification suite with latency benchmarking:
```powershell
D:\Jarvis\.venv\Scripts\python.exe D:\Jarvis\verify_all.py
```

---

## 🚀 Going Online — Deploy, Run Locally, Back Up, Rebuild

### Deploy (GitHub Pages)
Push to `main` (or `master`) and the `jarvis-pages-deploy.yml` workflow deploys the root build to https://dominicano8787.github.io/jarvis-omni/ automatically. The workflow copies the root `index.html`, `assets/`, `manifest.json`, `sw.js`, `config.json` and icons into the Pages artifact. Root files and `ui/dist/` are kept byte-identical — edit one, mirror it to the other. The HUD shows a small Online / Local / Offline pill (top right) driven by `config.json`: it only ever shows Online once a cloud backend URL is set in `config.json` and answers `/api/status`.

### Run locally
Double-click `start-jarvis-local.bat` (or run it from a terminal). It starts the backend with `uvicorn server.main:app --host 0.0.0.0 --port 8777` — using `.venv\Scripts\python.exe` if it exists, otherwise `uvicorn` from PATH — waits a few seconds, then opens http://localhost:8777. The backend serves `ui/dist/index.html` at `/`, so no separate static server is needed. Requires Python with FastAPI/uvicorn installed (see `requirements.txt`).

### Back up
Run `backup-jarvis.bat`. Default destination: `%USERPROFILE%\JarvisBackup` (pass a different folder as the first argument). It mirrors the repo — including `.git` — with `robocopy /MIR`, so files deleted from the repo are also deleted from the backup. Excluded, always: `.env`, `*.env`, `*.jks`, `*.keystore`, `*.key`, `*.pem` — secrets never leave the machine — plus `.venv`, `__pycache__` and `data\tmp`.

### Rebuild the .exe and .apk — current state (honest)
- **Windows .exe:** there are no build files in the repo — `src_native/` has only the C# sources (`JarvisStandaloneApp.cs`, `JarvisSetupInstaller.cs`), no `.csproj`, `.sln` or build script, and the committed `JARVIS.exe` / `JARVIS-Setup-v4.0-x64.exe` were built by an unknown earlier setup. To rebuild by hand: locate the original build setup (or create a new .NET project around the two C# sources) and rebuild on the PC.
- **Android .apk:** `android/build_apk.ps1` is machine-specific and only runs on Jonathan's PC as written — it hardcodes `D:\Jarvis` paths, Microsoft JDK 21 at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`, the Android SDK at `D:\Android\Sdk` (platform android-35, build-tools 35.0.0), and signs with the keystore at `D:\Jarvis\android\keystore\jarvis_fold7.jks`, which exists only on that PC and is not in the repo. To rebuild by hand: on that PC, with the JDK, SDK and keystore in place, run `android\build_apk.ps1` from PowerShell.

### Remaining: offline voice-engine switching
Browser TTS/STT fallback (using the browser's own speech synthesis/recognition when the cloud voice engines are unreachable) is NOT implemented. It requires changing how the app picks voice engines, and the React source is not in this repo — only the pre-built bundle — so the bundle cannot be rebuilt to consume `config.json` yet. See the hand-off checklist.

### Hand-off checklist — do by hand
1. GitHub access is connected (Muse can read/write the `jarvis-omni` repo). Merge the `rocky/online-rebuild` branch to `main` to deploy the Pages site.
2. Choose and deploy a cloud proxy (Cloudflare Worker, Vercel or Render) and put its URL in `config.json` (`cloud_backend.url`); only then can the pill show Online.
3. Add secrets in GitHub / Cloudflare settings — never in the repo or in `config.json`.
4. Rotate the exposed APK signing keystore password. Also add `*.jks` to `.gitignore` — it is not ignored today (only `*.keystore` is).
5. Locate or provide the React source so the bundle can be rebuilt to read `config.json` and to add the offline voice-engine (browser TTS/STT) fallback.
6. Set up the Cloudflare Tunnel + local agent on the Windows PC so the web/phone app can reach it over a stable hostname (no changing ngrok URLs).
