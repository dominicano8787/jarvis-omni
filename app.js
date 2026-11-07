/* J.A.R.V.I.S. HUD client.
 *
 * One WebSocket carries the whole live protocol. The guiding rule: nothing the
 * model does is hidden. Reasoning streams to the cognition pane, every tool
 * call appears in the activity feed before it runs, and anything that touches
 * the machine stops at an approval card unless autonomy is explicitly on.
 */

const $ = (id) => document.getElementById(id);

const ui = {
  reactor: $("reactor"), subtitle: $("subtitle"),
  state: $("t-state"), expert: $("t-expert"), effort: $("t-effort"),
  tokens: $("t-tokens"), cache: $("t-cache"),
  experts: $("experts"), blurb: $("expert-blurb"),
  memList: $("memory-list"), memCount: $("mem-count"),
  resList: $("research-list"), resCount: $("res-count"),
  transcript: $("transcript"),
  cognition: $("cognition"), cogStatus: $("cog-status"),
  track: $("research-track"), researchNote: $("research-note"),
  activity: $("activity"), sources: $("sources"), srcCount: $("src-count"),
  input: $("input"), send: $("btn-send"), interrupt: $("btn-interrupt"),
  selEffort: $("sel-effort"), swDeep: $("sw-deep"), swAuto: $("sw-auto"),
  hint: $("composer-hint"),
  layer: $("approval-layer"), apWhy: $("ap-why"), apTool: $("ap-tool"),
  apDanger: $("ap-danger"), apPayload: $("ap-payload"),
  apAllow: $("ap-allow"), apDeny: $("ap-deny"),
};

const state = {
  ws: null,
  busy: false,
  expert: "general",
  experts: [],
  answerEl: null,     // live answer <div class="body">
  answerText: "",
  cogEl: null,        // live reasoning block
  acts: new Map(),    // tool id -> element
  seenSources: new Set(),
  approvalId: null,
  totals: { in: 0, out: 0, cache: 0 },
  retry: 0,
};

/* ───────────────────────── utilities ───────────────────────── */

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/* Deliberately small Markdown subset. Everything is escaped first, so model
 * output can never inject markup — the formatting below is applied to text
 * that is already inert. */
function md(src) {
  const fences = [];
  let s = esc(src);

  s = s.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    fences.push(`<pre><code data-lang="${esc(lang)}">${code.replace(/\n$/, "")}</code></pre>`);
    return `\u0000FENCE${fences.length - 1}\u0000`;
  });

  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
                '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');

  // Lists: group consecutive bullet / numbered lines.
  s = s.replace(/(?:^[-*+] .+\n?)+/gm, (block) => {
    const items = block.trimEnd().split("\n")
      .map((l) => `<li>${l.replace(/^[-*+] /, "")}</li>`).join("");
    return `<ul>${items}</ul>\n`;
  });
  s = s.replace(/(?:^\d+\. .+\n?)+/gm, (block) => {
    const items = block.trimEnd().split("\n")
      .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
    return `<ol>${items}</ol>\n`;
  });

  // Paragraphs from remaining bare lines.
  s = s.split(/\n{2,}/).map((chunk) => {
    const t = chunk.trim();
    if (!t || /^<(h\d|ul|ol|pre|table|blockquote)/.test(t) || t.startsWith("\u0000FENCE")) {
      return t;
    }
    return `<p>${t.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return s.replace(/\u0000FENCE(\d+)\u0000/g, (_, i) => fences[+i]);
}

function atBottom(el, slack = 120) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < slack;
}
function stick(el, wasAtBottom) {
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

/* ───────────────────────── transcript ───────────────────────── */

function addMessage(kind, who, html) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${kind}`;
  wrap.innerHTML = `<div class="who">${esc(who)}</div><div class="body"></div>`;
  const body = wrap.querySelector(".body");
  if (html !== undefined) body.innerHTML = html;
  ui.transcript.querySelector(".boot")?.remove();
  ui.transcript.appendChild(wrap);
  ui.transcript.scrollTop = ui.transcript.scrollHeight;
  return body;
}

function openAnswer() {
  if (state.answerEl) return;
  state.answerText = "";
  state.answerEl = addMessage("jarvis", "J.A.R.V.I.S.");
  state.answerEl.classList.add("cursor");
}

function appendAnswer(delta) {
  openAnswer();
  const bottom = atBottom(ui.transcript);
  state.answerText += delta;
  state.answerEl.innerHTML = md(state.answerText);
  stick(ui.transcript, bottom);
}

function closeAnswer() {
  if (!state.answerEl) return;
  state.answerEl.classList.remove("cursor");
  state.answerEl = null;
  state.answerText = "";
}

/* ───────────────────────── cognition pane ───────────────────────── */

function openCognition(label = "reasoning") {
  const block = document.createElement("div");
  block.className = "think-block";
  block.innerHTML = `<span class="tick">${esc(label)} · ${new Date().toLocaleTimeString()}</span><span class="txt"></span>`;
  if (ui.cognition.querySelector(".dim")) ui.cognition.innerHTML = "";
  ui.cognition.appendChild(block);
  state.cogEl = block.querySelector(".txt");
  ui.cogStatus.textContent = "active";
  ui.cogStatus.className = "chip";
  ui.cognition.scrollTop = ui.cognition.scrollHeight;
}

function appendCognition(delta) {
  if (!state.cogEl) openCognition();
  const bottom = atBottom(ui.cognition, 80);
  state.cogEl.textContent += delta;
  stick(ui.cognition, bottom);
}

/* ───────────────────────── activity feed ───────────────────────── */

function act(id, name, status, detail, cls) {
  let el = state.acts.get(id);
  if (!el) {
    el = document.createElement("div");
    state.acts.set(id, el);
    ui.activity.appendChild(el);
  }
  el.className = `act ${cls}`;
  el.innerHTML =
    `<div class="head"><span class="nm">${esc(name)}</span>` +
    `<span class="st">${esc(status)}</span></div>` +
    (detail ? `<div class="detail">${esc(detail)}</div>` : "");
  ui.activity.scrollTop = ui.activity.scrollHeight;
  return el;
}

function note(text, cls = "note") {
  act(`note-${Math.random().toString(36).slice(2)}`, "note", "·", text, cls);
}

/* URLs arrive from model tool results, so the scheme is not trusted. Anything
 * that is not plain http(s) is rendered as inert text rather than a link. */
function safeHref(url) {
  try {
    const u = new URL(url, location.origin);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : null;
  } catch { return null; }
}

function addSource(kind, title, url) {
  if (!url || state.seenSources.has(url)) return;
  state.seenSources.add(url);

  const li = document.createElement("li");
  const label = document.createElement("b");
  label.textContent = (title || url).slice(0, 90);
  li.appendChild(label);

  const href = safeHref(url);
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noreferrer noopener";
    a.textContent = url.slice(0, 70);
    li.appendChild(a);
  } else {
    const span = document.createElement("span");
    span.className = "dim";
    span.textContent = `${url.slice(0, 70)} (non-http scheme, not linked)`;
    li.appendChild(span);
  }

  ui.sources.appendChild(li);
  ui.srcCount.textContent = String(state.seenSources.size);
}

/* ───────────────────────── research track ───────────────────────── */

function buildTrack(total) {
  ui.track.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const d = document.createElement("div");
    d.className = "dot";
    ui.track.appendChild(d);
  }
}

function markTrack(index, cls) {
  const dots = [...ui.track.children];
  dots.forEach((d, i) => {
    if (i < index - 1) d.className = "dot done";
    else if (i === index - 1) d.className = `dot ${cls}`;
  });
}

/* ───────────────────────── status ───────────────────────── */

const STATE_LABEL = {
  thinking: "reasoning", acting: "executing", researching: "sweeping",
  resuming: "resuming", idle: "idle",
};

function setBusy(busy) {
  state.busy = busy;
  ui.send.disabled = busy;
  ui.interrupt.disabled = !busy;
  ui.reactor.classList.toggle("busy", busy);
  if (!busy) {
    ui.reactor.classList.remove("error");
    ui.cogStatus.textContent = "idle";
    ui.cogStatus.className = "chip quiet";
  }
}

function setState(s) {
  ui.state.textContent = STATE_LABEL[s] || s;
  setBusy(s !== "idle");
}

/* ───────────────────────── websocket ───────────────────────── */

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  state.ws = ws;

  ws.onopen = () => {
    state.retry = 0;
    ui.hint.textContent = "link established";
    setTimeout(() => (ui.hint.textContent = ""), 2500);
  };

  ws.onclose = () => {
    setBusy(false);
    ui.reactor.classList.add("error");
    ui.state.textContent = "offline";
    const wait = Math.min(1000 * 2 ** state.retry++, 15000);
    ui.hint.textContent = `link lost — retrying in ${Math.round(wait / 1000)}s`;
    setTimeout(connect, wait);
  };

  ws.onerror = () => ui.reactor.classList.add("error");
  ws.onmessage = (e) => {
    let ev;
    try { ev = JSON.parse(e.data); } catch { return; }
    handle(ev);
  };
}

function send(obj) {
  if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify(obj));
}

/* ───────────────────────── event handling ───────────────────────── */

function handle(ev) {
  switch (ev.type) {
    case "hello":
      ui.subtitle.textContent =
        `${ev.backend} · ${ev.model} · operator ${ev.principal}`;
      ui.swAuto.checked = !!ev.autonomous;
      if (!ev.key_present && ev.backend === "anthropic") {
        addMessage("error", "system",
          "ANTHROPIC_API_KEY is not visible to this process. Start the server " +
          "from a shell where it is set, or put it in D:\\Jarvis\\.env");
      }
      break;

    case "status": setState(ev.state); break;

    case "cognition_open": openCognition("reasoning"); break;
    case "cognition": appendCognition(ev.delta); break;

    case "answer_open": openAnswer(); break;
    case "answer": appendAnswer(ev.delta); break;

    case "tool_open":
      act(ev.id, ev.name, ev.server ? "server" : "preparing", "",
          ev.server ? "running" : "pending");
      break;

    case "tool_args": {
      const el = state.acts.get(ev.id);
      if (el) {
        const d = el.querySelector(".detail") || (() => {
          const n = document.createElement("div"); n.className = "detail";
          el.appendChild(n); return n;
        })();
        d.textContent = (d.textContent + ev.delta).slice(-400);
      }
      break;
    }

    case "tool_run":
      act(ev.id, ev.name, "running",
          JSON.stringify(ev.input).slice(0, 400), "running");
      break;

    case "tool_done":
      act(ev.id, ev.name, ev.ok ? "complete" : "failed",
          (ev.preview || "").slice(0, 400), ev.ok ? "ok" : "bad");
      break;

    case "source": addSource(ev.kind, ev.title, ev.url); break;

    case "usage":
      state.totals.in += ev.input_tokens || 0;
      state.totals.out += ev.output_tokens || 0;
      state.totals.cache += ev.cache_read_input_tokens || 0;
      ui.tokens.textContent =
        `${state.totals.in.toLocaleString()} / ${state.totals.out.toLocaleString()}`;
      ui.cache.textContent = state.totals.cache.toLocaleString();
      break;

    case "research_phase":
      if (!ui.track.children.length || ev.total !== ui.track.children.length) {
        buildTrack(ev.total);
      }
      markTrack(ev.pass, "on");
      ui.researchNote.textContent = `Pass ${ev.pass}/${ev.total} — ${ev.label}`;
      break;

    case "research_result":
      markTrack(ev.pass, "done");
      ui.researchNote.textContent =
        `Pass ${ev.pass} (${ev.label}): ${ev.new_sources} new source` +
        `${ev.new_sources === 1 ? "" : "s"}` +
        (ev.dry_streak ? ` · dry streak ${ev.dry_streak}` : "");
      break;

    case "research_done":
      ui.researchNote.textContent =
        `Dossier written — ${ev.passes} passes, ${ev.sources} sources.`;
      note(`Dossier: ${ev.path}`, "ok");
      loadResearch();
      break;

    case "approval_request": showApproval(ev); break;

    case "approval_expired":
      hideApproval();
      note("Approval timed out — call declined.", "bad");
      break;

    case "refusal":
      closeAnswer();
      addMessage("error", "refused",
        `The safety classifier declined this request` +
        (ev.category ? ` (category: ${esc(ev.category)})` : "") + ".\n" +
        (ev.explanation ? esc(ev.explanation) + "\n" : "") +
        "Rephrasing, or switching the backend to a local model, are the options.");
      break;

    case "notice": note(ev.text, "note"); break;

    case "turn_end":
      closeAnswer();
      state.cogEl = null;
      break;

    case "error":
      closeAnswer();
      addMessage("error", "fault",
        esc(ev.message) + (ev.trace ? "\n\n" + esc(ev.trace) : ""));
      setBusy(false);
      break;

    case "memory_update": renderMemory(ev.files); break;

    case "settings":
      ui.expert.textContent = labelFor(ev.expert);
      ui.effort.textContent = ev.effort;
      break;

    case "reset_ok":
      ui.transcript.innerHTML = "";
      addMessage("system", "system", "Context cleared. Memory on disk is untouched.");
      break;
  }
}

/* ───────────────────────── approval card ───────────────────────── */

function showApproval(ev) {
  state.approvalId = ev.id;
  ui.apWhy.textContent = ev.why || "No rationale supplied.";
  ui.apTool.textContent = ev.tool;
  ui.apDanger.textContent = ev.danger;
  ui.apDanger.className = "chip " + (ev.danger === "high" ? "bad" : "warn");
  ui.apPayload.textContent = JSON.stringify(ev.payload, null, 2);
  ui.layer.classList.remove("hidden");
  ui.apDeny.focus();
  act(`ap-${ev.id}`, ev.tool, "awaiting authorisation", ev.why, "pending");
}

function hideApproval() {
  ui.layer.classList.add("hidden");
  state.approvalId = null;
}

function decide(allow) {
  if (!state.approvalId) return;
  send({ type: "approve", id: state.approvalId, allow });
  hideApproval();
}

ui.apAllow.onclick = () => decide(true);
ui.apDeny.onclick = () => decide(false);
document.addEventListener("keydown", (e) => {
  if (state.approvalId && e.key === "Escape") decide(false);
});

/* ───────────────────────── profiles ───────────────────────── */

function labelFor(key) {
  return state.experts.find((e) => e.key === key)?.label || key;
}

async function loadExperts() {
  state.experts = await (await fetch("/api/experts")).json();
  ui.experts.innerHTML = "";
  for (const e of state.experts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ex" + (e.key === state.expert ? " on" : "");
    b.innerHTML = `<span class="g">${esc(e.glyph)}</span><span>${esc(e.label)}</span>`;
    b.onmouseenter = () => (ui.blurb.textContent = e.blurb);
    b.onclick = () => selectExpert(e);
    ui.experts.appendChild(b);
  }
  ui.blurb.textContent = state.experts[0]?.blurb || "";
}

function selectExpert(e) {
  state.expert = e.key;
  [...ui.experts.children].forEach((c, i) =>
    c.classList.toggle("on", state.experts[i].key === e.key));
  ui.blurb.textContent = e.blurb;
  ui.expert.textContent = e.label;
  ui.selEffort.value = e.effort;
  ui.effort.textContent = e.effort;
  send({ type: "settings", expert: e.key, effort: e.effort });
}

/* ───────────────────────── side listings ───────────────────────── */

function renderMemory(files) {
  ui.memCount.textContent = String(files.length);
  ui.memList.innerHTML = files.length
    ? ""
    : '<li class="dim">empty — notes appear as the model writes them</li>';
  for (const f of files) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${esc(f.headline || f.path)}</b>${esc(f.path)} · ${f.bytes} B`;
    ui.memList.appendChild(li);
  }
}

async function loadMemory() {
  renderMemory((await (await fetch("/api/memory")).json()).files);
}

async function loadResearch() {
  const items = await (await fetch("/api/research")).json();
  ui.resCount.textContent = String(items.length);
  ui.resList.innerHTML = items.length ? "" : '<li class="dim">no dossiers yet</li>';
  for (const r of items) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${esc(r.name.replace(/^\d+-/, "").replace(/\.md$/, ""))}</b>` +
      `${new Date(r.mtime * 1000).toLocaleString()}`;
    li.style.cursor = "pointer";
    li.onclick = async () => {
      const d = await (await fetch(`/api/research/${encodeURIComponent(r.name)}`)).json();
      addMessage("jarvis", `dossier · ${r.name}`, md(d.text));
    };
    ui.resList.appendChild(li);
  }
}

/* ───────────────────────── composer ───────────────────────── */

$("composer").onsubmit = (e) => {
  e.preventDefault();
  submit();
};

function submit() {
  const text = ui.input.value.trim();
  if (!text || state.busy) return;
  const deep = ui.swDeep.checked;
  addMessage("user", deep ? "operator · deep research" : "operator",
             `<pre style="margin:0;white-space:pre-wrap">${esc(text)}</pre>`);
  if (deep) {
    ui.sources.innerHTML = "";
    state.seenSources.clear();
    ui.srcCount.textContent = "0";
  }
  send({
    type: "prompt", text, deep_research: deep,
    expert: state.expert, effort: ui.selEffort.value,
  });
  ui.input.value = "";
  setBusy(true);
}

ui.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
});

ui.interrupt.onclick = () => send({ type: "interrupt" });

ui.selEffort.onchange = () => {
  ui.effort.textContent = ui.selEffort.value;
  send({ type: "settings", effort: ui.selEffort.value });
};

ui.swAuto.onchange = () => {
  send({ type: "settings", autonomous: ui.swAuto.checked });
  note(ui.swAuto.checked
    ? "Autonomy ON — shell commands and file writes now run without a prompt."
    : "Autonomy OFF — gated calls will stop for authorisation.",
    ui.swAuto.checked ? "bad" : "ok");
};

/* ───────────────────────── boot ───────────────────────── */

(async function boot() {
  const st = await (await fetch("/api/status")).json();
  ui.subtitle.textContent = `${st.backend} · ${st.model} · operator ${st.principal}`;
  ui.effort.textContent = st.effort;
  ui.selEffort.value = st.effort;
  buildTrack(st.research_passes);
  await loadExperts();
  await loadMemory();
  await loadResearch();
  connect();
})();
