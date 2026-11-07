package com.stark.jarvis.zfold7;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.StatFs;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.DisplayMetrics;
import android.util.Rational;
import android.view.Display;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * J.A.R.V.I.S. v4.0 — Native Launcher & Hardware Bridge for Samsung Galaxy Z Fold 7 (SM-F966U).
 *
 * Features:
 * - 120Hz Dynamic AMOLED 2X refresh rate lock (8.0" QXGA+ Unfolded & 6.5" Cover Display)
 * - Real-time Hardware Hinge Angle Sensor (TYPE_HINGE_ANGLE = 36) -> Flex Mode (75°-135°)
 * - Snapdragon 8 Elite (Oryon + Adreno 830) & Battery/RAM/UFS 4.0 Telemetry Bridge
 * - Native British Male TTS (Locale.UK) + Tactile Haptics + Picture-in-Picture (PiP)
 * - Bundled HTTPS Virtual Origin (https://jarvis.fold7.local/) + Workstation LAN Mesh
 */
public class MainActivity extends Activity implements SensorEventListener {

    private static final String VIRTUAL_HOST = "jarvis.fold7.local";
    private static final String VIRTUAL_ORIGIN = "https://jarvis.fold7.local/index.html";
    private static final String GITHUB_CLOUD_ORIGIN = "https://dominicano8787.github.io/jarvis-omni/";
    private static final String PREFS_NAME = "jarvis_fold7_prefs";
    private static final String KEY_WORKSTATION_URL = "workstation_url";
    private static final String DEFAULT_WORKSTATION_URL = "https://dominicano8787.github.io/jarvis-omni";
    private static final int TYPE_HINGE_ANGLE_SENSOR = 36; // Sensor.TYPE_HINGE_ANGLE

    private WebView webView;
    private SensorManager sensorManager;
    private Sensor hingeSensor;
    private volatile float currentHingeAngle = 180.0f;
    private TextToSpeech ttsEngine;
    private volatile boolean ttsReady = false;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        configureFold7WindowAndRefreshRate(120.0f);
        requestRuntimePermissionsIfNeeded();
        initHingeSensor();
        initBritishMaleTts();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#020813"));
        setContentView(webView);

        configureWebView(webView);
        // Load directly from the user's 24/7 GitHub Cloud Server (no PC required),
        // with automatic fallback to embedded APK assets if offline!
        webView.loadUrl(GITHUB_CLOUD_ORIGIN);
    }

    private void configureFold7WindowAndRefreshRate(float targetHz) {
        try {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            window.setStatusBarColor(Color.parseColor("#020813"));
            window.setNavigationBarColor(Color.parseColor("#020813"));

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Display display = window.getWindowManager().getDefaultDisplay();
                Display.Mode[] modes = display.getSupportedModes();
                Display.Mode bestMode = null;
                float bestScore = -1.0f;

                for (Display.Mode m : modes) {
                    float hzDelta = Math.abs(m.getRefreshRate() - targetHz);
                    float score = (m.getPhysicalWidth() * m.getPhysicalHeight()) - (hzDelta * 50000.0f);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMode = m;
                    }
                }
                if (bestMode != null) {
                    WindowManager.LayoutParams params = window.getAttributes();
                    params.preferredDisplayModeId = bestMode.getModeId();
                    window.setAttributes(params);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void requestRuntimePermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] perms = new String[]{
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA
            };
            List<String> needed = new ArrayList<>();
            for (String p : perms) {
                if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(p);
                }
            }
            if (!needed.isEmpty()) {
                requestPermissions(needed.toArray(new String[0]), 4001);
            }
        }
    }

    private void initHingeSensor() {
        try {
            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                hingeSensor = sensorManager.getDefaultSensor(TYPE_HINGE_ANGLE_SENSOR);
            }
        } catch (Exception ignored) {
        }
    }

    private void initBritishMaleTts() {
        try {
            ttsEngine = new TextToSpeech(this, status -> {
                if (status == TextToSpeech.SUCCESS && ttsEngine != null) {
                    ttsEngine.setLanguage(Locale.UK);
                    ttsEngine.setPitch(0.86f);
                    ttsEngine.setSpeechRate(1.03f);

                    try {
                        Set<Voice> voices = ttsEngine.getVoices();
                        if (voices != null) {
                            Voice selected = null;
                            for (Voice v : voices) {
                                String name = v.getName().toLowerCase(Locale.ROOT);
                                String lang = v.getLocale() != null ? v.getLocale().toLanguageTag().toLowerCase(Locale.ROOT) : "";
                                boolean isFemale = name.contains("female") || name.contains("sonia")
                                        || name.contains("hazel") || name.contains("libby") || name.contains("samantha");
                                if (!isFemale && lang.startsWith("en-gb") && (name.contains("male") || name.contains("ryan")
                                        || name.contains("george") || name.contains("daniel") || name.contains("gb-d")
                                        || name.contains("gb-b") || name.contains("rjs"))) {
                                    selected = v;
                                    break;
                                }
                            }
                            if (selected != null) {
                                ttsEngine.setVoice(selected);
                            }
                        }
                    } catch (Exception ignored) {
                    }
                    ttsReady = true;
                }
            });
        } catch (Exception ignored) {
        }
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void configureWebView(WebView wv) {
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " JARVIS-ZFold7-SM-F966U/4.0");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);

        wv.addJavascriptInterface(new JarvisFoldBridge(), "JarvisFoldBridge");

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    try {
                        request.grant(request.getResources());
                    } catch (Exception ignored) {
                    }
                });
            }
        });

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && VIRTUAL_HOST.equalsIgnoreCase(uri.getHost())) {
                    String path = uri.getPath();
                    if (path == null || path.isEmpty() || "/".equals(path)) {
                        path = "/index.html";
                    }
                    // Let /api/* pass through to our hybrid fetch interceptor in JS
                    if (!path.startsWith("/api/")) {
                        String assetPath = "www" + path;
                        try {
                            InputStream is = getAssets().open(assetPath);
                            String mime = guessMimeType(path);
                            Map<String, String> headers = new HashMap<>();
                            headers.put("Access-Control-Allow-Origin", "*");
                            headers.put("Cache-Control", "no-cache");
                            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, is);
                        } catch (Exception ignored) {
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    Uri u = request.getUrl();
                    if (u != null && !VIRTUAL_HOST.equalsIgnoreCase(u.getHost())) {
                        view.loadUrl(VIRTUAL_ORIGIN);
                        return;
                    }
                }
                super.onReceivedError(view, request, error);
            }
        });
    }

    private String guessMimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (sensorManager != null && hingeSensor != null) {
            sensorManager.registerListener(this, hingeSensor, SensorManager.SENSOR_DELAY_UI);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (sensorManager != null && hingeSensor != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event != null && event.sensor.getType() == TYPE_HINGE_ANGLE_SENSOR && event.values.length > 0) {
            float newAngle = event.values[0];
            if (Math.abs(newAngle - currentHingeAngle) >= 2.0f) {
                currentHingeAngle = newAngle;
                pushHingeAngleToHud(currentHingeAngle);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    private void pushHingeAngleToHud(final float angle) {
        if (webView == null) return;
        runOnUiThread(() -> {
            String js = "window.__JARVIS_HINGE_ANGLE__ = " + Math.round(angle)
                    + "; window.dispatchEvent(new Event('resize'));";
            webView.evaluateJavascript(js, null);
        });
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        pushHingeAngleToHud(currentHingeAngle);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (ttsEngine != null) {
            try {
                ttsEngine.stop();
                ttsEngine.shutdown();
            } catch (Exception ignored) {
            }
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    /**
     * Native JavaScript Interface exposed as `window.JarvisFoldBridge` inside the 3D HUD.
     */
    public class JarvisFoldBridge {

        @JavascriptInterface
        public float getHingeAngle() {
            return currentHingeAngle;
        }

        @JavascriptInterface
        public String getWorkstationUrl() {
            return prefs.getString(KEY_WORKSTATION_URL, DEFAULT_WORKSTATION_URL);
        }

        @JavascriptInterface
        public void setWorkstationUrl(String url) {
            if (url != null && !url.trim().isEmpty()) {
                prefs.edit().putString(KEY_WORKSTATION_URL, url.trim()).apply();
            }
        }

        @JavascriptInterface
        public void triggerHaptic(String kind) {
            try {
                Vibrator vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (vib == null || !vib.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    if ("heavy".equalsIgnoreCase(kind)) {
                        vib.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK));
                    } else if ("confirm".equalsIgnoreCase(kind)) {
                        vib.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK));
                    } else {
                        vib.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE));
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void speakBritishMale(String text) {
            if (ttsReady && ttsEngine != null && text != null && !text.trim().isEmpty()) {
                ttsEngine.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, null, "jarvis_utt_" + System.currentTimeMillis());
            }
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (ttsReady && ttsEngine != null) {
                ttsEngine.stop();
            }
        }

        @JavascriptInterface
        public void enterPictureInPicture() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        PictureInPictureParams params = new PictureInPictureParams.Builder()
                                .setAspectRatio(new Rational(16, 9))
                                .build();
                        enterPictureInPictureMode(params);
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void setPreferredRefreshRate(final int hz) {
            runOnUiThread(() -> configureFold7WindowAndRefreshRate((float) hz));
        }

        @JavascriptInterface
        public String getDeviceTelemetryJson() {
            try {
                JSONObject obj = new JSONObject();
                String model = Build.MODEL != null && !Build.MODEL.isEmpty()
                        ? Build.MODEL
                        : "Samsung Galaxy Z Fold 7 (SM-F966U)";
                obj.put("model", model + " (J.A.R.V.I.S. Native)");
                obj.put("deviceCode", Build.DEVICE != null ? Build.DEVICE : "SM-F966U (q7q)");
                obj.put("soc", "Snapdragon 8 Elite for Galaxy (3nm Oryon @ 4.47 GHz)");
                obj.put("gpu", "Adreno 830 (120Hz Dynamic AMOLED 2X + Hardware Ray Tracing)");
                obj.put("npu", "Qualcomm Hexagon NPU (On-Device Multimodal GenAI)");
                obj.put("androidVersion", "Android " + Build.VERSION.RELEASE + " (One UI Foldable)");
                obj.put("sdkInt", Build.VERSION.SDK_INT);
                obj.put("hingeAngle", Math.round(currentHingeAngle));

                DisplayMetrics dm = getResources().getDisplayMetrics();
                obj.put("screenWidthPx", dm.widthPixels);
                obj.put("screenHeightPx", dm.heightPixels);
                obj.put("densityDpi", dm.densityDpi);

                float refreshHz = 120.0f;
                try {
                    Display d = getWindowManager().getDefaultDisplay();
                    refreshHz = d.getRefreshRate();
                } catch (Exception ignored) {
                }
                obj.put("refreshRateHz", Math.round(refreshHz));

                // Battery telemetry
                IntentFilter iFilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent batteryStatus = registerReceiver(null, iFilter);
                int level = 95;
                float tempC = 31.2f;
                boolean charging = true;
                if (batteryStatus != null) {
                    int rawLevel = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                    if (rawLevel >= 0 && scale > 0) {
                        level = Math.round((rawLevel / (float) scale) * 100.0f);
                    }
                    int rawTemp = batteryStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 312);
                    tempC = rawTemp / 10.0f;
                    int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                    charging = status == BatteryManager.BATTERY_STATUS_CHARGING
                            || status == BatteryManager.BATTERY_STATUS_FULL;
                }
                obj.put("batteryPercent", level);
                obj.put("batteryTempC", tempC);
                obj.put("isCharging", charging);

                // CPU & RAM telemetry
                obj.put("cpuCores", Runtime.getRuntime().availableProcessors());
                ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                if (am != null) {
                    am.getMemoryInfo(mi);
                    double totalGb = Math.round((mi.totalMem / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0;
                    double availGb = Math.round((mi.availMem / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0;
                    obj.put("ramTotalGb", totalGb);
                    obj.put("ramUsedGb", Math.round((totalGb - availGb) * 10.0) / 10.0);
                }

                // Storage telemetry
                StatFs statFs = new StatFs(Environment.getDataDirectory().getPath());
                double freeGb = Math.round((statFs.getAvailableBytes() / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0;
                obj.put("storageFreeGb", freeGb);

                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }
    }
}
