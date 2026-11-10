import os
import sys
import shutil
import zipfile
import subprocess
from pathlib import Path

ROOT = Path(r"D:\Jarvis")
TMP_DIR = ROOT / "data" / "tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)
os.environ["TEMP"] = str(TMP_DIR)
os.environ["TMP"] = str(TMP_DIR)

SRC_NATIVE = ROOT / "src_native"
PAYLOAD_ZIP = SRC_NATIVE / "payload.zip"
PORTABLE_ZIP = ROOT / "JARVIS-Windows-Package-v3.0.zip"
SETUP_EXE = ROOT / "JARVIS-Setup-v3.0-x64.exe"
SETUP_V4_EXE = ROOT / "JARVIS-Setup-v4.0-x64.exe"
JARVIS_EXE = ROOT / "JARVIS.exe"

INCLUDE_FILES = [
    "JARVIS.exe",
    "JARVIS-ZFold7-SM-F966U-v4.0.apk",
    "jarvis.ico",
    "Launch-JARVIS.bat",
    "Setup-JARVIS.ps1",
    "run.ps1",
    "requirements.txt",
    "pyproject.toml",
    "README.md",
    "CHANGELOG.md",
    "verify_all.py",
    ".env.example",
    "data/creative_assets/history.json",
    "data/creative_assets/test_flux.jpg",
    "data/creative_assets/openart_uAY7d1zB.png",
    "data/renders/video_history.json",
    "data/renders/openart_vid_8cPwVW3j.mp4",
    "data/renders/openart_vid_3fWuo5GF.mp4",
]

INCLUDE_DIRS = [
    "server",
    "ui/dist",
    "ui/src",
    "agents",
    ".agents",
    "src_native",
]

INCLUDE_UI_FILES = [
    "ui/package.json",
    "ui/index.html",
    "ui/vite.config.ts",
    "ui/vite-plugin-jarvis.ts",
    "ui/tsconfig.json",
]

EXCLUDE_PARTS = {"__pycache__", ".pytest_cache", "node_modules", ".git", "payload.zip"}


def compile_standalone_jarvis_exe():
    print(f"[0/3] Compiling standalone application -> {JARVIS_EXE}")
    csc = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    cs_file = str(SRC_NATIVE / "JarvisStandaloneApp.cs")
    ico_file = str(ROOT / "jarvis.ico")
    cmd = [
        csc,
        "/nologo",
        "/target:exe",
        f"/out:{JARVIS_EXE}",
        f"/win32icon:{ico_file}",
        "/r:System.dll",
        "/r:System.Drawing.dll",
        "/r:System.Windows.Forms.dll",
        cs_file,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("CSC Error compiling JARVIS.exe:", proc.stdout, proc.stderr)
        sys.exit(1)
    print(f"      Compiled {JARVIS_EXE.name} ({JARVIS_EXE.stat().st_size:,} bytes)")


def build_payload_zip():
    print(f"[1/3] Building embedded standalone payload -> {PAYLOAD_ZIP}")
    if PAYLOAD_ZIP.exists():
        PAYLOAD_ZIP.unlink()

    count = 0
    with zipfile.ZipFile(PAYLOAD_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for rel in INCLUDE_FILES + INCLUDE_UI_FILES:
            p = ROOT / rel
            if p.exists() and p.is_file():
                zf.write(p, rel.replace("\\", "/"))
                count += 1

        for drel in INCLUDE_DIRS:
            dp = ROOT / drel
            if not dp.exists():
                continue
            for root_dir, dirs, files in os.walk(dp):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_PARTS]
                for f in files:
                    if f in EXCLUDE_PARTS or f.endswith(".pyc"):
                        continue
                    fp = Path(root_dir) / f
                    arcname = fp.relative_to(ROOT).as_posix()
                    zf.write(fp, arcname)
                    count += 1

    shutil.copy2(PAYLOAD_ZIP, PORTABLE_ZIP)
    print(f"      Packed {count} files ({PAYLOAD_ZIP.stat().st_size:,} bytes)")


def compile_setup_exe():
    print(f"[2/3] Compiling self-contained Windows installer -> {SETUP_EXE}")
    csc = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    cs_file = str(SRC_NATIVE / "JarvisSetupInstaller.cs")
    ico_file = str(ROOT / "jarvis.ico")
    res_arg = f"/resource:{PAYLOAD_ZIP},payload.zip"

    cmd = [
        csc,
        "/nologo",
        "/target:exe",
        f"/out:{SETUP_EXE}",
        f"/win32icon:{ico_file}",
        res_arg,
        "/r:System.dll",
        "/r:System.Drawing.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.IO.Compression.dll",
        "/r:System.IO.Compression.FileSystem.dll",
        cs_file,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("CSC Error:", proc.stdout, proc.stderr)
        sys.exit(1)
    shutil.copy2(SETUP_EXE, SETUP_V4_EXE)
    print(f"      Compiled {SETUP_EXE.name} & {SETUP_V4_EXE.name} ({SETUP_EXE.stat().st_size:,} bytes)")


def verify_setup_exe():
    print("[3/3] Verifying standalone Windows installer extraction...")
    test_dir = ROOT / "data" / "test_setup_extract"
    if test_dir.exists():
        shutil.rmtree(test_dir, ignore_errors=True)
    try:
        proc = subprocess.run(
            [str(SETUP_EXE), "--verify-install", str(test_dir)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        print(proc.stdout.strip())
        if proc.returncode != 0:
            print("Verify Error:", proc.stderr)
            sys.exit(1)
    finally:
        if test_dir.exists():
            shutil.rmtree(test_dir, ignore_errors=True)
        if PAYLOAD_ZIP.exists():
            PAYLOAD_ZIP.unlink()


if __name__ == "__main__":
    compile_standalone_jarvis_exe()
    build_payload_zip()
    compile_setup_exe()
    verify_setup_exe()
    print("\nALL INSTALLER & STANDALONE ARTIFACTS BUILT AND VERIFIED.")
