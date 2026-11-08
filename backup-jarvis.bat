@echo off
REM J.A.R.V.I.S. backup — mirrors this repo (including .git) to a local folder.
REM Default destination: %USERPROFILE%\JarvisBackup
REM   (override: backup-jarvis.bat D:\Somewhere\Else)
REM /MIR means the destination is made to match the source exactly — files
REM that no longer exist in the repo are deleted from the backup.
REM Secrets NEVER leave this machine: .env, *.jks, *.keystore, *.key and
REM *.pem files are excluded, as are the virtualenv and temp/cache folders.
setlocal
cd /d "%~dp0"
set "DEST=%~1"
if "%DEST%"=="" set "DEST=%USERPROFILE%\JarvisBackup"
robocopy "%~dp0" "%DEST%" /MIR /XD .venv __pycache__ data\tmp /XF .env *.env *.jks *.keystore *.key *.pem /R:1 /W:1
endlocal
