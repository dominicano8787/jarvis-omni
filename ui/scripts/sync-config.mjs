// Copies the single source of truth (repo-root config.json) into ui/public so it is
// served at ./config.json and cached by the service worker. ui/public/config.json is
// a generated file (gitignored) -- edit D:\Jarvis\config.json, never the copy.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', '..', 'config.json');
const dst = resolve(here, '..', 'public', 'config.json');
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`[sync-config] ${src} -> ${dst}`);

