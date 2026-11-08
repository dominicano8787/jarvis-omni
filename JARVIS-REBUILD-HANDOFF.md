# Jarvis Online Rebuild — Handoff for Antigravity

**Written:** 2026-11-08 ~00:15 EST by Rocky (Muse), Jonathan's personal AI assistant.
**For:** Antigravity (running on Jonathan's Windows PC, repo at `D:\Jarvis`) to continue this work.
**Status:** Work is part-way done. The online + offline phases are implemented locally and mostly pushed to GitHub. Three files are still missing from the branch, the branch is not merged, and nothing has been verified live yet. This file tells you exactly where things stand and what is left.

---

## 1. Project

- **Repo:** `dominicano8787/jarvis-omni` (public GitHub repo). Owner: `dominicano8787`.
- **Local repo on this PC:** `D:\Jarvis`
- **Base commit on `main`:** `7f9d58d` ("feat(v4.2.0): CompTIA Security+ SY0-701 RAG, Never-Forget Memory & 7 Phase-3 Autonomous Modules", 2026-11-07 05:54 ET).
- **Work branch:** `rocky/online-rebuild` (exists on GitHub; see Section 3 for exactly what is on it).
- **Live site:** https://dominicano8787.github.io/jarvis-omni/ (currently serves the root build; see Section 4).
- **What Jarvis is:** Jonathan's personal voice assistant. Windows `.exe` (WinForms tray app), Android `.apk` (Samsung Galaxy Z Fold 7, SM-F966U, package `com.stark.jarvis.zfold7`), Python FastAPI backend (`server/`), Vite/React HUD frontend (pre-built bundles only — see the React-source gap in Section 5).

## 2. The goal and the full spec (from Jonathan)

Jonathan emailed himself this spec on 2026-11-07 at 05:41 ET. It is the requirements document for this rebuild. Follow it. The full text is reproduced here so this handoff is self-contained:

> You are working on my personal "Jarvis" voice assistant project. Before changing anything, scan the whole repo and give me a short map: the frontend, the backend/server, the Windows .exe build, the Android .apk build, every API key and secret, and every hardcoded URL, hostname or IP. Then do the following, in order.
>
> GOAL
> Jarvis should run online from https://YOURNAME.github.io (installable as a PWA on PC and phone). It should keep working offline from a local copy whenever the internet is down. Both the .exe and the .apk should be rebuilt with all of these upgrades.
>
> IMPORTANT ARCHITECTURE RULES (don't skip these)
> 1. GitHub Pages only hosts static files (HTML, CSS, JS). It can't run Python or Node servers or keep secrets. So:
>    - The UI, the voice interface and the app logic go on github.io.
>    - Anything that needs a secret (ElevenLabs, LLM keys, Google Calendar/Gmail OAuth) goes through a cloud backend or serverless proxy (Cloudflare Workers, Vercel or Render: pick whichever this repo already uses, or the simplest free option). Never ship API keys in the github.io code or inside the APK.
>    - PC control (screen viewing, mouse/keyboard, launching apps, running coding agents) has to stay as a small local "Jarvis Agent" on my Windows PC. The web/phone app talks to it securely, using a token-authenticated WebSocket through a stable tunnel such as a Cloudflare Tunnel with a fixed hostname. No random ngrok URLs that change on every restart.
> 2. Put all endpoints in ONE config file (config.json or similar) with this order: cloud backend → local agent → offline mode. Nothing hardcoded anywhere else.
>
> ONLINE (github.io)
> - Deploy the frontend to GitHub Pages with a GitHub Actions workflow that auto-deploys on every push to main.
> - Make it an installable PWA: manifest.json, icons, and a service worker.
> - Set CORS on the backend so it accepts requests from https://YOURNAME.github.io.
>
> OFFLINE / LOCAL BACKUP
> - Service worker caches the full app shell so the UI opens with no internet.
> - Offline mode keeps working: fall back to browser/OS text-to-speech and speech-to-text when ElevenLabs/cloud is unreachable, queue commands, and keep local PC-control commands working through the local agent on my LAN.
> - Keep a full local clone of the site and backend runnable on my PC with one command (e.g. start-jarvis-local.bat) so I can serve it at http://localhost when I'm offline.
> - Add a backup script that mirrors the repo plus configs (without secrets) to a local folder, and document where it goes.
> - Show a visible status indicator in the UI: Online / Local / Offline.
>
> FIX THE APK: "net::ERR_NAME_NOT_RESOLVED"
> This means the app is trying to reach a hostname that DNS can't find. Find the cause and fix it. Check for:
> - localhost, 127.0.0.1, a LAN IP, or a PC hostname hardcoded in the Android build (the phone can't resolve those)
> - an expired or changing tunnel URL (ngrok, trycloudflare, etc.)
> - typos in the URL, or http:// where it should be https://
> - a missing INTERNET permission, or cleartext traffic being blocked
> - a WebView/Capacitor/TWA server URL pointing to the wrong place
> Point the APK at https://YOURNAME.github.io (and the backend through config). Add a friendly offline screen and auto-retry instead of the raw error page. Preferably make the APK a thin wrapper (Capacitor or TWA) around the github.io app, so future upgrades show up without rebuilding.
>
> REBUILD .EXE AND .APK
> - .exe: rebuild the Windows app (Electron/Tauri/PyInstaller, whatever the repo uses) with every upgrade. It should load the github.io app when online, fall back to the bundled local copy when offline, and include or launch the local Jarvis Agent.
> - .apk: rebuild with the fix above. Signed release build, version number bumped.
> - Add GitHub Actions that build both and attach them to a GitHub Release, so I always have download links.
>
> VERIFY EVERYTHING (don't tell me it works until you've proved it)
> Run and report pass/fail for each item:
> 1. https://YOURNAME.github.io loads, and the PWA installs on desktop and Android
> 2. Backend health endpoint responds; CORS works from github.io
> 3. Voice in and voice out (ElevenLabs) work online
> 4. Calendar and email work through the backend
> 5. The local agent connects through the tunnel; a PC-control test command works from the phone
> 6. Turn the internet off: the app still opens, offline voice works, and the status shows Offline/Local
> 7. APK opens without ERR_NAME_NOT_RESOLVED on mobile data AND on Wi-Fi
> 8. The .exe launches online and offline
> 9. No secrets in the frontend, the APK or git history (scan for them)
> Fix anything that fails and re-test. Finish with a README section covering how to deploy, run locally, back up, and rebuild the .exe and the .apk, plus a final checklist of what I need to do by hand (adding secrets in GitHub/Cloudflare settings, signing keys, etc.).
>
> Ask me before deleting files, rotating keys, or changing my GitHub repo settings.

---

## 3. Repository state (as of 2026-11-08 ~00:15 EST)

### Branch `rocky/online-rebuild` on GitHub — 14 of 17 files pushed (verified by read-back)

These files ARE on the branch (do not re-create them; check first):

- `config.json` (new)
- `manifest.json` (new, references `./icon.svg`)
- `sw.js` (new, service worker)
- `icon.svg` (new, PWA icon — see note below)
- `index.html` (modified: manifest link, theme-color, service-worker registration, connection pill)
- `ui/dist/index.html` (modified, byte-identical to root `index.html`)
- `ui/dist/config.json` (new, byte-identical to root)
- `ui/dist/manifest.json` (new, byte-identical to root)
- `ui/dist/sw.js` (new, byte-identical to root)
- `ui/dist/icon.svg` (new, byte-identical to root)
- `README.md` (modified: new "Going Online" section + hand-off checklist)
- `start-jarvis-local.bat` (new)
- `backup-jarvis.bat` (new)
- `JARVIS-REBUILD-HANDOFF.md` (new — this file)

### Still MISSING from the branch — 3 files (your first job; see Section 6)

1. `.github/workflows/jarvis-pages-deploy.yml`
2. `.github/workflows/jarvis-agent-server.yml`
3. `ui/dist/assets/index-CRhZ5DKE.js` (831 KB, the frontend bundle copy for the local server)

### Why those 3 are missing

- The two workflow files cannot be pushed through the GitHub API: every attempt returns `403 Resource not accessible by integration` on `.github/workflows/` paths. The connected GitHub App lacks the Workflows permission, so the API refuses workflow files. They must be added via `git push` from this PC (which uses Jonathan's own git credentials) or via the GitHub web UI. Do NOT try the API again for these paths.
- The bundle file (831 KB) is too large for the API tools available here (single-argument limit). Copy it locally: it is byte-identical to `assets/index-CRhZ5DKE.js` at the repo root (which is already tracked on `main`).
- The branch is NOT merged to `main`. Do NOT merge until the 2 workflow files are on the branch — without the Pages deploy workflow, merging to `main` deploys nothing.

### Local commit history (Rocky's working copy; GitHub has the same content as separate per-file commits, so SHAs differ there)

- `513972a` — unify frontend on root build, add config.json + PWA, fix Pages deploy
- `e8ba531` — connection pill, local-run + backup scripts, README hand-off
- `d3fab13` — use SVG PWA icon so the snapshot push stays UTF-8 (replaced the generated PNG icons)
- `aceb0b9` — README hand-off checklist item 1 now reflects connected GitHub access

### How to pick up the branch on this PC

```powershell
cd D:\Jarvis
git fetch origin
git checkout rocky/online-rebuild
git pull origin rocky/online-rebuild
```

The local `D:\Jarvis` repo is currently at `main` (7f9d58d). The branch has the 14 files above. After checking it out, verify with `git status` and `git log --oneline -5`.

---

## 4. What was done (verified)

### 4.1 Repo map (verified against a read-only clone, 2026-11-07 evening)

**Frontend**
- Root `index.html` is a Vite build loading `./assets/index-CRhZ5DKE.js` (831,008 B) + `./assets/index-BU5osPZe.css`. Title: "J.A.R.V.I.S. V8 // Systems Architecture HUD".
- `ui/dist/` existed with a DIFFERENT build (`index-BtDuIV-1.js`, 828,553 B). Root and `ui/dist` were two divergent builds. This was fixed by unifying on the root build (see 4.2).
- `app.js` (20 KB) is orphaned — loaded by no HTML in the repo. It expects DOM ids that do not exist in `index.html`. Leave it alone unless the React source turns up.
- `styles.css` is referenced nowhere.
- The Vite bundle hardcodes a workstation probe list `["http://127.0.0.1:8777", "http://10.0.0.25:8777"]` and a `localStorage` default of `http://127.0.0.1:8777`. From a phone on mobile data neither is reachable — this is part of why the APK could not reach the backend.
- No `manifest.json`, service worker, or `config.json` existed anywhere before this work. `.nojekyll` and `404.html` existed at root. (`404.html` serves the old `ui/dist` build; the fixed deploy workflow overrides it with the unified `index.html` as the 404 fallback.)

**Backend (`server/`, 25 modules)**
- `server/main.py` (FastAPI, ~64 KB) + `config.py` + engines: brain, cognitive_core, agentic_engine, ai_router, experts, memory, long_term_memory, tools, worker, research, system_monitor, temporal_engine, security_plus_rag, anime_db/studio, audio_studio, coding_agent, faceless, finance, ghidra, image_editing, real_media, video, wendy, self_repair.
- `server/config.py` says `HOST` default `127.0.0.1`, `PORT` 8777, `ANTHROPIC_MODEL` `claude-opus-5`, `OLLAMA_HOST` `http://127.0.0.1:11434`. BUT `config.HOST`/`config.PORT` are never used: `server/main.py` `run_server()` hardcodes `uvicorn.run("server.main:app", host="0.0.0.0", port=8777)`. So the backend actually binds `0.0.0.0:8777`, not loopback-only.
- CORS is `allow_origins=["*"]` (`main.py:52-58`) — already wide open, not restricted to github.io. No server-code change was needed for CORS.
- Routes include `/api/status`, `/ws` (websocket), `/api/chat` (SSE POST), `/api/experts`, `/api/memory`, `/api/research`, plus ~30 engine endpoints. Static: `/` serves `ui/dist/index.html` if present else `WEB_DIR/index.html`; `/assets` serves `ui/dist/assets`; `/hud` serves `ui/dist`; `/static` serves `config.WEB_DIR` (`ROOT/"web"` — no `web/` directory exists, so `/legacy` would fail).
- External services called: Anthropic API (claude-opus-5), Ollama (127.0.0.1:11434), ElevenLabs (`ELEVENLABS_API_KEY` env), Pollinations text + image, GitHub Models (`models.github.ai/inference`, also called from the browser bundle), AniList GraphQL + Jikan v4, CoinGecko, ComfyUI (default `http://127.0.0.1:8188`), Temporal (`127.0.0.1:7233`).
- **No cloud backend / serverless proxy code exists** (no Cloudflare Worker / Vercel / Render). **No Gmail/Calendar/Google OAuth code exists in `server/`** — a grep found only a hardcoded fallback email at `server/video_engine.py:299`. Calendar/email through the backend (spec verify item 4) cannot work until that code is written.
- Hardcoded live hosts: `https://dominicano8787.github.io/jarvis-omni/`, `10.0.0.25:8777` (workstation LAN IP), `10.0.0.42:50051`, `10.0.0.48:50051`. The `security_plus_rag.py` IPs (192.168.1.0/24, 203.0.113.x, 10.10.x.x) are training/test fixtures, not live endpoints.

**Windows `.exe` (`src_native/`)**
- Only two files, no `.csproj`/`.sln`/build script: `JarvisStandaloneApp.cs` (WinForms tray app, v4.0.0.0) and `JarvisSetupInstaller.cs` (installer wizard, v4.0.0.0). Nothing in the repo can rebuild them as-is.
- `JarvisStandaloneApp.cs:21`: `GithubCloudUrl = "https://dominicano8787.github.io/jarvis-omni/"`. Lines 113/150: open local `http://127.0.0.1:8777` if port 8777 is listening, else the cloud URL. Lines 179-207: launches Temporal and uvicorn (`-m uvicorn server.main:app --host 0.0.0.0 --port 8777`).
- Committed binaries: `JARVIS.exe` (23,040 B) and `JARVIS-Setup-v4.0-x64.exe` (617,984 B).

**Android `.apk` (`android/`)**
- Contents: `AndroidManifest.xml`, `build_apk.ps1`, `src/com/stark/jarvis/zfold7/MainActivity.java` (968 lines). No `res/`, no `assets/`, no keystore in the repo.
- Manifest: package `com.stark.jarvis.zfold7`, versionCode 400, versionName `4.0.0-SM-F966U`, minSdk 29, targetSdk 35; `INTERNET` permission present; `android:usesCleartextTraffic="true"`.
- `MainActivity.java`: line 67 `VIRTUAL_HOST = "jarvis.fold7.local"`; line 68 `VIRTUAL_ORIGIN = "https://jarvis.fold7.local/index.html"`; line 69 `GITHUB_CLOUD_ORIGIN = "https://dominicano8787.github.io/jarvis-omni/"`; line 72 `DEFAULT_WORKSTATION_URL = "https://dominicano8787.github.io/jarvis-omni"`; **line 100 `webView.loadUrl(GITHUB_CLOUD_ORIGIN)`** in `onCreate`. `shouldInterceptRequest` (~line 235) serves `www` + path from APK assets for the virtual host (except `/api/*`); lines 261-262 `onReceivedError`: any main-frame load failure of a non-virtual host falls back to `view.loadUrl(VIRTUAL_ORIGIN)`.
- WebView: JS enabled, `MIXED_CONTENT_ALWAYS_ALLOW`, file access on, JS bridge `JarvisFoldBridge` exposed.
- **APK finding (ERR_NAME_NOT_RESOLVED):** current `MainActivity` source already points the WebView at the GitHub Pages URL, so current source would NOT produce ERR_NAME_NOT_RESOLVED from that URL. Most likely cause: the installed v4.0 APK was built from older code, OR the bundled Vite JS calls some other host. The committed APK (242,371 B, signed, `classes.dex` dated 2026-11-07 05:49) DOES bundle offline assets (`assets/www/index.html` + `assets/www/assets/index-CRhZ5DKE.js` + CSS — the root build), so the offline fallback has content in the shipped APK even though `www/` is not in the repo tree (it is generated at build time by `build_apk.ps1` step 1, which copies `D:\Jarvis\ui\dist\*` into `assets/www`).
- **Script/artifact mismatch:** the committed `build_apk.ps1` would bundle the `ui/dist` build (BtDuIV-1.js), but the committed APK contains the root build (CRhZ5DKE.js). The script is machine-specific: hand-rolled 7-step aapt2 → javac 17 → d8 → zipalign → apksigner pipeline hardcoding JDK 21, SDK at `D:\Android\Sdk`, build-tools 35.0.0, project at `D:\Jarvis\android`; step 2 runs `aapt2 compile --dir res` but no `res/` is committed (the APK does contain `res/drawable/ic_launcher.xml` + `resources.arsc`, so `res/` exists only on the build machine).

**Workflows (`cloud_workflows/`)**
- No `.github` directory existed; neither workflow could run as committed. Both have now been moved to `.github/workflows/` (see 4.2).
- `jarvis-pages-deploy.yml`: on push to main/master + dispatch; copies `ui/dist/*` → `_site/` (as originally written). The `ui/dist` path is valid — `ui/dist` exists. The fixed version deploys the unified root build instead (see 4.2).
- `jarvis-agent-server.yml`: dispatch-only; Python 3.12, runs `server.agentic_engine.execute_agentic_goal` (max_steps=4) with `GITHUB_TOKEN`. No deployment function.

**Secrets scan**
- Source-file grep (all `.py/.js/.java/.xml/.yml/.cs/.ps1/.md/.toml/.txt/.json/.html/.css`, excluding `.git` and minified bundles): no API keys, tokens, or private keys found. No `.env` file present; `.env.example` is placeholders only. Working-tree scan only; minified bundles were checked separately for URLs only. Git history is a single commit on `main`, so there is effectively no deeper history in the clone.
- **One real credential found:** `android/build_apk.ps1` hardcodes the APK signing keystore password in plaintext (in the `keytool -genkeypair` and `apksigner sign` commands). The keystore file itself (`jarvis_fold7.jks`) is NOT in the repo. The password value is deliberately not written in this file — read it from `build_apk.ps1` if you need it, then ROTATE it (see Section 6, item 7). Also note: `*.jks` is NOT in `.gitignore` today (only `*.keystore` is) — the keystore file itself could be committed by accident.

**`verify_all.py`**
- 35,381 B, 36-check suite run in-process via an ASGI test client against the local backend — not against the deployed Pages site. Checks 1-35 cover `/api/status`, voice, Temporal, TTS, image/video gen, chat instruction-following, omni pipeline, model catalog, Ghidra, faceless video, approval gate, telemetry, processes/screenshot, diagnostics, Fold7 APK endpoints, WendyOS, ReAct agent + GitHub cloud, Security+ RAG, Never-Forget memory, coding architect, anime pipeline, audio studio, image editing, anime DB, finance, self-repair/rollback.
- **Check 36 is broken as written** (`verify_all.py:736-741`): it asserts `JARVIS.exe` and `JARVIS-Setup-v3.0-x64.exe` exist, but the repo ships `JARVIS-Setup-v4.0-x64.exe` — the v3.0 file does not exist, so the check would fail before running `JARVIS.exe --verify`.

### 4.2 What was implemented (commits on `rocky/online-rebuild`)

**Commit 1 — unify frontend, config.json + PWA, fix Pages deploy**
- Unified the frontend on the ROOT build (verified the root bundle is a strict superset of the `ui/dist` bundle: identical host/URL/IP profiles; root has 4 extra `/api` paths — `/api/anime-db/`, `/api/finance/`, `/api/memory/never-forget`, `/api/secplus/` — the v4.2.0 features; no path in `ui/dist` is missing from root; first byte difference is only minifier identifier renaming). Root `assets/index-CRhZ5DKE.js` was copied into `ui/dist/assets/` so the local server serves the same build as Pages. (The bundle copy itself is one of the 3 missing files — see Section 6.)
- `config.json` (repo root, mirrored byte-identical into `ui/dist/`): endpoint order `cloud_backend` → `local_agent` → `offline`, exactly per the spec. `cloud_backend.url` is `""` with `status: "not_configured"` and a note that no proxy exists yet. `local_agent`: `http://127.0.0.1:8777` + `http://10.0.0.25:8777` (plus `ws://` variants). `offline`: `local_fallback`. Note: `config.json` is NOT wired into the bundle — the React source is not in the repo, so the bundle cannot read it until rebuilt from source.
- `manifest.json`: name J.A.R.V.I.S., `display: standalone`, theme `#050810`, background `#000000`, `start_url` the Pages URL, icons → `./icon.svg` (see the SVG note below).
- `sw.js`: precaches the app shell (`index.html`, JS/CSS assets, manifest, config.json, icon); navigation = network-first with cached-shell fallback; same-origin = cache-first.
- `icon.svg`: PWA icon generated from the existing SVG favicon (cyan ring + dot on `#050810`). **Why SVG, not PNG:** the GitHub API snapshot push rejects binary files, so the generated `icon-192.png`/`icon-512.png` could not be pushed. The manifest and service worker reference `icon.svg` instead. PNGs can be regenerated later from the SVG if wanted (the SVG is the source of truth now).
- `index.html`: added manifest link, `theme-color` meta, service-worker registration script.
- Both workflow files moved from `cloud_workflows/` to `.github/workflows/`. The Pages deploy workflow's Prepare step now deploys the unified root build (copies root `index.html`, `assets/`, `manifest.json`, `sw.js`, `config.json`, `icon.svg` into `_site/`, plus `index.html` as `404.html` and `.nojekyll`). `cloud_workflows/` is now empty but was left in place (do not delete it without asking Jonathan).
- Deliberately left out: the orphaned `index-BtDuIV-1.js` bundle (left in both `assets/` folders, now unreferenced); root `404.html` untouched (stale, references the old bundle, but the deploy workflow overrides it); no release-build workflow for .exe/.apk (no build inputs exist here); no server-code changes (CORS already `*`, binds `0.0.0.0:8777`).
- Static checks run: md5 byte-identity on all copies; JSON parse of `config.json`/`manifest.json`; `node --check` on `sw.js` and the extracted inline registration script; both YAML files parse; dry-run of the deploy Prepare step into a temp dir (all refs in `_site/index.html` resolve, `404.html` == `index.html`); all manifest + service-worker precache refs exist at root and in `ui/dist/`. NOT verified live: no server run, no Pages deploy, no PWA install or service-worker runtime test.

**Commit 2 — connection pill, local-run + backup scripts, README hand-off**
- Status indicator pill (`#jarvis-conn-pill`, fixed top-right, dark HUD styling, `pointer-events: none`, defaults to Offline) added to `index.html` (mirrored byte-identical into `ui/dist/index.html`). Logic: if `navigator.onLine === false` → Offline. Else fetch `./config.json`; if `cloud_backend.url` is non-empty, probe `<url>/api/status` (2.5 s timeout) → Online on HTTP 2xx. Else probe loopback `/api/status`, then LAN from config → Local on first success. Anything else → Offline. Never throws. Re-checks every 30 s and on `online`/`offline` events. Honest caveat (documented in a code comment): from the `https` Pages origin, plain-http loopback/LAN probes can be blocked by the browser (mixed content / private-network rules), so Local detection is most reliable over plain `http` (local run) or after the HTTPS tunnel exists. The pill can never claim Online until a cloud URL exists and responds.
- `start-jarvis-local.bat`: `cd /d "%~dp0"`, starts `uvicorn server.main:app --host 0.0.0.0 --port 8777` in a new window (`.venv\Scripts\python.exe` if present, else `uvicorn` from PATH), waits 3 s, opens `http://localhost:8777`. No hardcoded drive paths. Not executed here (Windows-only).
- `backup-jarvis.bat`: `robocopy "%~dp0" <dest> /MIR`, default dest `%USERPROFILE%\JarvisBackup` (override as first arg). Excludes `.env`, `*.env`, `*.jks`, `*.keystore`, `*.key`, `*.pem`, plus `.venv`, `__pycache__`, `data\tmp`. `/MIR` semantics (dest deletions) documented in the script header and README. Not executed here.
- `README.md`: new "Going Online" section covering deploy, local run, backup, honest rebuild state (.exe no build files; APK script machine-specific), and a hand-off checklist (see Section 6).
- Deliberately NOT implemented: offline voice-engine switching (browser TTS/STT fallback). It requires changing how the app picks voice engines, and the React source is not in the repo, so the bundle cannot be rebuilt to do it. Noted as a remaining item.
- Static checks run: `node --check` on the pill script extracted from the final `index.html` (passed); md5 byte-identity root vs `ui/dist/` for all six shared files (all identical); `config.json` parses; `git status` showed exactly the five intended files before commit; tree clean after commit. NOT verified: pill runtime behaviour, the two `.bat` files, the Pages deploy, and the local backend serving — only static checks. Those are unexecuted claims until run on the PC.

### 4.3 GitHub access — what happened and why the browser route is dead

- GitHub OAuth is connected as `dominicano8787` and the GitHub App is installed with the repo selected. Reads work. File writes via the API work for normal files (13 files pushed and verified by read-back).
- BUT the API cannot write `.github/workflows/` files: every attempt returns `403 Resource not accessible by integration`. The connected GitHub App lacks the Workflows permission. Do not retry the API for workflow files — it will fail the same way.
- The 831 KB bundle cannot be pushed through the available API tools either (single-argument limit). Use `git push` from this PC.
- Browser sign-in attempts (2026-11-07 23:09–23:38 ET) all failed, in order:
  1. Device verification: the first code (from a 9:46 PM GitHub email) was tried and rejected as incorrect. A fresh code was re-sent ~11:18 PM to the me.com inbox, which is not connected to any accessible mail — the code could not be fetched.
  2. Wrong account: the browser ended up signed in as `dominicano87` (a separate GitHub account with no write access to this repo). It must fork to propose changes — do NOT fork, do NOT edit as `dominicano87`.
  3. `dominicano8787` does NOT support password sign-in (GitHub: "This account does not support password sign-in, please try another sign-in method or account recovery"). It needs a passkey or Google/Apple SSO.
  4. Google sign-in for `dominicano872007@gmail.com`: the saved password was rejected twice ("Wrong password") and is wrong/outdated; the passkey was tried once without success; Google moved to account recovery, which needs the full phone number ending in 58 (a recovery phone ending in 35 was also mentioned). Only Jonathan knows the full number.
  5. The credential service only ever offers `dominicano87` for GitHub. There is no usable saved login for `dominicano8787` in the browser.
- Conclusion: the browser route is closed. Finish the remaining files with `git push` from this PC (Section 6), or have Jonathan sign in himself (passkey on his device, or Google recovery with the phone ending in 58) and re-run the browser task.

---

## 5. What remains to be done (in order)

### 5.1 Push the 3 missing files to the branch (first job — Section 6 has the exact contents and commands)

1. Check out `rocky/online-rebuild` on this PC (see Section 3).
2. Create `.github/workflows/jarvis-pages-deploy.yml` with the exact content in Section 6.1.
3. Create `.github/workflows/jarvis-agent-server.yml` with the exact content in Section 6.2. (It is identical to the existing `cloud_workflows/jarvis-agent-server.yml`, so you may also just copy that file — but verify the content matches Section 6.2.)
4. Copy `assets\index-CRhZ5DKE.js` to `ui\dist\assets\index-CRhZ5DKE.js` (byte-identical copy; verify with a hash compare).
5. `git add -A`, commit, `git push origin rocky/online-rebuild`. Verify on GitHub that the branch now has all 17 files.
6. Delete the now-empty `cloud_workflows/` directory ONLY if Jonathan approves (his spec says ask before deleting files). The two workflow files will then exist in both places until then — harmless, but note it.

### 5.2 Open a PR and merge to `main` (deploys the site)

- Open a pull request from `rocky/online-rebuild` to `main`. Title something like: "Jarvis online rebuild: PWA, config.json, unified frontend, status pill, local-run + backup".
- Review the diff (it should be: the 17 files listed in Section 3, plus this handoff file). Merge it (squash is fine). Merging to `main` triggers the Pages deploy workflow.
- Confirm the workflow run succeeds in the repo's Actions tab. If it fails, read the log — the most likely failure is a missing Pages setup (repo Settings → Pages → Source must be "GitHub Actions").

### 5.3 Verify the deployment (spec verify items 1–2, partial)

- https://dominicano8787.github.io/jarvis-omni/ loads, shows the HUD and the connection pill (should read Offline or Local, never Online yet — there is no cloud backend).
- PWA installs on desktop (Chrome/Edge) and on Android. Check the manifest serves, the service worker registers, and the app shell opens with the network off (airplane mode).
- Backend health: run the backend locally (`start-jarvis-local.bat`, then `http://localhost:8777/api/status`). Confirm CORS works from the github.io origin (the backend already allows `*`, so this should pass — prove it anyway).

### 5.4 Cloud backend / serverless proxy (spec: secrets must never ship in the frontend or APK)

- Pick Cloudflare Workers, Vercel, or Render (the repo uses none today — simplest free option is fine). Deploy a small proxy that holds the secrets (ElevenLabs key, LLM keys) and forwards the calls the frontend/backend need.
- Put its URL in `config.json` (`cloud_backend.url`) and set `status` to `configured`. Only then can the pill show Online.
- Add the secrets in GitHub / Cloudflare settings — never in the repo and never in `config.json`.
- Note: the backend currently has NO Gmail/Calendar/Google OAuth code at all. Building that (spec verify item 4) is a separate work item: add the OAuth flow and the calendar/email endpoints to `server/`, routed through the proxy.

### 5.5 React source — the biggest open gap

- The React source for the HUD is NOT in the repo — only pre-built bundles. Find it (ask Jonathan where it lives) and add it to the repo (or at least the build pipeline) so the bundle can be rebuilt. Until then, these are impossible:
  - Making the bundle read `config.json` (it currently uses hardcoded `127.0.0.1:8777` / `10.0.0.25:8777` probes).
  - Offline voice-engine switching (browser TTS/STT fallback when ElevenLabs/cloud is unreachable) — spec verify item 6, partly.
  - Fixing the on-page LOCAL TIME bug (the live site showed UTC time, e.g. 21:35, when local time was 16:35 ET).
- If the source cannot be found, say so plainly and do not pretend the bundle was rebuilt.

### 5.6 Fix the APK and rebuild it (spec: ERR_NAME_NOT_RESOLVED, signed release, version bumped)

- Most likely cause is a stale v4.0 APK built from older code (current `MainActivity` already points at the Pages URL). Rebuild from the current source on this PC using `android\build_apk.ps1` (JDK 21, Android SDK at `D:\Android\Sdk`, build-tools 35.0.0, keystore at `D:\Jarvis\android\keystore\jarvis_fold7.jks`).
- Before rebuilding: the script would bundle the `ui/dist` build — make sure `ui/dist` holds the unified root build first (it will after Section 5.1, since the bundle copy lands there). Also note `res/` exists only on the build machine; if the script fails on `aapt2 compile --dir res`, recreate/verify `res/` (the shipped APK contains `res/drawable/ic_launcher.xml` + `resources.arsc`).
- Bump the version (currently versionCode 400, versionName `4.0.0-SM-F966U`).
- Sign the release build with the keystore. Verify on the phone: the APK opens without ERR_NAME_NOT_RESOLVED on mobile data AND on Wi-Fi (spec verify item 7). Test the offline fallback (airplane mode → bundled `www/` assets) and the friendly offline screen + auto-retry the spec asks for — those do not exist yet and need to be added if the rebuild is to fully satisfy the spec.
- Prefer the thin-wrapper direction from the spec (Capacitor or TWA around the github.io app) only if Jonathan approves that rework; the minimal fix is the rebuild from current source.

### 5.7 Rotate the exposed keystore password + fix `.gitignore`

- The APK signing keystore password is hardcoded in plaintext in `android\build_apk.ps1` (in the `keytool` and `apksigner` commands), and the repo is public. ROTATE the password (new keystore password + key password), update `build_apk.ps1` to read the password from an environment variable or a local file that is git-ignored — never hardcode it again.
- Add `*.jks` to `.gitignore` (today only `*.keystore` is ignored). Verify the keystore file itself (`jarvis_fold7.jks`) is not tracked: `git ls-files | findstr jks`.
- Ask Jonathan before rotating keys (his spec requires it). Do not quote the old password in any file, message, or commit.

### 5.8 Rebuild the `.exe` (spec: load github.io when online, fall back to bundled copy offline, include/launch the local Jarvis Agent)

- There are no build files in the repo (`src_native/` has only the two C# sources, no `.csproj`/`.sln`/build script). Find the original build setup Jonathan used, or create a new .NET project around the two C# sources. Rebuild `JARVIS.exe` and `JARVIS-Setup-v4.0-x64.exe` (bump the version from 4.0.0.0 as appropriate).
- Verify the .exe launches online and offline (spec verify item 8) and that it starts the local agent (it currently launches Temporal + uvicorn from the C# code — verify that still works with the new backend).

### 5.9 GitHub Actions release builds (spec)

- Add a workflow that builds the `.exe` and the `.apk` and attaches them to a GitHub Release. This was deliberately NOT created yet because the build inputs do not exist here (no .exe build files, no keystore in the repo, machine-specific APK script). Create it only once 5.6 and 5.8 have real, working build steps. Do not create a workflow that is guaranteed to fail.

### 5.10 Local agent + tunnel (spec: PC control through a stable tunnel)

- Set up the Cloudflare Tunnel with a fixed hostname on this PC so the web/phone app can reach the local Jarvis Agent over a token-authenticated WebSocket. No random ngrok URLs. The local agent is the same backend (`server/main.py` on 0.0.0.0:8777) — confirm what "local agent" means here (the backend itself, or a small separate agent process) and document it.
- Test from the phone: a PC-control command works through the tunnel (spec verify item 5).

### 5.11 Run the full verify checklist and fix failures (spec verify items 1–9)

Run and report pass/fail for each item (do not claim anything works until proved):
1. https://dominicano8787.github.io/jarvis-omni/ loads, and the PWA installs on desktop and Android
2. Backend health endpoint responds; CORS works from github.io
3. Voice in and voice out (ElevenLabs) work online
4. Calendar and email work through the backend (requires 5.4 — no code exists yet)
5. The local agent connects through the tunnel; a PC-control test command works from the phone (requires 5.10)
6. Turn the internet off: the app still opens, offline voice works, and the status shows Offline/Local (offline voice requires 5.5)
7. APK opens without ERR_NAME_NOT_RESOLVED on mobile data AND on Wi-Fi (requires 5.6)
8. The .exe launches online and offline (requires 5.8)
9. No secrets in the frontend, the APK or git history (scan for them — redo the scan after all changes, including the minified bundles and git history)

Also fix `verify_all.py` check 36: it expects `JARVIS-Setup-v3.0-x64.exe` but the repo ships `JARVIS-Setup-v4.0-x64.exe` (`verify_all.py:736-741`).

### 5.12 Final README + hand-off checklist

- The README already has a "Going Online" section (deploy, local run, backup, rebuild state, hand-off checklist). Update it once 5.2–5.11 land so it describes the final state, and update the hand-off checklist with what Jonathan still has to do by hand (secrets in GitHub/Cloudflare settings, signing keys, the items above that need him).

---

## 6. The 3 missing files — exact contents and commands

### 6.1 `.github/workflows/jarvis-pages-deploy.yml` (create with exactly this content)

```yaml
name: J.A.R.V.I.S. 24/7 GitHub Pages Cloud Server Deploy

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy-cloud-server:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout J.A.R.V.I.S. Omni Repository
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Prepare J.A.R.V.I.S. Cloud Bundle
        run: |
          mkdir -p _site
          cp index.html _site/
          cp -r assets _site/
          cp manifest.json sw.js config.json icon.svg _site/
          cp index.html _site/404.html
          cp .nojekyll _site/.nojekyll

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "_site"

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 6.2 `.github/workflows/jarvis-agent-server.yml` (create with exactly this content — identical to `cloud_workflows/jarvis-agent-server.yml`)

```yaml
name: J.A.R.V.I.S. Autonomous Agent Cloud Worker

on:
  workflow_dispatch:
    inputs:
      goal:
        description: "Autonomous ReAct Agent Objective"
        required: false
        default: "Audit J.A.R.V.I.S. GitHub Cloud Server and verify all subsystems"
  repository_dispatch:
    types: [jarvis-agent-goal]

permissions:
  contents: read
  models: read

jobs:
  execute-autonomous-agent:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Execute J.A.R.V.I.S. Autonomous ReAct Agent Loop
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          JARVIS_GOAL: ${{ github.event.inputs.goal || 'Audit J.A.R.V.I.S. GitHub Cloud Server and verify all subsystems' }}
        run: |
          python3 -c "
          import json, os
          from server.agentic_engine import execute_agentic_goal
          goal = os.environ.get('JARVIS_GOAL', 'Audit J.A.R.V.I.S. GitHub Cloud Server')
          res = execute_agentic_goal(goal=goal, max_steps=4)
          print(json.dumps(res, indent=2))
          "
```

### 6.3 `ui/dist/assets/index-CRhZ5DKE.js` (copy, do not re-create)

```powershell
copy assets\index-CRhZ5DKE.js ui\dist\assets\index-CRhZ5DKE.js
```

Then verify the two copies are byte-identical (e.g. compare file hashes). The source file is already tracked on `main` at `assets/index-CRhZ5DKE.js`.

### 6.4 Commands to push the 3 files (run in `D:\Jarvis` after checking out the branch)

```powershell
cd D:\Jarvis
git fetch origin
git checkout rocky/online-rebuild
git pull origin rocky/online-rebuild
mkdir .github\workflows
copy cloud_workflows\jarvis-pages-deploy.yml .github\workflows\jarvis-pages-deploy.yml
copy cloud_workflows\jarvis-agent-server.yml .github\workflows\jarvis-agent-server.yml
copy assets\index-CRhZ5DKE.js ui\dist\assets\index-CRhZ5DKE.js
git add -A
git commit -m "Add workflow files + ui/dist bundle"
git push origin rocky/online-rebuild
```

**Important:** the `cloud_workflows\jarvis-pages-deploy.yml` on this PC is the OLD version (it copies `icon-192.png`/`icon-512.png`). Before copying it, edit its Prepare step so the copy line reads `cp manifest.json sw.js config.json icon.svg _site/` — or create the file from Section 6.1 instead. If you copy the old version, the deploy will break (the PNGs do not exist on the branch). The agent-server file is unchanged, so a plain copy is fine.

---

## 7. Rules and constraints (do not break these)

- Ask Jonathan before deleting files, rotating keys, or changing GitHub repo settings.
- Never ship API keys in the github.io code or inside the APK. Secrets live in environment variables, `.env` (git-ignored), or GitHub/Cloudflare settings — never in the repo.
- One config file (`config.json`) with order cloud backend → local agent → offline. Nothing hardcoded anywhere else (the bundle's hardcoded URLs are a known gap until the React source is found — see 5.5).
- Do NOT use the `dominicano87` GitHub account for anything in this repo. It has no write access. The repo owner is `dominicano8787`.
- `dominicano8787` does not support password sign-in on GitHub (passkey or Google/Apple SSO only). The saved Google password for `dominicano872007@gmail.com` was rejected as wrong/outdated. Do not keep retrying passwords that have already failed.
- Do not present anything as working until the verify checklist (Section 5.11) has actually been run. Static checks (file parsing, byte-identity) are not live verification.
- Keep root files and `ui/dist/` byte-identical for all shared files (`index.html`, `config.json`, `manifest.json`, `sw.js`, `icon.svg`, and the bundle in `assets/`). The Pages deploy serves the root build; the local server serves `ui/dist/`. If they drift, the site and the local run will show different apps.

## 8. Accounts, key facts, and blockers (quick reference)

- **GitHub repo owner:** `dominicano8787` (passkey/SSO only; no password sign-in). **Do NOT use `dominicano87`** (separate account, no write access).
- **Google account linked to GitHub:** `dominicano872007@gmail.com` (saved password rejected as wrong; account recovery needs the full phone number ending in 58; a recovery phone ending in 35 was also mentioned).
- **GitHub API limits found:** the connected GitHub App cannot write `.github/workflows/` files (403, missing Workflows permission) and cannot push the 831 KB bundle (argument-size limit). Use `git push` from this PC for those.
- **Backend:** FastAPI `server/main.py`, binds `0.0.0.0:8777`, CORS `allow_origins=["*"]`, default Anthropic `claude-opus-5`, Ollama fallback `127.0.0.1:11434`. Local run: `start-jarvis-local.bat` → http://localhost:8777. Backup: `backup-jarvis.bat` → `%USERPROFILE%\JarvisBackup`.
- **Live site:** https://dominicano8787.github.io/jarvis-omni/ (loads; dark HUD shell, orb, STATUS: IDLE; shell only, backend not connected).
- **Known bugs/gaps:** React source missing (bundle cannot be rebuilt or read `config.json`); no cloud backend/proxy; no Gmail/Calendar OAuth code; offline voice switching not implemented; `verify_all.py` check 36 broken (v3.0 vs v4.0 filename); on-page LOCAL TIME shows UTC; `404.html` is stale (references the old bundle); `cloud_workflows/` is now empty; `*.jks` not in `.gitignore`; keystore password hardcoded in plaintext in `android/build_apk.ps1` (rotate it — see 5.7).
- **Jonathan's other pending items (not this project, do not re-nudge):** Gemini and ChatGPT API keys not provided; Grok API route blocked pending his network approval in the main chat; daily Gmail summary runs every morning ~08:15 ET.

---

*End of handoff. When you finish a section, update this file (or the README) with what changed and what is still open, so the next agent — or Jonathan — never has to re-derive it.*
