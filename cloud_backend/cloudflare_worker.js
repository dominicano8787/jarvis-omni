/**
 * J.A.R.V.I.S. v4.3.0 — 24/7 Cloud Serverless Backend (Cloudflare Worker)
 * =========================================================================
 * Provides zero-PC cloud AI, real ElevenLabs British Male voice synthesis,
 * persistent cross-device memory sync (PC <-> Z Fold 7), live Anime DB,
 * live Finance data, and CompTIA Security+ (SY0-701) APIs.
 *
 * All sensitive API keys live strictly in Cloudflare Worker Secrets
 * (never in GitHub, frontend bundles, or Android APKs).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Jarvis-Token',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_SYSTEM_PROMPT =
  "You are J.A.R.V.I.S., Jonathan's British AI Omni-System running 24/7 in the cloud. Be concise, helpful, technically accurate, and address Jonathan as Sir.";

function sameToken(given, expected) {
  const a = new TextEncoder().encode(String(given));
  const b = new TextEncoder().encode(String(expected));
  let difference = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) difference |= (a[i] ?? 0) ^ b[i];
  return difference === 0;
}

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function sseRes(phase, telemetryText, replyText, engineName, media = undefined) {
  const body =
    `event: telemetry\ndata: ${JSON.stringify({ phase, text: telemetryText })}\n\n` +
    `event: token\ndata: ${JSON.stringify({ text: replyText })}\n\n` +
    `event: complete\ndata: ${JSON.stringify({ status: 'COMPLETE', engine: engineName, media })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
  });
}

async function callCloudLlm(prompt, history, env, preferredEngine) {
  const messages = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      if (h && h.text) {
        messages.push({
          role: h.sender === 'USER' ? 'user' : 'assistant',
          content: String(h.text).slice(0, 1500),
        });
      }
    }
  }
  messages.push({ role: 'user', content: prompt });

  // Status codes and error types only: provider messages are not passed on.
  const failures = [];
  const noteFailure = async (provider, res) => {
    let kind = '';
    try {
      const body = await res.json();
      kind = body?.error?.type || body?.error?.status || '';
    } catch {}
    failures.push(`${provider} ${res.status}${kind ? ` ${kind}` : ''}`);
  };

  // 1. Gemini API (Fastest & lowest latency if GEMINI_API_KEY is configured)
  if (env.GEMINI_API_KEY && preferredEngine !== 'claude-code' && preferredEngine !== 'chatgpt') {
    try {
      // The -latest alias keeps working when Google retires a numbered model.
      const model = env.GEMINI_MODEL || 'gemini-flash-latest';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: DEFAULT_SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
        if (text) return { text: text.trim(), engine: `Cloud Gemini (${model})` };
        failures.push('gemini returned no text');
      } else {
        await noteFailure('gemini', res);
      }
    } catch {
      failures.push('gemini unreachable');
    }
  }

  // 2. Anthropic Claude API (if ANTHROPIC_API_KEY is configured)
  if (env.ANTHROPIC_API_KEY) {
    try {
      const model = env.ANTHROPIC_MODEL || 'claude-opus-5-5';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: DEFAULT_SYSTEM_PROMPT,
          messages,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const blocks = data?.content || [];
        const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
        if (text) return { text: text.trim(), engine: `Cloud Claude (${model})` };
        failures.push(`anthropic returned no text (${data?.stop_reason || 'unknown'})`);
      } else {
        await noteFailure('anthropic', res);
      }
    } catch {
      failures.push('anthropic unreachable');
    }
  }

  // 3. OpenAI API (if OPENAI_API_KEY is configured)
  if (env.OPENAI_API_KEY) {
    try {
      const model = env.OPENAI_MODEL || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...messages],
          temperature: 0.4,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return { text: text.trim(), engine: `Cloud OpenAI (${model})` };
      }
    } catch {}
  }

  // No anonymous free fallback: private conversations go only to providers with our own keys.
  return {
    text: `Cloud Worker is active, Sir, but no AI provider answered. ${failures.length ? `Details: ${failures.join('; ')}.` : 'No provider keys are set in Worker Secrets.'}`,
    engine: 'Jarvis Cloud Core',
  };
}

async function handleTts(text, env) {
  const cleanText = (text || 'Systems online, Sir.').slice(0, 600);
  if (!env.ELEVENLABS_API_KEY) {
    return jsonRes(
      {
        ok: false,
        error: 'ELEVENLABS_API_KEY not configured on cloud worker; client will use OS neural male voice.',
      },
      501
    );
  }

  // Default British Male voice ID ("George" - crisp British male): JBFqnCBsd6RMkjVDRZzb
  const voiceId = env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': env.ELEVENLABS_API_KEY,
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: cleanText,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.55, similarity_boost: 0.8 },
    }),
  });

  if (!res.ok) {
    return jsonRes({ ok: false, error: `ElevenLabs error ${res.status}` }, 502);
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

async function handleMemory(request, path, env) {
  const kvKey = 'jarvis:never_forget:memories';
  let memories = [];
  if (env.JARVIS_KV) {
    try {
      const raw = await env.JARVIS_KV.get(kvKey);
      if (raw) memories = JSON.parse(raw);
    } catch {}
  }

  if (request.method === 'GET') {
    return jsonRes({ ok: true, count: memories.length, sync_status: env.JARVIS_KV ? 'KV_CLOUD_SYNCED' : 'EPHEMERAL', memories });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}

  if (request.method === 'POST' && path.endsWith('/sync')) {
    const incoming = Array.isArray(body.memories) ? body.memories : [];
    const byId = new Map();
    for (const m of memories) byId.set(m.memory_id, m);
    for (const m of incoming) {
      if (m && m.memory_id) {
        const existing = byId.get(m.memory_id);
        if (!existing || (m.version || 1) >= (existing.version || 1)) {
          byId.set(m.memory_id, m);
        }
      }
    }
    memories = Array.from(byId.values());
    if (env.JARVIS_KV) await env.JARVIS_KV.put(kvKey, JSON.stringify(memories));
    return jsonRes({ ok: true, sync_status: 'SYNCHRONIZED', count: memories.length, memories });
  }

  if (request.method === 'POST') {
    const item = {
      memory_id: body.memory_id || `mem-${Date.now().toString(36)}`,
      category: body.category || 'fact',
      key: body.key || String(body.value || '').slice(0, 40),
      value: body.value || body.command || '',
      version: 1,
      pinned: Boolean(body.pinned),
      source_device: body.source_device || 'cloud-client',
      updated_at: new Date().toISOString(),
    };
    memories.unshift(item);
    if (env.JARVIS_KV) await env.JARVIS_KV.put(kvKey, JSON.stringify(memories));
    return jsonRes({ ok: true, action: 'ADDED', memory: item, count: memories.length, memories });
  }

  if (request.method === 'DELETE') {
    const memId = path.split('/').pop();
    memories = memories.filter((m) => m.memory_id !== memId);
    if (env.JARVIS_KV) await env.JARVIS_KV.put(kvKey, JSON.stringify(memories));
    return jsonRes({ ok: true, action: 'DELETED', deleted_id: memId, count: memories.length, memories });
  }

  return jsonRes({ ok: true, memories, count: memories.length });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Every route but the health check spends a private key or reads private memory, so the
    // token is mandatory: with no JARVIS_CLOUD_TOKEN secret the worker refuses, it does not open up.
    if (path !== '/api/health') {
      if (!env.JARVIS_CLOUD_TOKEN) {
        return jsonRes({ ok: false, error: 'Cloud access is not configured: JARVIS_CLOUD_TOKEN is not set' }, 503);
      }
      const provided =
        request.headers.get('X-Jarvis-Token') ||
        (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
        url.searchParams.get('token') ||        // media elements cannot set headers
        '';
      if (!sameToken(provided, env.JARVIS_CLOUD_TOKEN)) {
        return jsonRes({ ok: false, error: 'Unauthorized cloud access' }, 401);
      }
    }

    if (path === '/api/health' || path === '/') {
      return jsonRes({
        ok: true,
        status: 'HEALTHY',
        service: 'J.A.R.V.I.S. 24/7 Cloud Worker',
        version: '4.3.0',
        capabilities: {
          gemini: Boolean(env.GEMINI_API_KEY),
          anthropic: Boolean(env.ANTHROPIC_API_KEY),
          openai: Boolean(env.OPENAI_API_KEY),
          elevenlabs: Boolean(env.ELEVENLABS_API_KEY),
          kv_sync: Boolean(env.JARVIS_KV),
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (path === '/api/status') {
      return jsonRes({
        ok: true,
        status: 'ONLINE',
        principal: 'Jonathan',
        address_as: 'Sir',
        version: '4.3.0-CLOUD-WORKER',
        mode: 'CLOUD_PROXY',
        pc_required: false,
        elevenlabs_enabled: Boolean(env.ELEVENLABS_API_KEY),
      });
    }

    if (path === '/api/chat' && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {}
      const prompt = (body.message || body.prompt || '').trim();
      const result = await callCloudLlm(prompt, body.history, env, body.engine);
      return sseRes('CLOUD_WORKER', `Executing via ${result.engine}...`, result.text, result.engine);
    }

    if (path === '/api/tts/speak' || path === '/api/tts') {
      let text = url.searchParams.get('text') || '';
      if (!text && request.method === 'POST') {
        try {
          const body = await request.json();
          text = body.text || '';
        } catch {}
      }
      return handleTts(text, env);
    }

    if (path.startsWith('/api/memory/never-forget')) {
      return handleMemory(request, path, env);
    }

    if (path.startsWith('/api/anime-db/')) {
      let queryStr = url.searchParams.get('q') || url.searchParams.get('query') || 'Solo Leveling';
      if (request.method === 'POST') {
        try {
          const b = await request.json();
          queryStr = b.query || b.q || queryStr;
        } catch {}
      }
      const gql = `query ($search: String) { Page(page: 1, perPage: 6) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) { id title { romaji english } averageScore status season seasonYear episodes studios(isMain: true) { nodes { name } } coverImage { large } description(asHtml: false) } } }`;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: gql, variables: { search: queryStr } }),
      });
      const data = await res.json();
      const items = (data?.data?.Page?.media || []).map((m) => ({
        anime_id: `anilist-${m.id}`,
        title_english: m.title?.english || m.title?.romaji,
        title_romaji: m.title?.romaji,
        score: m.averageScore ? +(m.averageScore / 10).toFixed(2) : null,
        status: m.status,
        season: `${m.season || ''} ${m.seasonYear || ''}`.trim(),
        episodes: m.episodes,
        studios: (m.studios?.nodes || []).map((s) => s.name),
        cover_image: m.coverImage?.large,
        synopsis: (m.description || '').slice(0, 260),
      }));
      return jsonRes({ ok: true, source: 'AniList Live GraphQL', count: items.length, results: items });
    }

    if (path.startsWith('/api/finance/')) {
      let symbol = (url.searchParams.get('symbol') || 'bitcoin').toLowerCase();
      if (request.method === 'POST') {
        try {
          const b = await request.json();
          symbol = (b.symbol || symbol).toLowerCase();
        } catch {}
      }
      const coinMap = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin' };
      const coinId = coinMap[symbol] || symbol;
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true`
      );
      const cg = await cgRes.json();
      const row = cg?.[coinId];
      return jsonRes({
        ok: true,
        mode: 'INFORMATION_AND_ANALYSIS_ONLY_NO_TRADING',
        symbol: symbol.toUpperCase(),
        price_usd: row?.usd ?? null,
        change_24h_pct: row?.usd_24h_change ? +row.usd_24h_change.toFixed(2) : null,
        risk_disclosure:
          'MANDATORY RISK DISCLOSURE: Information and analysis only. J.A.R.V.I.S. never executes trades. High volatility and drawdown risk apply.',
      });
    }

    return jsonRes({ ok: true, status: 'ONLINE', mode: 'CLOUD_WORKER', path });
  },
};
