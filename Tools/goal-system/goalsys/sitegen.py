"""Goal 시스템 정적 HTML 뷰 생성기.

`build-site` CLI 가 호출. 단일 ``goals.html`` + 인라인 ``goals.json`` 으로
브라우저만 있으면 어디서든 그래프와 본문을 본다. 노드 클릭 시 우측 패널에
Goal 본문이 표시되고, 상단의 "AI 핸드오프" 버튼으로 슬래시 명령을 클립보드에
복사한다.

외부 의존성: Mermaid CDN 한 개. 오프라인이면 그래프는 안 보이지만 좌측
필터/검색과 우측 본문 패널은 그대로 동작한다.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from .parser import Goal
from .views import generate_graph


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _goal_to_payload(g: Goal) -> dict:
    """HTML 사이드의 ``goals.json`` 항목 — 직렬화 친화 dict."""

    return {
        "id": g.id,
        "title": g.title,
        "status": g.status,
        "tags": list(g.tags),
        "parents": list(g.parents),
        "children": list(g.children),
        "constraints": list(g.constraints),
        "superseded_by": g.superseded_by,
        "intent": g.intent,
        "success_criteria": [sc for sc in g.success_criteria if isinstance(sc, dict)],
        "realizes": list(g.realizes),
        "related_docs": list(g.related_docs),
        "rationale": g.rationale,
        "alternatives_considered": list(g.alternatives_considered),
    }


def generate_site(goals: Sequence[Goal], *, generated_at: str | None = None) -> str:
    """단일 HTML 문서를 반환. 데이터는 ``<script type="application/json">`` 으로 임베드."""

    timestamp = generated_at or _now_iso()
    payload = {
        "generated_at": timestamp,
        "total": len(goals),
        "goals": [_goal_to_payload(g) for g in sorted(goals, key=lambda x: x.id)],
        "mermaid": generate_graph(goals, generated_at=timestamp),
    }
    data_json = json.dumps(payload, ensure_ascii=False)

    # 본문 HTML — 외부 파일 의존 없는 단일 문서.
    return _HTML_TEMPLATE.replace("__DATA_JSON__", _safe_script_json(data_json)) \
                         .replace("__GENERATED_AT__", html.escape(timestamp))


def _safe_script_json(s: str) -> str:
    """``</script>`` 시퀀스가 JSON 안에 들어가도 안전하게 이스케이프."""

    return s.replace("</", "<\\/")


_HTML_TEMPLATE = r"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Goal Browser</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --line: #334155;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8;
    --pillar: #fde68a; --constraint: #fca5a5; --active: #86efac;
    --proposed: #fcd34d; --achieved: #93c5fd;
    --abandoned: #6b7280; --superseded: #c4b5fd;
  }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo",
          "Noto Sans CJK KR", sans-serif; }
  #app { display: grid; grid-template-columns: 320px 1fr 420px; height: 100vh; }
  @media (max-width: 1100px) {
    #app { grid-template-columns: 1fr; grid-template-rows: auto 50vh 50vh; height: auto; }
  }
  .pane { overflow: auto; border-right: 1px solid var(--line); }
  .pane:last-child { border-right: 0; }
  .pane h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); padding: 12px 14px 4px; margin: 0; }
  #filters { padding: 8px 12px; }
  #filters input, #filters select {
    width: 100%; box-sizing: border-box; margin-bottom: 6px;
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    padding: 6px 8px; border-radius: 4px; font: inherit; }
  ul.list { list-style: none; margin: 0; padding: 0; }
  ul.list li { padding: 6px 14px; cursor: pointer; border-left: 3px solid transparent;
    border-bottom: 1px solid var(--line); }
  ul.list li:hover { background: var(--panel); }
  ul.list li.selected { background: var(--panel); border-left-color: var(--accent); }
  .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--accent);
    margin-right: 6px; }
  .status { display: inline-block; padding: 1px 6px; border-radius: 10px;
    font-size: 11px; margin-left: 6px; background: var(--line); }
  .status.active { background: var(--active); color: #052e16; }
  .status.proposed { background: var(--proposed); color: #422006; }
  .status.achieved { background: var(--achieved); color: #082f49; }
  .status.abandoned { background: var(--abandoned); color: #f9fafb; }
  .status.superseded { background: var(--superseded); color: #2e1065; }
  #graph-pane { background: var(--panel); position: relative; }
  #graph { padding: 16px; min-height: 100%; }
  #graph svg { max-width: 100%; height: auto; }
  #graph .clickable { cursor: pointer; }
  #detail { padding: 14px; }
  #detail h1 { font-size: 18px; margin: 0 0 4px; }
  #detail .meta { color: var(--muted); margin-bottom: 12px; font-size: 12px; }
  #detail .tag { display: inline-block; background: var(--line); color: var(--muted);
    padding: 1px 6px; border-radius: 3px; margin: 2px 4px 2px 0; font-size: 11px; }
  #detail h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); margin: 16px 0 6px; border-bottom: 1px solid var(--line);
    padding-bottom: 4px; }
  #detail .actions { display: flex; gap: 6px; margin: 8px 0 12px; flex-wrap: wrap; }
  #detail button { background: var(--accent); color: #0c4a6e; border: 0;
    padding: 6px 10px; border-radius: 4px; cursor: pointer; font: inherit;
    font-weight: 600; }
  #detail button.secondary { background: var(--panel); color: var(--text);
    border: 1px solid var(--line); }
  #detail a { color: var(--accent); text-decoration: none; word-break: break-all; }
  #detail a:hover { text-decoration: underline; }
  #detail pre { background: var(--panel); padding: 8px; border-radius: 4px;
    white-space: pre-wrap; word-break: break-word; }
  #detail ul { padding-left: 18px; }
  #detail .copied { color: var(--active); font-weight: 600; margin-left: 8px; }
  .header { padding: 10px 14px; border-bottom: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: center; }
  .header span { color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<div id="app">
  <div class="pane" id="left-pane">
    <div class="header"><strong>Goals</strong><span id="count"></span></div>
    <div id="filters">
      <input type="search" id="q" placeholder="제목/의도 검색...">
      <select id="status-filter">
        <option value="">모든 status</option>
        <option value="active">active</option>
        <option value="proposed">proposed</option>
        <option value="achieved">achieved</option>
        <option value="abandoned">abandoned</option>
        <option value="superseded">superseded</option>
      </select>
      <select id="tag-filter"><option value="">모든 tag</option></select>
    </div>
    <ul id="list" class="list"></ul>
  </div>
  <div class="pane" id="graph-pane">
    <div class="header"><strong>Graph</strong>
      <span id="generated-at">__GENERATED_AT__</span>
    </div>
    <div id="graph">로딩 중...</div>
  </div>
  <div class="pane" id="detail-pane">
    <div id="detail"><p style="color:var(--muted);padding:20px">왼쪽 목록 또는 그래프에서 Goal 을 선택하세요.</p></div>
  </div>
</div>

<script type="application/json" id="goal-data">__DATA_JSON__</script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
(() => {
  const dataEl = document.getElementById("goal-data");
  const DATA = JSON.parse(dataEl.textContent);
  const goalsById = Object.fromEntries(DATA.goals.map(g => [g.id, g]));
  const allTags = [...new Set(DATA.goals.flatMap(g => g.tags))].sort();

  // --- 필터 UI 초기화 ---
  const tagSelect = document.getElementById("tag-filter");
  for (const t of allTags) {
    const o = document.createElement("option");
    o.value = t; o.textContent = t;
    tagSelect.appendChild(o);
  }

  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("status-filter");

  let selectedId = null;

  function passes(g) {
    const q = qEl.value.trim().toLowerCase();
    if (q && !(g.id.toLowerCase().includes(q)
              || g.title.toLowerCase().includes(q)
              || (g.intent || "").toLowerCase().includes(q))) return false;
    if (statusEl.value && g.status !== statusEl.value) return false;
    if (tagSelect.value && !g.tags.includes(tagSelect.value)) return false;
    return true;
  }

  function renderList() {
    const filtered = DATA.goals.filter(passes);
    countEl.textContent = `${filtered.length} / ${DATA.goals.length}`;
    listEl.innerHTML = "";
    for (const g of filtered) {
      const li = document.createElement("li");
      li.dataset.id = g.id;
      if (g.id === selectedId) li.className = "selected";
      li.innerHTML = `<span class="id">${g.id}</span>${escape(g.title)}`
                   + ` <span class="status ${g.status}">${g.status}</span>`;
      li.addEventListener("click", () => select(g.id));
      listEl.appendChild(li);
    }
  }

  function escape(s) {
    return (s || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function goalLink(id) {
    const g = goalsById[id];
    const title = g ? g.title : "(없음)";
    return `<a href="#" data-goto="${id}">${id}</a> ${escape(title)}`;
  }

  function renderDetail(g) {
    const detail = document.getElementById("detail");
    if (!g) {
      detail.innerHTML = `<p style="color:var(--muted);padding:20px">선택 없음.</p>`;
      return;
    }
    const sc = (g.success_criteria || []).map(c => {
      const mark = (c.achieved || c.met) ? "✓" : "·";
      return `<li><strong>[${mark}]</strong> ${escape(c.description || "")}`
           + (c.measure ? `<br><small style="color:var(--muted)">측정: ${escape(c.measure)}</small>` : "")
           + `</li>`;
    }).join("") || "<li><em>(없음)</em></li>";

    const realizes = (g.realizes || []).map(r => {
      const path = escape(r.path || "");
      const role = r.role ? `<small style="color:var(--muted)"> — ${escape(r.role)}</small>` : "";
      return `<li><code>${path}</code>${role}</li>`;
    }).join("") || "<li><em>(없음)</em></li>";

    const tags = (g.tags || []).map(t => `<span class="tag">${escape(t)}</span>`).join("");
    const linkRow = (label, ids) => {
      if (!ids || !ids.length) return "";
      return `<p><strong>${label}:</strong> ${ids.map(goalLink).join(" · ")}</p>`;
    };

    detail.innerHTML = `
      <h1>${g.id} <span style="color:var(--muted)">·</span> ${escape(g.title)}</h1>
      <div class="meta">
        <span class="status ${g.status}">${g.status}</span> ${tags}
      </div>
      <div class="actions">
        <button data-copy="serve">/goal serve ${g.id}</button>
        <button data-copy="show" class="secondary">/goal show ${g.id}</button>
        <button data-copy="prompt" class="secondary">자연어 프롬프트 복사</button>
        <span id="copied-msg" class="copied" style="display:none">복사됨</span>
      </div>
      ${linkRow("parents", g.parents)}
      ${linkRow("children", g.children)}
      ${linkRow("constraints", g.constraints)}
      <h2>Intent</h2>
      <pre>${escape(g.intent || "(미작성)")}</pre>
      <h2>Success Criteria</h2>
      <ul>${sc}</ul>
      <h2>Realizes</h2>
      <ul>${realizes}</ul>
      ${g.rationale ? `<h2>Rationale</h2><pre>${escape(g.rationale)}</pre>` : ""}
    `;

    detail.querySelectorAll("[data-goto]").forEach(el => {
      el.addEventListener("click", e => {
        e.preventDefault();
        select(el.dataset.goto);
      });
    });
    detail.querySelectorAll("[data-copy]").forEach(btn => {
      btn.addEventListener("click", () => copyHandoff(g, btn.dataset.copy));
    });
  }

  function copyHandoff(g, kind) {
    let text;
    if (kind === "serve") {
      text = `/goal serve ${g.id}`;
    } else if (kind === "show") {
      text = `/goal show ${g.id}`;
    } else {
      // 자연어 프롬프트 — Goal ID + intent 요약을 LLM 에 한 번에 던짐
      const intent = (g.intent || "").trim().split(/\n+/).slice(0, 3).join(" ");
      text = `${g.id} (${g.title}) 봉사 작업 시작해줘. `
           + `Goal 본문은 Docs/goals/${g.id}.md 를 참조하고, `
           + `serve-context 로 constraints 와 realizes 를 먼저 로드해줘.`
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
    selectedId = id;
    renderList();
    renderDetail(goalsById[id]);
    highlightGraph(id);
  }

  function highlightGraph(id) {
    const svg = document.querySelector("#graph svg");
    if (!svg) return;
    svg.querySelectorAll(".node").forEach(n => {
      n.style.outline = "";
      n.style.filter = "";
    });
    const target = svg.querySelector(`.node[id^="flowchart-${id.replace("-","")}-"]`);
    if (target) {
      target.style.filter = "drop-shadow(0 0 6px var(--accent))";
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }

  // --- 필터 이벤트 ---
  qEl.addEventListener("input", renderList);
  statusEl.addEventListener("change", renderList);
  tagSelect.addEventListener("change", renderList);

  // --- Mermaid 렌더 ---
  mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
  mermaid.render("graph-svg", DATA.mermaid).then(({ svg, bindFunctions }) => {
    document.getElementById("graph").innerHTML = svg;
    if (bindFunctions) bindFunctions(document.getElementById("graph"));
    // 노드 클릭 → select
    document.querySelectorAll("#graph .node").forEach(n => {
      n.classList.add("clickable");
      n.addEventListener("click", () => {
        // Mermaid id 패턴: flowchart-{nodeId}-{n}, nodeId = G0107 형태
        const m = n.id.match(/flowchart-(G\d+)-/);
        if (!m) return;
        const raw = m[1];
        const goalId = "G-" + raw.slice(1).padStart(4, "0");
        if (goalsById[goalId]) select(goalId);
      });
    });
  }).catch(err => {
    document.getElementById("graph").innerHTML =
      `<p style="color:var(--muted);padding:20px">그래프 로딩 실패 (오프라인일 수 있음). 좌측 목록과 우측 본문은 동작합니다.<br><small>${escape(err.message || err)}</small></p>`;
  });

  // --- 초기 렌더 ---
  renderList();
  if (DATA.goals.length) select(DATA.goals[0].id);
})();
</script>
</body>
</html>
"""
