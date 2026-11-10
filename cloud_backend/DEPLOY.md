# Deploying J.A.R.V.I.S. 24/7 Cloud Backend (Zero PC Required)

To let your phone (Samsung Galaxy Z Fold 7) and GitHub Pages site (`https://dominicano8787.github.io/jarvis-omni/`) use real AI models (Gemini / Claude), ElevenLabs voice, and cross-device memory sync without keeping your PC turned on — and **without ever shipping API keys in the APK or frontend bundle** — deploy this free Cloudflare Worker:

## 1. Login & Deploy Worker
```powershell
cd D:\Jarvis\cloud_backend
npx wrangler login
npx wrangler deploy
```
This gives you a permanent HTTPS URL such as `https://jarvis-omni-cloud.<your-subdomain>.workers.dev`.

## 2. Store Your Private API Keys in Cloudflare Secrets
Run whichever keys you use (they are encrypted inside Cloudflare, never committed to GitHub):
```powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put JARVIS_CLOUD_TOKEN
```

## 3. Enable Persistent PC <-> Phone Memory Sync (Optional, Free)
```powershell
npx wrangler kv namespace create JARVIS_KV
```
Copy the `id` printed into `wrangler.toml`, uncomment the `[[kv_namespaces]]` block, and run `npx wrangler deploy` again.

## 4. Pair Your Phone or Browser
Open J.A.R.V.I.S. on your phone or browser, tap **CLOUD / PAIR** in the top bar, paste your Worker URL (or put it in `config.json` -> `cloudBackend.cloudProxyUrl`), and J.A.R.V.I.S. will route live AI + ElevenLabs + Synced Memory straight through the cloud!
