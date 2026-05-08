"""Intent 시스템 정적 HTML 뷰 생성기.

`build-site` CLI 가 호출. 단일 HTML 파일 — 외부 의존성 0 (오프라인 100% 동작).

3 패널:
- 좌: 전체 Intent 검색·필터 리스트
- 중: 선택 Intent 중심 **관계 네비게이션** — ancestors/parents/siblings/
     children/descendants 를 섹션별 클릭 가능 리스트로
- 우: 선택 Intent 본문 (intent) + 연결된 Goal 링크

Goal sitegen 과 패널 구조는 동일하나, Intent 스키마에 없는 섹션
(constraints, constrained_by, realizes, success_criteria, alternatives_considered,
rationale) 은 제거.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from typing import Sequence

from .parser import Intent


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _intent_to_payload(i: Intent) -> dict:
    return {
        "id": i.id,
        "title": i.title,
        "status": i.status,
        "tags": list(i.tags),
        "parents": list(i.parents),
        "children": list(i.children),
        "goals": list(i.goals),
        "intent": i.intent,
    }


def generate_site(intents: Sequence[Intent], *, generated_at: str | None = None) -> str:
    timestamp = generated_at or _now_iso()
    payload = {
        "generated_at": timestamp,
        "total": len(intents),
        "intents": [_intent_to_payload(i) for i in sorted(intents, key=lambda x: x.id)],
    }
    data_json = json.dumps(payload, ensure_ascii=False)

    return _HTML_TEMPLATE.replace("__DATA_JSON__", _safe_script_json(data_json)) \
                         .replace("__GENERATED_AT__", html.escape(timestamp))


def _safe_script_json(s: str) -> str:
    return s.replace("</", "<\\/")


_HTML_TEMPLATE = r"""<!-- 자동 생성 — 직접 수정 금지 -->
<!-- Last generated: __GENERATED_AT__ -->
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Intent Browser</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --panel2: #273449; --line: #334155;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8; --accent-deep: #0c4a6e;
    --root: #fde68a; --active: #86efac;
    --proposed: #fcd34d; --realized: #93c5fd;
    --abandoned: #6b7280;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo",
          "Noto Sans CJK KR", sans-serif; }
  #app { display: grid; grid-template-columns: 320px 380px 1fr; height: 100vh; }
  @media (max-width: 1100px) {
    #app { grid-template-columns: 1fr; grid-template-rows: auto auto auto; height: auto; }
    .pane { max-height: 60vh; }
  }
  .pane { overflow: auto; border-right: 1px solid var(--line); display: flex;
    flex-direction: column; }
  .pane:last-child { border-right: 0; }
  .pane > .header { padding: 10px 14px; border-bottom: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: center;
    position: sticky; top: 0; background: var(--bg); z-index: 1; }
  .pane > .header span.muted { color: var(--muted); font-size: 12px; }
  .pane > .body { padding: 0; overflow-y: auto; flex: 1; }

  /* --- 좌측 — 검색·필터·전체 리스트 --- */
  #filters { padding: 10px 12px; border-bottom: 1px solid var(--line); }
  #filters input, #filters select {
    width: 100%; margin-bottom: 6px;
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    padding: 7px 9px; border-radius: 4px; font: inherit; }
  ul.list { list-style: none; margin: 0; padding: 0; }
  ul.list li { padding: 7px 14px; cursor: pointer; border-left: 3px solid transparent;
    border-bottom: 1px solid var(--line); line-height: 1.35; }
  ul.list li:hover { background: var(--panel); }
  ul.list li.selected { background: var(--panel2); border-left-color: var(--accent); }
  .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--accent);
    margin-right: 6px; font-weight: 600; }
  .status { display: inline-block; padding: 1px 6px; border-radius: 10px;
    font-size: 11px; margin-left: 6px; background: var(--line); }
  .status.active { background: var(--active); color: #052e16; }
  .status.proposed { background: var(--proposed); color: #422006; }
  .status.realized { background: var(--realized); color: #082f49; }
  .status.abandoned { background: var(--abandoned); color: #f9fafb; }
  .pill {
    display: inline-block; font-size: 10px; padding: 1px 5px; border-radius: 3px;
    margin-left: 4px; background: var(--line); color: var(--muted);
  }
  .pill.root { background: var(--root); color: #422006; }
  .pill.leaf { background: var(--realized); color: #082f49; }

  /* --- 중앙 — 관계 네비게이션 --- */
  #relations { padding: 0; }
  .empty-hint { color: var(--muted); padding: 24px 14px; text-align: center; }
  .center-card {
    margin: 12px; padding: 14px; border-radius: 6px;
    background: var(--panel2); border: 2px solid var(--accent);
  }
  .center-card .id { font-size: 14px; }
  .center-card h3 { font-size: 15px; margin: 4px 0 6px; line-height: 1.3; }
  .center-card .tags { margin-top: 6px; }
  .tag { display: inline-block; background: var(--line); color: var(--muted);
    padding: 1px 6px; border-radius: 3px; margin: 2px 4px 2px 0; font-size: 11px; }
  .relation-section { margin: 0; border-top: 1px solid var(--line); }
  .relation-section .section-head {
    padding: 8px 14px 4px; color: var(--muted);
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .relation-section .section-head .arrow { color: var(--accent); margin-right: 4px; }
  .relation-section .section-head .count { font-size: 11px; color: var(--muted); }
  .relation-section ul { list-style: none; margin: 0; padding: 0 0 6px; }
  .relation-section ul li { padding: 5px 14px 5px 22px; cursor: pointer;
    border-left: 3px solid transparent; line-height: 1.3; }
  .relation-section ul li:hover { background: var(--panel); }
  .relation-section ul li.selected { background: var(--panel2);
    border-left-color: var(--accent); }
  .relation-section ul li .meta { color: var(--muted); font-size: 11px;
    margin-left: 4px; }
  .relation-section .none { color: var(--muted); padding: 4px 14px 8px 22px;
    font-size: 12px; font-style: italic; }
  .toggle-more { color: var(--accent); cursor: pointer; padding: 4px 14px;
    font-size: 12px; }
  .toggle-more:hover { text-decoration: underline; }

  /* --- 우측 — 본문 --- */
  #detail { padding: 14px 18px; }
  #detail h1 { font-size: 18px; margin: 0 0 4px; line-height: 1.3; }
  #detail .meta { color: var(--muted); margin-bottom: 12px; font-size: 12px; }
  #detail h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); margin: 16px 0 6px; border-bottom: 1px solid var(--line);
    padding-bottom: 4px; }
  #detail .actions { display: flex; gap: 6px; margin: 8px 0 12px; flex-wrap: wrap;
    align-items: center; }
  #detail button { background: var(--accent); color: var(--accent-deep); border: 0;
    padding: 6px 10px; border-radius: 4px; cursor: pointer; font: inherit;
    font-weight: 600; }
  #detail button.secondary { background: var(--panel2); color: var(--text);
    border: 1px solid var(--line); }
  #detail button:hover { filter: brightness(1.1); }
  #detail pre { background: var(--panel); padding: 10px; border-radius: 4px;
    white-space: pre-wrap; word-break: break-word; margin: 0; font: inherit; }
  #detail ul { padding-left: 20px; margin: 6px 0; }
  #detail li { margin-bottom: 4px; }
  #detail code { background: var(--panel); padding: 1px 5px; border-radius: 3px;
    font-size: 12px; }
  #detail .copied { color: var(--active); font-weight: 600; margin-left: 8px; }
</style>
</head>
<body>
<div id="app">
  <!-- 좌측 -->
  <div class="pane">
    <div class="header"><strong>Intents</strong><span class="muted" id="count"></span></div>
    <div id="filters">
      <input type="search" id="q" placeholder="ID/제목/의도 검색...">
      <select id="status-filter">
        <option value="">모든 status</option>
        <option value="active">active</option>
        <option value="proposed">proposed</option>
        <option value="realized">realized</option>
        <option value="abandoned">abandoned</option>
      </select>
      <select id="tag-filter"><option value="">모든 tag</option></select>
    </div>
    <div class="body"><ul id="list" class="list"></ul></div>
  </div>

  <!-- 중앙 — 관계 네비 -->
  <div class="pane">
    <div class="header"><strong>관계</strong>
      <span class="muted" id="generated-at">__GENERATED_AT__</span>
    </div>
    <div class="body" id="relations">
      <p class="empty-hint">왼쪽에서 Intent 를 선택하세요.</p>
    </div>
  </div>

  <!-- 우측 — 본문 -->
  <div class="pane">
    <div class="header"><strong>본문</strong><span class="muted" id="detail-id"></span></div>
    <div class="body" id="detail">
      <p class="empty-hint">선택된 Intent 의 의도 본문 / 연결된 Goal 이 표시됩니다.</p>
    </div>
  </div>
</div>

<script type="application/json" id="intent-data">__DATA_JSON__</script>
<script>
(() => {
  const DATA = JSON.parse(document.getElementById("intent-data").textContent);
  const intentsById = Object.fromEntries(DATA.intents.map(i => [i.id, i]));

  // --- transitive 계산 (클라이언트) ---
  function ancestorsOf(id) {
    const out = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      const it = intentsById[cur];
      if (!it) continue;
      for (const p of it.parents || []) {
        if (out.has(p) || p === id) continue;
        out.add(p);
        stack.push(p);
      }
    }
    return [...out];
  }
  function descendantsOf(id) {
    const out = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      const it = intentsById[cur];
      if (!it) continue;
      for (const c of it.children || []) {
        if (out.has(c) || c === id) continue;
        out.add(c);
        stack.push(c);
      }
    }
    return [...out];
  }
  function siblingsOf(id) {
    const it = intentsById[id]; if (!it) return [];
    const out = new Set();
    for (const p of it.parents || []) {
      const parent = intentsById[p]; if (!parent) continue;
      for (const c of parent.children || []) {
        if (c !== id && intentsById[c]) out.add(c);
      }
    }
    return [...out].sort();
  }

  // --- DOM 핸들 ---
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("status-filter");
  const tagSelect = document.getElementById("tag-filter");
  const relationsEl = document.getElementById("relations");
  const detailEl = document.getElementById("detail");
  const detailIdEl = document.getElementById("detail-id");

  const allTags = [...new Set(DATA.intents.flatMap(i => i.tags))].sort();
  for (const t of allTags) {
    const o = document.createElement("option");
    o.value = t; o.textContent = t;
    tagSelect.appendChild(o);
  }

  let selectedId = null;

  function escape(s) {
    return (s || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function isRoot(it) { return !(it.parents || []).length; }
  function isLeaf(it) { return !(it.children || []).length; }

  function passes(it) {
    const q = qEl.value.trim().toLowerCase();
    if (q && !(it.id.toLowerCase().includes(q)
              || it.title.toLowerCase().includes(q)
              || (it.intent || "").toLowerCase().includes(q))) return false;
    if (statusEl.value && it.status !== statusEl.value) return false;
    if (tagSelect.value && !(it.tags || []).includes(tagSelect.value)) return false;
    return true;
  }

  function renderList() {
    const filtered = DATA.intents.filter(passes);
    countEl.textContent = `${filtered.length} / ${DATA.intents.length}`;
    listEl.innerHTML = "";
    for (const it of filtered) {
      const li = document.createElement("li");
      li.dataset.id = it.id;
      if (it.id === selectedId) li.className = "selected";
      const pill = isRoot(it) ? `<span class="pill root">root</span>`
                : isLeaf(it) ? `<span class="pill leaf">leaf</span>`
                : "";
      li.innerHTML = `<span class="id">${it.id}</span>${escape(it.title)}`
                   + ` <span class="status ${it.status}">${it.status}</span>${pill}`;
      li.addEventListener("click", () => select(it.id));
      listEl.appendChild(li);
    }
  }

  // --- 관계 패널 ---
  function relationItem(id) {
    const it = intentsById[id];
    if (!it) return `<li><span class="id">${escape(id)}</span><span class="meta">(없음)</span></li>`;
    const cls = id === selectedId ? "selected" : "";
    const pill = isRoot(it) ? `<span class="pill root">root</span>`
              : isLeaf(it) ? `<span class="pill leaf">leaf</span>`
              : "";
    return `<li class="${cls}" data-goto="${escape(id)}" title="${escape(it.title)}">`
         + `<span class="id">${it.id}</span>${escape(it.title)}`
         + ` <span class="status ${it.status}">${it.status}</span>${pill}</li>`;
  }

  function renderSection(arrow, label, ids, limit = 0) {
    const total = ids.length;
    const section = document.createElement("div");
    section.className = "relation-section";
    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML = `<span><span class="arrow">${arrow}</span>${escape(label)}</span>`
                   + `<span class="count">${total}</span>`;
    section.appendChild(head);
    if (total === 0) {
      const none = document.createElement("div");
      none.className = "none";
      none.textContent = "(없음)";
      section.appendChild(none);
      return section;
    }
    const ul = document.createElement("ul");
    section.appendChild(ul);
    const renderItems = (slice) => {
      ul.innerHTML = slice.map(relationItem).join("");
      ul.querySelectorAll("[data-goto]").forEach(el => {
        el.addEventListener("click", () => select(el.dataset.goto));
      });
    };
    if (limit > 0 && total > limit) {
      renderItems(ids.slice(0, limit));
      const more = document.createElement("div");
      more.className = "toggle-more";
      more.textContent = `+ ${total - limit}개 더 보기`;
      more.addEventListener("click", () => {
        renderItems(ids);
        more.remove();
      });
      section.appendChild(more);
    } else {
      renderItems(ids);
    }
    return section;
  }

  function renderRelations(it) {
    relationsEl.innerHTML = "";
    if (!it) {
      relationsEl.innerHTML = `<p class="empty-hint">왼쪽에서 Intent 를 선택하세요.</p>`;
      return;
    }
    const ancestors = ancestorsOf(it.id).filter(a => !(it.parents || []).includes(a))
                                        .sort();
    const descendants = descendantsOf(it.id).filter(d => !(it.children || []).includes(d))
                                            .sort();
    const siblings = siblingsOf(it.id);

    relationsEl.appendChild(renderSection("↑↑", "ancestors (전이)", ancestors, 8));
    relationsEl.appendChild(renderSection("↑", "parents", it.parents || []));

    const tags = (it.tags || []).map(t => `<span class="tag">${escape(t)}</span>`).join("");
    const card = document.createElement("div");
    card.className = "center-card";
    card.innerHTML = `<span class="id">${it.id}</span>`
                   + `<span class="status ${it.status}">${it.status}</span>`
                   + `<h3>${escape(it.title)}</h3>`
                   + `<div class="tags">${tags}</div>`;
    relationsEl.appendChild(card);

    relationsEl.appendChild(renderSection("↔", "siblings (부모 공유)", siblings, 10));
    relationsEl.appendChild(renderSection("↓", "children", it.children || []));
    relationsEl.appendChild(renderSection("↓↓", "descendants (전이)", descendants, 12));
  }

  // --- 본문 ---
  function renderDetail(it) {
    if (!it) {
      detailEl.innerHTML = `<p class="empty-hint">선택된 Intent 의 의도 본문 / 연결된 Goal 이 표시됩니다.</p>`;
      detailIdEl.textContent = "";
      return;
    }
    detailIdEl.textContent = it.id;
    const goals = (it.goals || []).map(gid =>
      `<li><code>${escape(gid)}</code> <small style="color:var(--muted)">→ Docs/goals/${escape(gid)}.md</small></li>`
    ).join("") || `<li><em>(연결된 Goal 없음 — 아직 측정 가능 단계 아님)</em></li>`;
    const tags = (it.tags || []).map(t => `<span class="tag">${escape(t)}</span>`).join("");

    detailEl.innerHTML = `
      <h1>${it.id} <span style="color:var(--muted)">·</span> ${escape(it.title)}</h1>
      <div class="meta">
        <span class="status ${it.status}">${it.status}</span> ${tags}
      </div>
      <div class="actions">
        <button data-copy="show" class="secondary">${it.id} 본문 경로 복사</button>
        <button data-copy="prompt" class="secondary">자연어 프롬프트</button>
        <span id="copied-msg" class="copied" style="display:none">복사됨</span>
      </div>
      <h2>Intent</h2>
      <pre>${escape(it.intent || "(미작성)")}</pre>
      <h2>Linked Goals</h2>
      <ul>${goals}</ul>
    `;

    detailEl.querySelectorAll("[data-copy]").forEach(btn => {
      btn.addEventListener("click", () => copyHandoff(it, btn.dataset.copy));
    });
  }

  function copyHandoff(it, kind) {
    let text;
    if (kind === "show") {
      text = `Docs/intents/${it.id}.md`;
    } else {
      const intent = (it.intent || "").trim().split(/\n+/).slice(0, 3).join(" ");
      text = `${it.id} (${it.title}) 의도를 더 작은 leaf 의도로 분해해줘. `
           + `Intent 본문은 Docs/intents/${it.id}.md 를 참조.`
           + (intent ? `\n\n의도: ${intent}` : "");
    }
    navigator.clipboard.writeText(text).then(() => {
      const m = document.getElementById("copied-msg");
      if (m) {
        m.style.display = "inline";
        setTimeout(() => { m.style.display = "none"; }, 1200);
      }
    });
  }

  function select(id) {
    if (!intentsById[id]) return;
    const prev = selectedId;
    selectedId = id;
    // 좌측 리스트는 클래스 토글만 — 풀 리렌더 회피.
    if (prev) {
      const prevLi = listEl.querySelector(`li[data-id="${CSS.escape(prev)}"]`);
      if (prevLi) prevLi.classList.remove("selected");
    }
    const li = listEl.querySelector(`li[data-id="${CSS.escape(id)}"]`);
    if (li) {
      li.classList.add("selected");
      li.scrollIntoView({ block: "nearest" });
    }
    renderRelations(intentsById[id]);
    renderDetail(intentsById[id]);
    if (location.hash !== "#" + id) location.hash = id;
  }

  qEl.addEventListener("input", renderList);
  statusEl.addEventListener("change", renderList);
  tagSelect.addEventListener("change", renderList);

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const visible = [...listEl.querySelectorAll("li")];
    if (!visible.length) return;
    const idx = visible.findIndex(li => li.dataset.id === selectedId);
    let next = idx;
    if (e.key === "ArrowDown") next = Math.min(visible.length - 1, idx + 1);
    if (e.key === "ArrowUp") next = Math.max(0, idx - 1);
    if (next === idx || next < 0) return;
    e.preventDefault();
    select(visible[next].dataset.id);
  });

  renderList();
  const hashId = location.hash.replace(/^#/, "");
  if (hashId && intentsById[hashId]) {
    select(hashId);
  } else if (DATA.intents.length) {
    select(DATA.intents[0].id);
  }
})();
</script>
</body>
</html>
"""
