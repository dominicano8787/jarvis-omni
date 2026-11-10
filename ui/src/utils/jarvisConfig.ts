/**
 * J.A.R.V.I.S. v4.3.0 — Unified Endpoint Configuration & Connection Tier Manager
 * ==============================================================================
 * Single source of truth: repo-root `config.json` (bundled at build time). The only
 * runtime overrides are values the operator pairs on THIS device (tunnel URL,
 * cloud proxy URL, agent token) — they live in localStorage, never in the bundle.
 *
 * Priority order:
 *   1. cloudBackend  — Cloud proxy (Cloudflare Worker) for ElevenLabs / LLM / Calendar / Gmail
 *   2. localAgent    — Token-authenticated Local PC Agent (same origin, or Cloudflare Tunnel)
 *   3. offlineMode   — Service-worker app shell + browser/OS speech + queued commands
 */

import rawConfig from '../../../config.json';

export type ConnectionMode = 'ONLINE' | 'LOCAL' | 'OFFLINE';
export type Tier = 'cloudBackend' | 'localAgent' | 'offlineMode';

export interface OfflineQueuedCommand {
  id: string;
  command: string;
  endpoint: string;
  payload: any;
  createdAt: string;
  status: 'QUEUED' | 'SYNCED' | 'FAILED';
}

export interface ConnectionSnapshot {
  mode: ConnectionMode;
  activeTier: Tier;
  internetReachable: boolean;
  cloudProxyReachable: boolean;
  localAgentReachable: boolean;
  localAgentBase: string;
  wsAgentConnected: boolean;
  queuedCount: number;
  queuedCommands: OfflineQueuedCommand[];
  lastChecked: string;
}

export const JARVIS_CONFIG = rawConfig;

const LS = {
  token: 'jarvis_agent_token',
  tunnel: 'jarvis_tunnel_url',
  proxy: 'jarvis_cloud_proxy_url',
};

function lsGet(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function lsSet(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

function trimUrl(u: string): string {
  return (u || '').trim().replace(/\/+$/, '');
}

/** True when the page itself is served by the local agent (http://127.0.0.1:8777, LAN IP, etc.). */
export function isServedByLocalAgent(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, port } = window.location;
  return protocol.startsWith('http') && port === String(JARVIS_CONFIG.localAgent.port);
}

class JarvisConnectionManager {
  private snapshot: ConnectionSnapshot = {
    mode: typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'ONLINE',
    activeTier: 'cloudBackend',
    internetReachable: typeof navigator !== 'undefined' ? navigator.onLine : true,
    cloudProxyReachable: false,
    localAgentReachable: false,
    localAgentBase: '',
    wsAgentConnected: false,
    queuedCount: 0,
    queuedCommands: [],
    lastChecked: new Date().toISOString(),
  };

  private listeners: Set<(snap: ConnectionSnapshot) => void> = new Set();
  private ws: WebSocket | null = null;
  private simulateOffline = false;
  private probing = false;
  private nativeFetch: typeof fetch =
    typeof window !== 'undefined' ? window.fetch.bind(window) : (fetch as any);

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.probe());
      window.addEventListener('offline', () => this.probe());
      setTimeout(() => this.probe(), 300);
      setInterval(() => this.probe(), JARVIS_CONFIG.offlineMode.autoRetryIntervalMs || 8000);
    }
  }

  /** The interceptor replaces window.fetch; the manager must keep using the real one. */
  public setNativeFetch(fn: typeof fetch): void {
    this.nativeFetch = fn;
  }

  // ---- operator-paired settings (per device, never bundled) ----------------
  public getAgentToken(): string {
    return lsGet(LS.token);
  }
  public setAgentToken(token: string): void {
    lsSet(LS.token, token.trim());
    this.closeWs();
    this.probe();
  }
  public getTunnelUrl(): string {
    return trimUrl(lsGet(LS.tunnel) || JARVIS_CONFIG.localAgent.tunnelUrl);
  }
  public setTunnelUrl(url: string): void {
    lsSet(LS.tunnel, trimUrl(url));
    this.closeWs();
    this.probe();
  }
  public getCloudProxyUrl(): string {
    return trimUrl(lsGet(LS.proxy) || JARVIS_CONFIG.cloudBackend.cloudProxyUrl);
  }
  public setCloudProxyUrl(url: string): void {
    lsSet(LS.proxy, trimUrl(url));
    this.probe();
  }

  public authHeaders(): Record<string, string> {
    const t = this.getAgentToken();
    return t ? { [JARVIS_CONFIG.localAgent.authHeader]: t } : {};
  }

  public setSimulateOffline(offline: boolean): void {
    this.simulateOffline = offline;
    this.probe();
  }
  public isSimulatedOffline(): boolean {
    return this.simulateOffline;
  }

  public getSnapshot(): ConnectionSnapshot {
    return { ...this.snapshot, queuedCommands: [...this.snapshot.queuedCommands] };
  }

  public subscribe(fn: (snap: ConnectionSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  // ---- offline command queue ----------------------------------------------
  private loadQueue(): void {
    try {
      const raw = localStorage.getItem(JARVIS_CONFIG.offlineMode.queueStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) this.snapshot.queuedCommands = parsed;
    } catch {}
    this.recount();
  }

  private recount(): void {
    this.snapshot.queuedCount = this.snapshot.queuedCommands.filter((c) => c.status === 'QUEUED').length;
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(
        JARVIS_CONFIG.offlineMode.queueStorageKey,
        JSON.stringify(this.snapshot.queuedCommands.slice(0, 50))
      );
    } catch {}
    this.recount();
  }

  public enqueueOfflineCommand(command: string, endpoint = '/api/chat', payload: any = {}): OfflineQueuedCommand {
    const item: OfflineQueuedCommand = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(16).slice(2, 6),
      command,
      endpoint,
      payload,
      createdAt: new Date().toISOString(),
      status: 'QUEUED',
    };
    this.snapshot.queuedCommands = [item, ...this.snapshot.queuedCommands];
    this.saveQueue();
    this.notify();
    return item;
  }

  public clearOfflineQueue(): void {
    this.snapshot.queuedCommands = [];
    this.saveQueue();
    this.notify();
  }

  /** Replays queued commands against the local agent once it is reachable. */
  public async flushOfflineQueue(): Promise<number> {
    const base = this.snapshot.localAgentBase;
    if (!this.snapshot.localAgentReachable) return 0;
    const pending = this.snapshot.queuedCommands.filter((c) => c.status === 'QUEUED').reverse();
    let flushed = 0;
    for (const item of pending) {
      try {
        const res = await this.nativeFetch(`${base}${item.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
          body: JSON.stringify(item.payload || { message: item.command }),
        });
        item.status = res.ok ? 'SYNCED' : 'FAILED';
        if (res.ok) flushed++;
      } catch {
        break;
      }
    }
    if (pending.length) {
      this.saveQueue();
      this.notify();
    }
    return flushed;
  }

  // ---- probing --------------------------------------------------------------
  private async ping(url: string, withAuth: boolean, timeoutMs = 2500): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await this.nativeFetch(url, {
        headers: withAuth ? this.authHeaders() : {},
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Candidate local-agent bases in priority order ('' = same origin). */
  public localAgentCandidates(): string[] {
    const out: string[] = [];
    if (isServedByLocalAgent()) out.push('');
    const tunnel = this.getTunnelUrl();
    if (tunnel) out.push(tunnel);
    return out;
  }

  public async probe(): Promise<ConnectionSnapshot> {
    if (this.probing) return this.getSnapshot();
    this.probing = true;
    try {
      const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      const internet = browserOnline && !this.simulateOffline;

      // Tier 2 first in reachability terms: a LAN/loopback agent works without internet.
      let agentBase = '';
      let agentOk = false;
      const healthPath = JARVIS_CONFIG.localAgent.endpoints.health;
      for (const base of this.localAgentCandidates()) {
        const isTunnel = base !== '';
        if (isTunnel && !internet) continue;
        if (await this.ping(`${base}${healthPath}`, false)) {
          agentBase = base;
          agentOk = true;
          break;
        }
      }

      const proxy = this.getCloudProxyUrl();
      const proxyOk = internet && proxy ? await this.ping(`${proxy}${JARVIS_CONFIG.cloudBackend.endpoints.health}`, false) : false;

      this.snapshot.internetReachable = internet;
      this.snapshot.cloudProxyReachable = proxyOk;
      this.snapshot.localAgentReachable = agentOk;
      this.snapshot.localAgentBase = agentBase;

      if (internet) {
        this.snapshot.mode = 'ONLINE';
        this.snapshot.activeTier = proxyOk ? 'cloudBackend' : agentOk ? 'localAgent' : 'cloudBackend';
      } else if (agentOk) {
        this.snapshot.mode = 'LOCAL';
        this.snapshot.activeTier = 'localAgent';
      } else {
        this.snapshot.mode = 'OFFLINE';
        this.snapshot.activeTier = 'offlineMode';
      }
      this.snapshot.lastChecked = new Date().toISOString();

      if (agentOk) {
        this.ensureAgentWebSocket();
        await this.flushOfflineQueue();
      } else {
        this.closeWs();
      }
      this.notify();
      return this.getSnapshot();
    } finally {
      this.probing = false;
    }
  }

  // ---- token-authenticated agent WebSocket ---------------------------------
  private wsUrl(): string {
    const base = this.snapshot.localAgentBase || (typeof window !== 'undefined' ? window.location.origin : '');
    const wsBase = base.replace(/^http/, 'ws');
    const token = encodeURIComponent(this.getAgentToken());
    return `${wsBase}${JARVIS_CONFIG.localAgent.endpoints.wsAgent}?token=${token}`;
  }

  private closeWs(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    this.ws = null;
    this.snapshot.wsAgentConnected = false;
  }

  public ensureAgentWebSocket(): void {
    if (typeof window === 'undefined' || this.ws || !this.getAgentToken()) return;
    try {
      const ws = new WebSocket(this.wsUrl());
      this.ws = ws;
      ws.onopen = () => {
        this.snapshot.wsAgentConnected = true;
        this.notify();
      };
      ws.onclose = () => {
        this.snapshot.wsAgentConnected = false;
        this.ws = null;
        this.notify();
      };
      ws.onerror = () => {
        this.snapshot.wsAgentConnected = false;
      };
    } catch {
      this.ws = null;
    }
  }

  /**
   * Sends a PC-control command to the local agent. Uses the WebSocket when open,
   * otherwise HTTPS POST; queues the command when the agent is unreachable.
   * Never reports success unless the agent actually answered.
   */
  public async sendPcControlCommand(action: string, params: Record<string, any> = {}): Promise<any> {
    const endpoint = JARVIS_CONFIG.localAgent.endpoints.pcControl;
    const payload = { action, params };
    if (!this.getAgentToken()) {
      return { ok: false, error: 'Agent not paired: set the agent token (PAIR AGENT button).' };
    }
    if (!this.snapshot.localAgentReachable) {
      const q = this.enqueueOfflineCommand(`PC Control: ${action}`, endpoint, payload);
      return { ok: false, queued: true, queue_id: q.id, message: `Local agent unreachable; '${action}' queued.` };
    }
    try {
      const res = await this.nativeFetch(`${this.snapshot.localAgentBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (e: any) {
      const q = this.enqueueOfflineCommand(`PC Control: ${action}`, endpoint, payload);
      return { ok: false, queued: true, queue_id: q.id, message: e?.message || 'network error' };
    }
  }
}

export const jarvisConnection = new JarvisConnectionManager();
