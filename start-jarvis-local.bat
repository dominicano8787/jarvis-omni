@echo off
REM J.A.R.V.I.S. — local run.
REM Starts the Python backend (which serves the HUD from ui/dist at /) and
REM opens http://localhost:8777 in the default browser.
REM No hardcoded drive paths: %~dp0 is this repo's folder wherever it lives.
REM Requires Python with uvicorn installed (uses .venv if present).
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  start "JARVIS backend" ".venv\Scripts\python.exe" -m uvicorn server.main:app --host 0.0.0.0 --port 8777
) else (
  start "JARVIS backend" uvicorn server.main:app --host 0.0.0.0 --port 8777
)
timeout /t 3 /nobreak >nul
start "" "http://localhost:8777"
endlocal
