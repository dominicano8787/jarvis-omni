import { agentMediaUrl } from '../utils/jarvisConfig';
/**
 * Dedicated Command Center panels for the Phase 1-3 engines:
 *  - SecPlusDojoPanel   -> /api/secplus/*            (server/security_plus_rag.py)
 *  - MemoryManagerPanel -> /api/memory/never-forget* (server/long_term_memory.py)
 *  - AnimePanel         -> /api/anime-db/*, /api/anime-studio/* (anime_db_engine.py, anime_studio_engine.py)
 *  - FinancePanel       -> /api/finance/*            (server/finance_engine.py)
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, Trash2, Save, Pin, PinOff, Plus, AlertTriangle } from 'lucide-react';
import { sound } from '../utils/sound';

type MediaCb = (media: { type: 'image' | 'video' | 'audio'; url: string; asset?: any }) => void;

function useCompactWidth(breakpoint = 780): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return compact;
}

// ---------------------------------------------------------------------------
// Shared helpers & styles
// ---------------------------------------------------------------------------
async function apiJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}
const postJson = (url: string, body: any, method = 'POST') =>
  apiJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const card: React.CSSProperties = {
  background: 'rgba(8, 20, 40, 0.75)',
  border: '1px solid rgba(0, 240, 255, 0.22)',
  borderRadius: '8px',
  padding: '14px',
  overflow: 'auto',
};
const input: React.CSSProperties = {
  background: 'rgba(2, 8, 20, 0.9)',
  border: '1px solid rgba(0, 240, 255, 0.3)',
  color: '#e2f1ff',
  borderRadius: '5px',
  padding: '7px 10px',
  fontSize: '12px',
  outline: 'none',
};
const btn = (color = '#00f0ff'): React.CSSProperties => ({
  background: `${color}22`,
  border: `1px solid ${color}`,
  color: '#ffffff',
  borderRadius: '5px',
  padding: '7px 12px',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
});
const h = (color = '#00f0ff'): React.CSSProperties => ({
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '1.5px',
  color,
  marginBottom: '10px',
});
const ErrorLine: React.FC<{ msg: string }> = ({ msg }) =>
  msg ? (
    <div style={{ color: '#fca5a5', fontSize: '11px', marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
      <AlertTriangle size={12} /> {msg}
    </div>
  ) : null;

// ===========================================================================
// 1. SECURITY+ SY0-701 DOJO
// ===========================================================================
export const SecPlusDojoPanel: React.FC = () => {
  const compact = useCompactWidth();
  const [status, setStatus] = useState<any>(null);
  const [labs, setLabs] = useState<any[]>([]);
  const [query, setQuery] = useState('Zero Trust Policy Decision Point');
  const [lesson, setLesson] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cmd, setCmd] = useState('nmap -sS -sV -O --script vuln 127.0.0.1');
  const [cmdResult, setCmdResult] = useState<any>(null);
  const [view, setView] = useState<'teach' | 'quiz' | 'labs' | 'cmd'>('teach');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiJson('/api/secplus/status').then(setStatus).catch((e) => setErr(e.message));
    apiJson('/api/secplus/labs').then((d) => setLabs(d.labs || [])).catch(() => {});
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      sound.playConfirm();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const teach = () => run(async () => setLesson(await postJson('/api/secplus/teach', { topic: query })));
  const loadQuiz = () =>
    run(async () => {
      const d = await apiJson('/api/secplus/quiz?count=20');
      setQuestions(d.questions || []);
      setAnswers({});
    });
  const explain = () => run(async () => setCmdResult(await postJson('/api/secplus/explain-command', { command: cmd })));

  const answered = Object.keys(answers).length;
  const correct = questions.filter((q) => answers[q.id] === q.answer).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '300px 1fr', gap: compact ? '12px' : '18px', width: '100%', height: '100%', overflowY: compact ? 'auto' : 'visible' }}>
      <div style={card}>
        <div style={h()}>COMPTIA SECURITY+ DOJO</div>
        {status?.exam ? (
          <div className="font-mono" style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7 }}>
            <div>Exam: <b style={{ color: '#e2f1ff' }}>{status.exam.exam_code}</b></div>
            <div>LabEx labs: {status.labex_labs_count}</div>
            <div>Objectives: {status.objectives_count}</div>
            <div>Indexed docs: {status.rag_counts?.total_documents ?? '—'}</div>
            <div>Practice questions: {status.practice_questions_count}</div>
            <div style={{ marginTop: '8px' }}>
              {status.exam.domains?.map((d: any) => (
                <div key={d.id}>{d.id} {d.name} ({d.weight_pct}%)</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Loading exam index…</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px' }}>
          {(['teach', 'quiz', 'labs', 'cmd'] as const).map((v) => (
            <button key={v} style={btn(view === v ? '#10b981' : '#334155')} onClick={() => { setView(v); if (v === 'quiz' && !questions.length) loadQuiz(); }}>
              {{ teach: 'Teach me a topic', quiz: 'Practice quiz', labs: 'LabEx labs (14)', cmd: 'Explain a command' }[v]}
            </button>
          ))}
        </div>
        <ErrorLine msg={err} />
      </div>

      <div style={card}>
        {view === 'teach' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input style={{ ...input, flex: 1 }} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && teach()} placeholder="e.g. DMARC, RAID 5, order of volatility, ALE" />
              <button style={btn()} onClick={teach} disabled={busy}><Search size={13} /> {busy ? 'Searching…' : 'Teach'}</button>
            </div>
            {lesson?.matches?.map((m: any) => (
              <div key={m.doc_id} style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', padding: '10px 0' }}>
                <div style={{ color: '#00f0ff', fontWeight: 700, fontSize: '12px' }}>{m.title}</div>
                <pre className="font-mono" style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#cbd5e1', margin: '6px 0' }}>{m.content}</pre>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Source: {m.source_citation}</div>
              </div>
            ))}
          </>
        )}

        {view === 'quiz' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={h('#10b981')}>PRACTICE QUIZ — {answered}/{questions.length} answered, {correct} correct</div>
              <button style={btn('#10b981')} onClick={loadQuiz}><RefreshCw size={12} /> Reset</button>
            </div>
            {questions.map((q) => {
              const picked = answers[q.id];
              return (
                <div key={q.id} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#e2f1ff', marginBottom: '6px' }}><b>{q.id}</b> ({q.objective}) {q.question}</div>
                  {q.options.map((o: string) => {
                    const letter = o.charAt(0);
                    const isRight = letter === q.answer;
                    const bg = !picked ? 'rgba(15,23,42,0.6)' : isRight ? 'rgba(16,185,129,0.25)' : picked === letter ? 'rgba(239,68,68,0.25)' : 'rgba(15,23,42,0.6)';
                    return (
                      <div key={o} onClick={() => !picked && setAnswers({ ...answers, [q.id]: letter })} style={{ background: bg, padding: '6px 10px', borderRadius: '4px', margin: '3px 0', fontSize: '11px', cursor: picked ? 'default' : 'pointer' }}>
                        {o}
                      </div>
                    );
                  })}
                  {picked && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{q.explanation}</div>}
                </div>
              );
            })}
          </>
        )}

        {view === 'labs' && labs.map((l) => (
          <div key={l.index} style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#00f0ff', fontWeight: 700, fontSize: '12px' }}>Lab {l.index}: {l.title}</span>
              <a href={l.url} target="_blank" rel="noreferrer" style={{ color: '#10b981', fontSize: '11px' }}>Open on LabEx ↗</a>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Objectives {l.objectives?.join(', ')}</div>
            <pre className="font-mono" style={{ fontSize: '10px', color: '#cbd5e1', whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{l.commands?.map((c: string) => `$ ${c}`).join('\n')}</pre>
          </div>
        ))}

        {view === 'cmd' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input style={{ ...input, flex: 1 }} className="font-mono" value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && explain()} />
              <button style={btn()} onClick={explain} disabled={busy}>Explain</button>
            </div>
            {cmdResult && (
              <div style={{ fontSize: '12px', lineHeight: 1.7 }}>
                <div>{cmdResult.summary}</div>
                <div>Objective: <b>{cmdResult.sy0_701_objective}</b></div>
                <div>Lab: {cmdResult.labex_reference}</div>
                <div style={{ color: '#fbbf24' }}>Risk: {cmdResult.risk_level}</div>
                {cmdResult.parsed_flags?.map((f: any) => (
                  <div key={f.flag} className="font-mono" style={{ fontSize: '11px' }}><span style={{ color: '#00f0ff' }}>{f.flag}</span> — {f.meaning}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// 2. NEVER-FORGET MEMORY MANAGER
// ===========================================================================
export const MemoryManagerPanel: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [newVal, setNewVal] = useState('');
  const [newCat, setNewCat] = useState('fact');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const d = await apiJson(`/api/memory/never-forget?limit=200${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      setItems(d.memories || []);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const act = async (fn: () => Promise<any>, ok: string) => {
    setErr('');
    try {
      await fn();
      setMsg(ok);
      sound.playConfirm();
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div style={{ ...card, width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={h('#b026ff')}>NEVER-FORGET MEMORY VAULT — {items.length} items</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input style={input} placeholder="Search memories…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <button style={btn('#b026ff')} onClick={load}><Search size={12} /> Search</button>
          <button style={btn('#10b981')} onClick={() => act(() => postJson('/api/memory/never-forget/sync', { client_device: 'command-center-ui', memories: items }), 'Sync complete')}>
            <RefreshCw size={12} /> Sync
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '10px 0 14px', flexWrap: 'wrap' }}>
        <select style={input} value={newCat} onChange={(e) => setNewCat(e.target.value)}>
          {['fact', 'preference', 'project', 'anime_project', 'security_study', 'device_state'].map((c) => <option key={c}>{c}</option>)}
        </select>
        <input style={{ ...input, flex: 1 }} placeholder="New memory, e.g. 'I prefer dark-mode anime storyboards'" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
        <button style={btn('#00f0ff')} disabled={!newVal.trim()} onClick={() => act(async () => { await postJson('/api/memory/never-forget', { value: newVal, category: newCat, source_device: 'command-center-ui' }); setNewVal(''); }, 'Memory added')}>
          <Plus size={12} /> Add
        </button>
      </div>
      {msg && <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '8px' }}>{msg}</div>}
      <ErrorLine msg={err} />

      <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '540px' }}>
        <thead>
          <tr style={{ color: '#64748b', textAlign: 'left' }}>
            <th style={{ padding: '6px' }}>ID</th><th>Category</th><th>Key</th><th style={{ width: '45%' }}>Value</th><th>Ver</th><th>Device</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const isEditing = editing[m.memory_id] !== undefined;
            return (
              <tr key={m.memory_id} style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                <td className="font-mono" style={{ padding: '6px', color: '#00f0ff' }}>{m.memory_id}</td>
                <td>{m.category}</td>
                <td>{m.key}</td>
                <td>
                  {isEditing ? (
                    <textarea style={{ ...input, width: '100%', minHeight: '50px' }} value={editing[m.memory_id]} onChange={(e) => setEditing({ ...editing, [m.memory_id]: e.target.value })} />
                  ) : (
                    <span onDoubleClick={() => setEditing({ ...editing, [m.memory_id]: m.value })} title="Double-click to edit">{m.value}</span>
                  )}
                </td>
                <td>v{m.version}</td>
                <td style={{ color: '#64748b' }}>{m.source_device}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {isEditing ? (
                    <button style={btn('#10b981')} onClick={() => act(async () => {
                      await postJson(`/api/memory/never-forget/${m.memory_id}`, { value: editing[m.memory_id], source_device: 'command-center-ui' }, 'PUT');
                      const next = { ...editing }; delete next[m.memory_id]; setEditing(next);
                    }, `Updated ${m.memory_id}`)}><Save size={11} /></button>
                  ) : (
                    <button style={btn('#334155')} title={m.pinned ? 'Unpin' : 'Pin'} onClick={() => act(() => postJson(`/api/memory/never-forget/${m.memory_id}`, { value: m.value, pinned: !m.pinned }, 'PUT'), m.pinned ? 'Unpinned' : 'Pinned')}>
                      {m.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                    </button>
                  )}{' '}
                  <button style={btn('#ef4444')} onClick={() => {
                    if (window.confirm(`Delete memory ${m.memory_id}? This cannot be undone.`)) {
                      act(() => apiJson(`/api/memory/never-forget/${m.memory_id}`, { method: 'DELETE' }), `Deleted ${m.memory_id}`);
                    }
                  }}><Trash2 size={11} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};

// ===========================================================================
// 3. ANIME DATABASE & STUDIO
// ===========================================================================
export const AnimePanel: React.FC<{ onShowMediaOnHud?: MediaCb }> = ({ onShowMediaOnHud }) => {
  const compact = useCompactWidth();
  const [q, setQ] = useState('Frieren');
  const [results, setResults] = useState<any>(null);
  const [studio, setStudio] = useState<any>(null);
  const [charName, setCharName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadStudio = () => apiJson('/api/anime-studio/status').then(setStudio).catch((e) => setErr(e.message));
  const search = async () => {
    setBusy(true); setErr('');
    try { setResults(await apiJson(`/api/anime-db/search?q=${encodeURIComponent(q)}&limit=8`)); sound.playConfirm(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { loadStudio(); search(); }, []);

  const createChar = async () => {
    if (!charName.trim()) return;
    setBusy(true); setErr('');
    try {
      const d = await postJson('/api/anime-studio/character', { name: charName });
      if (d.character?.reference_sheet_url) onShowMediaOnHud?.({ type: 'image', url: d.character.reference_sheet_url });
      setCharName('');
      await loadStudio();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 360px', gap: compact ? '12px' : '18px', width: '100%', height: '100%', overflowY: compact ? 'auto' : 'visible' }}>
      <div style={card}>
        <div style={h('#ff0070')}>ANIME DATABASE (ANILIST + JIKAN, CACHED)</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input style={{ ...input, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search any anime title" />
          <button style={btn('#ff0070')} onClick={search} disabled={busy}><Search size={12} /> Search</button>
        </div>
        {results && (
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>
            {results.count} result(s) • {results.cache_hit ? 'from local cache' : 'live API / fallback'} • {results.latency_ms} ms
          </div>
        )}
        <ErrorLine msg={err} />
        {results?.results?.map((a: any) => (
          <div key={a.anime_id} style={{ borderBottom: '1px solid rgba(148,163,184,0.15)', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b style={{ color: '#ffffff', fontSize: '12px' }}>{a.title_english}</b>
              <span style={{ color: '#fbbf24', fontSize: '12px' }}>★ {a.score}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{a.title_romaji} • {a.status} • {a.season} • {a.episodes} eps • {a.studios?.join(', ')}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>{a.synopsis}</div>
            <div style={{ fontSize: '9px', color: '#475569', marginTop: '3px' }}>{a.source_api}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={h('#ff0070')}>CHARACTER SHEETS ({studio?.characters_count ?? 0})</div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input style={{ ...input, flex: 1 }} value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="New character name" />
          <button style={btn('#ff0070')} onClick={createChar} disabled={busy || !charName.trim()}><Plus size={12} /></button>
        </div>
        {studio?.characters?.map((c: any) => (
          <div key={c.character_id} onClick={() => onShowMediaOnHud?.({ type: 'image', url: c.reference_sheet_url })} style={{ padding: '8px', borderRadius: '5px', background: 'rgba(15,23,42,0.6)', marginBottom: '6px', cursor: 'pointer' }}>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Seed {c.seed} • Hair {c.hair_color} • Eyes {c.eye_color}</div>
          </div>
        ))}
        <div style={{ ...h('#ff0070'), marginTop: '14px' }}>RECENT EPISODES ({studio?.episodes_count ?? 0})</div>
        {studio?.recent_episodes?.map((e: any) => (
          <div key={e.episode_id} onClick={() => onShowMediaOnHud?.({ type: 'video', url: e.master_video_url })} style={{ padding: '8px', borderRadius: '5px', background: 'rgba(15,23,42,0.6)', marginBottom: '6px', cursor: 'pointer', fontSize: '11px' }}>
            {e.title} — {e.scenes_count} scenes, {e.total_duration_sec}s
          </div>
        ))}
      </div>
    </div>
  );
};

// ===========================================================================
// 4. FINANCE & RISK DASHBOARD (information only — never trades)
// ===========================================================================
export const FinancePanel: React.FC = () => {
  const compact = useCompactWidth();
  const SYMBOLS = ['BTC', 'ETH', 'SOL', 'NVDA', 'AAPL', 'SPY'];
  const [symbol, setSymbol] = useState('BTC');
  const [analysis, setAnalysis] = useState<any>(null);
  const [monthly, setMonthly] = useState(500);
  const [principal, setPrincipal] = useState(5000);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(10);
  const [plan, setPlan] = useState<any>(null);
  const [err, setErr] = useState('');

  const analyze = async (s: string) => {
    setSymbol(s); setErr('');
    try { setAnalysis(await postJson('/api/finance/analyze', { symbol: s })); sound.playConfirm(); }
    catch (e: any) { setErr(e.message); }
  };
  const project = async () => {
    try {
      setPlan(await postJson('/api/finance/personal', { monthly_investment: monthly, initial_principal: principal, annual_return_pct: rate, years }));
    } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { analyze('BTC'); }, []);
  useEffect(() => { const t = setTimeout(project, 250); return () => clearTimeout(t); }, [monthly, principal, rate, years]);

  const fmt = (n: number) => (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const slider = (label: string, val: number, set: (n: number) => void, min: number, max: number, step: number, suffix = '') => (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><b style={{ color: '#e2f1ff' }}>{val.toLocaleString()}{suffix}</b></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 340px', gap: compact ? '12px' : '18px', width: '100%', height: '100%', overflowY: compact ? 'auto' : 'visible' }}>
      <div style={card}>
        <div style={h('#ffb800')}>MARKET ANALYSIS (INFORMATION ONLY — NO TRADES)</div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {SYMBOLS.map((s) => <button key={s} style={btn(symbol === s ? '#ffb800' : '#334155')} onClick={() => analyze(s)}>{s}</button>)}
        </div>
        <ErrorLine msg={err} />
        {analysis && (
          <>
            <div style={{ fontSize: '13px', marginBottom: '6px' }}>
              <b>{analysis.name}</b> ({analysis.asset_class}) — {fmt(analysis.price_usd)}{' '}
              <span style={{ color: analysis.change_24h_pct >= 0 ? '#10b981' : '#f43f5e' }}>{analysis.change_24h_pct >= 0 ? '+' : ''}{analysis.change_24h_pct}% 24h</span>
            </div>
            <div className="font-mono" style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
              SMA {fmt(analysis.indicators?.sma_period)} • Bollinger [{fmt(analysis.indicators?.bollinger_lower)} – {fmt(analysis.indicators?.bollinger_upper)}] •
              Vol ~{analysis.indicators?.volatility_annual_pct}%/yr • Max drawdown {analysis.indicators?.max_drawdown_hist_pct}%
            </div>
            {analysis.chart_url && <img src={agentMediaUrl(analysis.chart_url)} alt={`${analysis.symbol} chart`} style={{ width: '100%', borderRadius: '6px', border: '1px solid rgba(255,184,0,0.3)' }} />}
            <div style={{ marginTop: '10px', padding: '10px', borderRadius: '6px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.5)', fontSize: '11px', color: '#fecdd3' }}>
              {analysis.risk_disclosure}
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <div style={h('#ffb800')}>COMPOUND GROWTH CALCULATOR</div>
        {slider('Starting principal ($)', principal, setPrincipal, 0, 100000, 500)}
        {slider('Monthly contribution ($)', monthly, setMonthly, 0, 5000, 50)}
        {slider('Assumed annual return', rate, setRate, 0, 15, 0.5, '%')}
        {slider('Years', years, setYears, 1, 40, 1)}
        {plan && (
          <div style={{ fontSize: '12px', lineHeight: 1.8, marginTop: '8px' }}>
            <div>Contributed: <b>{fmt(plan.total_contributed_usd)}</b></div>
            <div>Projected balance: <b style={{ color: '#10b981' }}>{fmt(plan.projected_final_balance_usd)}</b></div>
            <div>Growth: {fmt(plan.projected_compound_gain_usd)}</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
              Fixed-rate assumption for illustration only. Real returns vary year to year and can be negative.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
