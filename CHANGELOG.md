# Changelog — J.A.R.V.I.S. Omni-Workstation

## [v4.2.0] — 2026-11-07
### Added
- **Phase 0 — Full Codebase Audit & 36-Point Regression Suite**:
  - Audited all backend modules, React HUD components, Windows C# `.exe` builds, and Android `SM-F966U` `.apk` pipeline.
  - Added `.gitignore` to strictly protect `.env` and private keys from ever being committed.
  - Fixed SQLite `ResourceWarning` in `server/memory.py` (`atexit` connection cleanup) and suppressed `duckduckgo_search` rename warning in `server/cognitive_core.py`.
- **Phase 1 — CompTIA Security+ (`SY0-701`) Knowledge Base & Vector RAG (`server/security_plus_rag.py`)**:
  - Cloned `https://github.com/labex-labs/comptia-security-plus-training-labs` into `data/security_plus/comptia-security-plus-training-labs` and parsed all 14 hands-on Linux security labs.
  - Added complete gap-fill across all 5 domains and all 28 official `SY0-701` sub-objectives (`1.1`–`5.6`), 33+ ports/protocols, 100+ acronyms, 8 frameworks, multiple-choice practice questions, interactive PBQ scenarios, and the **Explain-My-Command** CLI analyzer.
  - Indexed 100 cited documents in `data/security_plus/secplus_rag.db`.
- **Phase 2 — "Never Forget" Long-Term Memory & PC ↔ Phone Sync (`server/long_term_memory.py`)**:
  - Persistent SQLite (`data/never_forget.db`) + JSON/Markdown memory vault with automatic conversation fact extraction.
  - Added View, Add, Edit, Delete, and Bi-Directional Sync (`PC <-> Samsung Galaxy Z Fold 7 <-> GitHub Cloud`) via `/api/memory/never-forget*` and natural-language chat commands.
- **Phase 3 — 7 New Standalone Modules & Callable ReAct Tools**:
  1. `server/coding_agent_engine.py`: Multi-file full-stack project architect, test runner, and auto-debugger.
  2. `server/anime_studio_engine.py`: Consistent 3-panel Character Turnaround Sheets (`settei`), `e-konte` storyboards, ComfyUI/Video bridge, and multi-scene `.mp4` episode renderer with `.srt` subtitles.
  3. `server/audio_studio_engine.py`: ElevenLabs Sound Generation API integration + 44.1 kHz Stereo Multi-Harmonic WAV music, song, and SFX synthesizer.
  4. `server/image_editing_engine.py`: 5-stage premium image editor (`bg_remover`, `upscale`, `inpaint`, `color_grade` LUTs, `style_match` palette transfer).
  5. `server/anime_db_engine.py`: Live AniList GraphQL API + Jikan v4 MyAnimeList REST API client with SQLite caching (`data/anime_cache.db`).
  6. `server/finance_engine.py`: Live Crypto, Stocks & Personal Finance analyzer with technical chart PNGs (`SMA-20`, Bollinger Bands) and mandatory Risk Disclosures (strictly no trade execution).
  7. `server/self_repair_engine.py`: Structured error logger (`logs/self_repair.jsonl`), root-cause diagnostics, `.bak` snapshots, and automatic rollback when a patch fails verification tests.
- **Phase 4 — Native Builds & Full Verification**:
  - Rebuilt UI bundle (`web/`), Windows native executables (`JARVIS.exe` & `JARVIS-Setup-v4.0-x64.exe`), and signed Samsung Galaxy Z Fold 7 Android package (`JARVIS-ZFold7-SM-F966U-v4.0.apk`).
  - Verified **36/36 end-to-end checks passing (100%)** with per-module response times measured.
