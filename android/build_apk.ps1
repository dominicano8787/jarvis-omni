$ErrorActionPreference = "Stop"

# Force all temporary files onto D:\Jarvis\data\tmp where 240+ GB is available
$env:TEMP = "D:\Jarvis\data\tmp"
$env:TMP = "D:\Jarvis\data\tmp"
New-Item -ItemType Directory -Force -Path "D:\Jarvis\data\tmp" | Out-Null

$JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:JAVA_HOME = $JAVA_HOME
$JAVAC = Join-Path $JAVA_HOME "bin\javac.exe"
$JAR = Join-Path $JAVA_HOME "bin\jar.exe"
$KEYTOOL = Join-Path $JAVA_HOME "bin\keytool.exe"

$SDK_DIR = "D:\Android\Sdk"
$ANDROID_JAR = Join-Path $SDK_DIR "platforms\android-35\android.jar"
$BUILD_TOOLS = Join-Path $SDK_DIR "build-tools\35.0.0"
$AAPT2 = Join-Path $BUILD_TOOLS "aapt2.exe"
$D8 = Join-Path $BUILD_TOOLS "d8.bat"
$ZIPALIGN = Join-Path $BUILD_TOOLS "zipalign.exe"
$APKSIGNER = Join-Path $BUILD_TOOLS "apksigner.bat"

$PROJ_DIR = "D:\Jarvis\android"
$BUILD_DIR = Join-Path $PROJ_DIR "build"
$GEN_DIR = Join-Path $BUILD_DIR "gen"
$CLASSES_DIR = Join-Path $BUILD_DIR "classes"
$DEX_DIR = Join-Path $BUILD_DIR "dex"
$ASSETS_WWW = Join-Path $PROJ_DIR "assets\www"
$KEYSTORE_DIR = Join-Path $PROJ_DIR "keystore"
$KEYSTORE_FILE = Join-Path $KEYSTORE_DIR "jarvis_fold7.jks"
$FINAL_APK = "D:\Jarvis\JARVIS-ZFold7-SM-F966U-v4.0.apk"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  J.A.R.V.I.S. v4.0 -- SAMSUNG GALAXY Z FOLD 7 (SM-F966U) APK BUILD" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Clean and recreate build directories
if (Test-Path $BUILD_DIR) {
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Force -Path $GEN_DIR, $CLASSES_DIR, $DEX_DIR, $ASSETS_WWW, $KEYSTORE_DIR | Out-Null

# 1. Sync latest 3D HUD production bundle into assets/www
Write-Host "[1/7] Bundling J.A.R.V.I.S. 3D HUD and Fold 7 Adaptive Assets..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$ASSETS_WWW\*" -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force "D:\Jarvis\ui\dist\*" $ASSETS_WWW

# 2. Compile Android resources with aapt2
Write-Host "[2/7] Compiling Android resources with aapt2..." -ForegroundColor Yellow
$COMPILED_RES = Join-Path $BUILD_DIR "compiled_res.zip"
& $AAPT2 compile --dir (Join-Path $PROJ_DIR "res") -o $COMPILED_RES
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

# 3. Link resources, AndroidManifest.xml, and assets into base APK + generate R.java
Write-Host "[3/7] Linking AndroidManifest.xml, 120Hz Foldable Config and HUD Assets..." -ForegroundColor Yellow
$UNALIGNED_APK = Join-Path $BUILD_DIR "unaligned.apk"
& $AAPT2 link `
    -I $ANDROID_JAR `
    --manifest (Join-Path $PROJ_DIR "AndroidManifest.xml") `
    -A (Join-Path $PROJ_DIR "assets") `
    --java $GEN_DIR `
    --auto-add-overlay `
    -o $UNALIGNED_APK `
    $COMPILED_RES
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

# 4. Compile Java sources (MainActivity.java + R.java) against API 35 android.jar
Write-Host "[4/7] Compiling Native Z Fold 7 Hardware Bridge (MainActivity.java)..." -ForegroundColor Yellow
$R_JAVA = Join-Path $GEN_DIR "com\stark\jarvis\zfold7\R.java"
$MAIN_JAVA = Join-Path $PROJ_DIR "src\com\stark\jarvis\zfold7\MainActivity.java"
& $JAVAC --release 17 -encoding UTF-8 -cp $ANDROID_JAR -d $CLASSES_DIR $R_JAVA $MAIN_JAVA
if ($LASTEXITCODE -ne 0) { throw "javac compilation failed" }

# 5. Convert compiled .class files into Dalvik bytecode (classes.dex) using d8
Write-Host "[5/7] Compiling Dalvik DEX bytecode with d8..." -ForegroundColor Yellow
$CLASSES_JAR = Join-Path $BUILD_DIR "classes.jar"
& $JAR --create --file $CLASSES_JAR -C $CLASSES_DIR .
if ($LASTEXITCODE -ne 0) { throw "jar creation failed" }

& $D8 --min-api 29 --lib $ANDROID_JAR --output $DEX_DIR $CLASSES_JAR
if ($LASTEXITCODE -ne 0) { throw "d8 dex compilation failed" }

$CLASSES_DEX = Join-Path $DEX_DIR "classes.dex"
if (-not (Test-Path $CLASSES_DEX)) { throw "classes.dex was not generated" }

# Inject classes.dex into unaligned.apk
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($UNALIGNED_APK, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $CLASSES_DEX, "classes.dex", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null

    # aapt2 on Windows stores asset paths with backslashes ("assets/www\index.html").
    # Android looks entries up with forward slashes, so getAssets().open("www/index.html")
    # fails and the offline fallback has nothing to serve. Rewrite the names.
    $bad = @($zip.Entries | Where-Object { $_.FullName.Contains('\') })
    foreach ($entry in $bad) {
        $fixed = $zip.CreateEntry($entry.FullName.Replace('\', '/'), [System.IO.Compression.CompressionLevel]::Optimal)
        $src = $entry.Open(); $dst = $fixed.Open()
        try { $src.CopyTo($dst) } finally { $dst.Dispose(); $src.Dispose() }
        $entry.Delete()
    }
    if ($bad.Count) { Write-Host ("      normalised {0} asset path(s) to forward slashes" -f $bad.Count) }
} finally {
    $zip.Dispose()
}

# 6. Zipalign APK on 4-byte boundaries
Write-Host "[6/7] Aligning APK with zipalign..." -ForegroundColor Yellow
$ALIGNED_APK = Join-Path $BUILD_DIR "aligned.apk"
& $ZIPALIGN -f -p 4 $UNALIGNED_APK $ALIGNED_APK
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

# 7. Sign APK with Release Key (v1 + v2 + v3 schemes)
Write-Host "[7/7] Signing APK with apksigner (v1+v2+v3) and Verifying..." -ForegroundColor Yellow
$KEYSTORE_PASS_FILE = Join-Path $KEYSTORE_DIR "keystore.key"
$KEYSTORE_PASS = $env:JARVIS_KEYSTORE_PASSWORD
if (-not $KEYSTORE_PASS -and (Test-Path $KEYSTORE_PASS_FILE)) {
    $KEYSTORE_PASS = (Get-Content -Raw $KEYSTORE_PASS_FILE).Trim()
}
if (-not $KEYSTORE_PASS) {
    throw "Keystore password not set. Set `$env:JARVIS_KEYSTORE_PASSWORD or create gitignored $KEYSTORE_PASS_FILE."
}

if (-not (Test-Path $KEYSTORE_FILE)) {
    & $KEYTOOL -genkeypair `
        -v `
        -keystore $KEYSTORE_FILE `
        -alias jarvis_fold7 `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass $KEYSTORE_PASS `
        -keypass $KEYSTORE_PASS `
        -dname "CN=J.A.R.V.I.S. Z Fold 7, OU=Stark Industries, O=Stark Industries, L=Malibu, ST=CA, C=US"
}

& $APKSIGNER sign `
    --ks $KEYSTORE_FILE `
    --ks-key-alias jarvis_fold7 `
    --ks-pass "pass:$KEYSTORE_PASS" `
    --key-pass "pass:$KEYSTORE_PASS" `
    --v1-signing-enabled true `
    --v2-signing-enabled true `
    --v3-signing-enabled true `
    --out $FINAL_APK `
    $ALIGNED_APK
if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed" }

& $APKSIGNER verify --verbose $FINAL_APK
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed" }

$apkInfo = Get-Item $FINAL_APK
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ("  SUCCESS: {0} ({1:N0} bytes)" -f $apkInfo.FullName, $apkInfo.Length) -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
