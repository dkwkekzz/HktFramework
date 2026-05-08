"""Goal 시스템 정적 HTML 뷰 생성기.

`build-site` CLI 가 호출. 단일 HTML 파일 — 외부 의존성 0 (오프라인 100% 동작).

UX — **스택형 카드 네비게이션** (Andy Matuschak's stacked notes 영감):
- 모든 Goal 이 카드 한 장. 관계 링크를 누르면 그 카드의 우측에 새 카드가 push 된다.
- 데스크톱: 가로 스크롤로 카드들이 누적 — 어느 경로로 들어왔는지 그대로 보인다.
- 모바일: tip 카드 한 장만 풀스크린, 상단 breadcrumb 와 뒤로가기로 스택 탐색.
- 브라우저 뒤로가기 버튼 = 스택 pop. URL hash (`#G-0001/G-0010/G-0142`) 공유 가능.
- 좌측 검색·필터 리스트는 drawer 로 토글 — 필요할 때만 열어서 새 root 진입점 선택.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from typing import Sequence

from .parser import Goal


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _goal_to_payload(g: Goal) -> dict:
    """HTML 사이드 데이터 dict — 직렬화 친화 형태."""

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
    }
    data_json = json.dumps(payload, ensure_ascii=False)

    return _HTML_TEMPLATE.replace("__DATA_JSON__", _safe_script_json(data_json)) \
                         .replace("__GENERATED_AT__", html.escape(timestamp))


def _safe_script_json(s: str) -> str:
    """``</script>`` 가 JSON 페이로드 내부에 들어가도 HTML 파서가 깨지지 않게 이스케이프."""

    return s.replace("</", "<\\/")


_HTML_TEMPLATE = r"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Goal Browser</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --panel2: #273449; --line: #334155;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8; --accent-deep: #0c4a6e;
    --pillar: #fde68a; --constraint: #fca5a5; --active: #86efac;
    --proposed: #fcd34d; --achieved: #93c5fd;
    --abandoned: #6b7280; --superseded: #c4b5fd;
    --topbar-h: 48px;
    --card-w: 440px;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo",
          "Noto Sans CJK KR", sans-serif;
    overscroll-behavior: none;
  }
  body { height: 100vh; display: flex; flex-direction: column; }

  /* --- Top bar --- */
  #topbar {
    height: var(--topbar-h); flex: 0 0 auto;
    display: flex; align-items: center; gap: 6px;
    padding: 0 10px; background: var(--bg);
    border-bottom: 1px solid var(--line); z-index: 30;
  }
  #topbar button {
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    padding: 6px 10px; border-radius: 4px; cursor: pointer; font: inherit;
    line-height: 1; min-width: 34px; flex: 0 0 auto;
  }
  #topbar button:hover:not(:disabled) { background: var(--panel2); }
  #topbar button:disabled { opacity: 0.35; cursor: not-allowed; }
  #breadcrumb {
    flex: 1 1 auto; display: flex; gap: 2px; overflow-x: auto;
    align-items: center; min-width: 0;
    scrollbar-width: thin; padding: 2px 0;
  }
  #breadcrumb::-webkit-scrollbar { height: 4px; }
  #breadcrumb .crumb {
    flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 12px;
    background: var(--panel); border: 1px solid var(--line);
    color: var(--muted); font-size: 11px; cursor: pointer;
    max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-family: inherit;
  }
  #breadcrumb .crumb:hover { background: var(--panel2); color: var(--text); }
  #breadcrumb .crumb.tip {
    color: var(--text); border-color: var(--accent);
    background: var(--panel2);
  }
  #breadcrumb .crumb .id { font-size: 11px; margin: 0; }
  #breadcrumb .crumb .ttl {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 160px;
  }
  #breadcrumb .sep { color: var(--muted); font-size: 11px; flex: 0 0 auto; padding: 0 2px; }
  #generated { color: var(--muted); font-size: 11px; flex: 0 0 auto; }

  /* --- Drawer --- */
  #drawer-scrim {
    position: fixed; inset: var(--topbar-h) 0 0 0;
    background: rgba(0,0,0,0.5); opacity: 0; pointer-events: none;
    transition: opacity 0.18s ease-out; z-index: 25;
  }
  #drawer-scrim.show { opacity: 1; pointer-events: auto; }
  #drawer {
    position: fixed; top: var(--topbar-h); left: 0; bottom: 0;
    width: 320px; max-width: 92vw; background: var(--bg);
    border-right: 1px solid var(--line);
    display: flex; flex-direction: column;
    transform: translateX(-100%); transition: transform 0.18s ease-out;
    z-index: 26;
  }
  #drawer.open { transform: translateX(0); box-shadow: 4px 0 16px rgba(0,0,0,0.4); }
  #drawer .drawer-head {
    padding: 10px 14px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px;
  }
  #drawer .drawer-head .muted { color: var(--muted); font-size: 12px; }
  #drawer .drawer-head .close-btn {
    background: transparent; color: var(--muted); border: 0; cursor: pointer;
    font-size: 22px; padding: 0 4px; line-height: 1;
  }
  #filters { padding: 10px 12px; border-bottom: 1px solid var(--line); }
  #filters input, #filters select {
    width: 100%; margin-bottom: 6px;
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    padding: 7px 9px; border-radius: 4px; font: inherit;
  }
  #drawer .drawer-body { overflow-y: auto; flex: 1; }
  ul.list { list-style: none; margin: 0; padding: 0; }
  ul.list li {
    padding: 7px 14px; cursor: pointer; border-left: 3px solid transparent;
    border-bottom: 1px solid var(--line); line-height: 1.35;
  }
  ul.list li:hover { background: var(--panel); }
  ul.list li.in-stack { background: var(--panel); border-left-color: var(--accent); }
  ul.list li.tip { background: var(--panel2); border-left-color: var(--active); }

  /* --- Stack of cards --- */
  #stack {
    flex: 1 1 auto; min-height: 0;
    display: flex; flex-direction: row;
    overflow-x: auto; overflow-y: hidden;
    scroll-snap-type: x proximity;
    scroll-behavior: smooth;
    background: var(--bg);
  }
  .card {
    flex: 0 0 var(--card-w); width: var(--card-w);
    height: 100%; overflow-y: auto;
    border-right: 1px solid var(--line);
    background: var(--panel);
    scroll-snap-align: start;
    transition: filter 0.2s ease-out, background 0.2s ease-out;
    position: relative;
  }
  .card.tip {
    background: var(--panel2);
    box-shadow: -10px 0 24px -8px rgba(0,0,0,0.5);
    z-index: 2;
  }
  .card-head {
    position: sticky; top: 0; z-index: 3;
    padding: 12px 16px 10px; background: inherit;
    border-bottom: 1px solid var(--line);
  }
  .card-head .row1 {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .card-head h1 {
    font-size: 16px; margin: 4px 0 4px; line-height: 1.3; font-weight: 600;
  }
  .card-head .tags { margin-top: 4px; }

  .card-body { padding: 14px 16px 36px; }
  .card-body .actions { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
  .card-body .actions button {
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    padding: 4px 9px; border-radius: 3px; cursor: pointer; font: inherit;
    font-size: 12px;
  }
  .card.tip .card-body .actions button { background: var(--bg); }
  .card-body .actions button.primary {
    background: var(--accent); color: var(--accent-deep); border-color: var(--accent);
    font-weight: 600;
  }
  .card-body .actions button.primary:hover { filter: brightness(1.08); }
  .card-body .actions button:hover { border-color: var(--accent); }
  .card-body .actions .copied { color: var(--active); font-size: 11px; font-weight: 600; }
  .card-body h2 {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--muted); margin: 16px 0 6px; font-weight: 600;
    border-bottom: 1px solid var(--line); padding-bottom: 4px;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .card-body h2 .arrow { color: var(--accent); margin-right: 4px; }
  .card-body h2 .count { font-size: 11px; color: var(--muted); font-weight: 400; }
  .card-body pre {
    background: var(--panel); padding: 10px; border-radius: 4px;
    white-space: pre-wrap; word-break: break-word; margin: 0; font: inherit;
    font-size: 13px; line-height: 1.5;
  }
  .card.tip .card-body pre { background: var(--bg); }
  .card-body ul.linked { padding-left: 18px; margin: 6px 0; }
  .card-body ul.linked li { margin-bottom: 6px; line-height: 1.4; }
  .card-body code {
    background: var(--panel); padding: 1px 5px; border-radius: 3px;
    font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .card.tip .card-body code { background: var(--bg); }
  .card-body ul.rel { list-style: none; padding: 0; margin: 4px 0; }
  .card-body ul.rel li {
    padding: 6px 8px; margin: 2px 0; cursor: pointer;
    border-left: 3px solid transparent; border-radius: 3px;
    background: var(--panel); transition: background 0.1s, border-color 0.1s;
    line-height: 1.35;
  }
  .card.tip .card-body ul.rel li { background: var(--bg); }
  .card-body ul.rel li:hover { background: var(--panel2); border-left-color: var(--accent); }
  .card-body ul.rel li.in-stack { border-left-color: var(--accent); }
  .card-body ul.rel li.tip { border-left-color: var(--active); background: var(--panel2); }
  .card-body ul.rel li.missing { color: var(--muted); cursor: not-allowed; }
  .card-body .none {
    color: var(--muted); font-style: italic; font-size: 12px; padding: 4px 0;
  }
  .card-body .toggle-more {
    color: var(--accent); cursor: pointer; padding: 6px 0; font-size: 12px;
    display: inline-block;
  }
  .card-body .toggle-more:hover { text-decoration: underline; }

  /* --- shared chips --- */
  .id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--accent); margin-right: 4px; font-weight: 600;
  }
  .status {
    display: inline-block; padding: 1px 6px; border-radius: 10px;
    font-size: 11px; background: var(--line);
  }
  .status.active { background: var(--active); color: #052e16; }
  .status.proposed { background: var(--proposed); color: #422006; }
  .status.achieved { background: var(--achieved); color: #082f49; }
  .status.abandoned { background: var(--abandoned); color: #f9fafb; }
  .status.superseded { background: var(--superseded); color: #2e1065; }
  .pill {
    display: inline-block; font-size: 10px; padding: 1px 5px; border-radius: 3px;
    background: var(--line); color: var(--muted);
  }
  .pill.pillar { background: var(--pillar); color: #422006; }
  .pill.constraint { background: var(--constraint); color: #4c0519; }
  .tag {
    display: inline-block; background: var(--line); color: var(--muted);
    padding: 1px 6px; border-radius: 3px; margin: 2px 4px 2px 0; font-size: 11px;
  }

  .empty-hint { color: var(--muted); padding: 24px 14px; text-align: center; }

  /* --- Mobile (≤ 800px) --- */
  @media (max-width: 800px) {
    :root { --card-w: 100vw; }
    #stack {
      flex-direction: column;
      overflow-x: hidden; overflow-y: auto;
      scroll-snap-type: none;
    }
    .card {
      flex: 0 0 auto; width: 100%; height: auto;
      min-height: 100%; border-right: 0;
      border-bottom: 1px solid var(--line);
      overflow-y: visible;
      display: none;
      box-shadow: none;
    }
    .card.tip { display: block; }
    #drawer { width: 100%; max-width: 100%; }
    .card-body { padding-bottom: 60px; }
  }
</style>
</head>
<body>
  <header id="topbar">
    <button id="btn-menu" title="목록 (/)" aria-label="목록">≡</button>
    <button id="btn-back" title="뒤로 (Backspace)" aria-label="뒤로" disabled>←</button>
    <nav id="breadcrumb" aria-label="navigation stack"></nav>
    <span id="generated" title="last generated">__GENERATED_AT__</span>
  </header>
  <div id="drawer-scrim"></div>
  <aside id="drawer" aria-hidden="true">
    <div class="drawer-head">
      <div><strong>Goals</strong> <span class="muted" id="count"></span></div>
      <button id="btn-close-drawer" class="close-btn" aria-label="닫기">×</button>
    </div>
    <div id="filters">
      <input type="search" id="q" placeholder="ID/제목/의도 검색...">
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
    <div class="drawer-body"><ul id="list" class="list"></ul></div>
  </aside>
  <main id="stack" aria-live="polite"></main>

<script type="application/json" id="goal-data">__DATA_JSON__</script>
<script>
(() => {
  const DATA = JSON.parse(document.getElementById("goal-data").textContent);
  const goalsById = Object.fromEntries(DATA.goals.map(g => [g.id, g]));

  // 역참조 인덱스: 누가 이 Goal 을 constraint 로 참조하는가
  const constrainedByIndex = {};
  for (const g of DATA.goals) {
    for (const cid of g.constraints || []) {
      (constrainedByIndex[cid] = constrainedByIndex[cid] || []).push(g.id);
    }
  }

  function ancestorsOf(id) {
    const out = new Set();
    const work = [id];
    while (work.length) {
      const cur = work.pop();
      const g = goalsById[cur]; if (!g) continue;
      for (const p of g.parents || []) {
        if (out.has(p) || p === id) continue;
        out.add(p); work.push(p);
      }
    }
    return [...out];
  }
  function descendantsOf(id) {
    const out = new Set();
    const work = [id];
    while (work.length) {
      const cur = work.pop();
      const g = goalsById[cur]; if (!g) continue;
      for (const c of g.children || []) {
        if (out.has(c) || c === id) continue;
        out.add(c); work.push(c);
      }
    }
    return [...out];
  }
  function siblingsOf(id) {
    const g = goalsById[id]; if (!g) return [];
    const out = new Set();
    for (const p of g.parents || []) {
      const parent = goalsById[p]; if (!parent) continue;
      for (const c of parent.children || []) {
        if (c !== id && goalsById[c]) out.add(c);
      }
    }
    return [...out].sort();
  }

  function escape(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function isPillar(g) { return (g.tags || []).some(t => t.startsWith("pillar:")); }
  function isConstraint(g) { return (g.tags || []).includes("constraint"); }
  function pillHtml(g) {
    if (isPillar(g)) return `<span class="pill pillar">pillar</span>`;
    if (isConstraint(g)) return `<span class="pill constraint">constraint</span>`;
    return "";
  }

  // --- DOM ---
  const stackEl = document.getElementById("stack");
  const breadcrumbEl = document.getElementById("breadcrumb");
  const drawerEl = document.getElementById("drawer");
  const scrimEl = document.getElementById("drawer-scrim");
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("status-filter");
  const tagSelect = document.getElementById("tag-filter");
  const btnBack = document.getElementById("btn-back");
  const btnMenu = document.getElementById("btn-menu");
  const btnCloseDrawer = document.getElementById("btn-close-drawer");

  const allTags = [...new Set(DATA.goals.flatMap(g => g.tags))].sort();
  for (const t of allTags) {
    const o = document.createElement("option");
    o.value = t; o.textContent = t;
    tagSelect.appendChild(o);
  }

  // --- 스택 상태 ---
  let stackIds = [];
  function inStack(id) { return stackIds.includes(id); }
  function isTip(id) { return stackIds[stackIds.length - 1] === id; }

  // --- 렌더링 ---
  function renderBreadcrumb() {
    breadcrumbEl.innerHTML = "";
    stackIds.forEach((id, i) => {
      const g = goalsById[id];
      const tip = i === stackIds.length - 1;
      const crumb = document.createElement("button");
      crumb.type = "button";
      crumb.className = "crumb" + (tip ? " tip" : "");
      crumb.title = g ? g.title : "(missing)";
      crumb.dataset.idx = String(i);
      crumb.innerHTML = `<span class="id">${escape(id)}</span>`
                     + `<span class="ttl">${escape(g ? g.title : "(missing)")}</span>`;
      crumb.addEventListener("click", () => navigateToIndex(i));
      breadcrumbEl.appendChild(crumb);
      if (i < stackIds.length - 1) {
        const sep = document.createElement("span");
        sep.className = "sep"; sep.textContent = "›";
        breadcrumbEl.appendChild(sep);
      }
    });
    requestAnimationFrame(() => {
      const last = breadcrumbEl.lastElementChild;
      if (last) last.scrollIntoView({ inline: "end", block: "nearest" });
    });
  }

  function renderRelationSection(arrow, label, ids, ownerCardIdx, limit) {
    const total = ids.length;
    let html = `<h2><span><span class="arrow">${arrow}</span>${escape(label)}</span>`
             + `<span class="count">${total}</span></h2>`;
    if (total === 0) return html + `<div class="none">(없음)</div>`;
    const useLimit = limit > 0 && total > limit;
    const items = ids.map((id, i) => {
      const overflow = useLimit && i >= limit;
      const g = goalsById[id];
      if (!g) {
        return `<li class="missing${overflow ? " overflow" : ""}"${overflow ? " hidden" : ""}>`
             + `<span class="id">${escape(id)}</span>(없음)</li>`;
      }
      const cls = [];
      if (overflow) cls.push("overflow");
      if (inStack(id)) cls.push(isTip(id) ? "tip" : "in-stack");
      return `<li class="${cls.join(" ")}"${overflow ? " hidden" : ""}`
           + ` data-goto="${escape(id)}" data-from="${ownerCardIdx}"`
           + ` title="${escape(g.title)}">`
           + `<span class="id">${escape(g.id)}</span>${escape(g.title)} `
           + `<span class="status ${escape(g.status)}">${escape(g.status)}</span>`
           + `${pillHtml(g)}</li>`;
    }).join("");
    html += `<ul class="rel">${items}</ul>`;
    if (useLimit) {
      html += `<div class="toggle-more">+ ${total - limit}개 더 보기</div>`;
    }
    return html;
  }

  function renderCard(id, idx) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = id;
    card.dataset.idx = String(idx);

    const g = goalsById[id];
    if (!g) {
      card.innerHTML = `<div class="empty-hint"><span class="id">${escape(id)}</span><br>데이터에 없는 ID 입니다.</div>`;
      return card;
    }

    const tags = (g.tags || []).map(t => `<span class="tag">${escape(t)}</span>`).join("");

    const sc = (g.success_criteria || []).map(c => {
      const mark = (c.achieved || c.met) ? "✓" : "·";
      return `<li><strong>[${mark}]</strong> ${escape(c.description || "")}`
           + (c.measure ? `<br><small style="color:var(--muted)">측정: ${escape(c.measure)}</small>` : "")
           + `</li>`;
    }).join("") || "<li><em style=\"color:var(--muted)\">(없음)</em></li>";

    const realizes = (g.realizes || []).map(r => {
      const path = escape(r.path || "");
      const role = r.role ? `<small style="color:var(--muted)"> — ${escape(r.role)}</small>` : "";
      return `<li><code>${path}</code>${role}</li>`;
    }).join("") || "<li><em style=\"color:var(--muted)\">(없음)</em></li>";

    const ancestors = ancestorsOf(g.id).filter(a => !(g.parents || []).includes(a)).sort();
    const descendants = descendantsOf(g.id).filter(d => !(g.children || []).includes(d)).sort();
    const siblings = siblingsOf(g.id);
    const constrainedBy = (constrainedByIndex[g.id] || []).slice().sort();

    const rationaleSection = g.rationale
      ? `<h2><span><span class="arrow">💭</span>Rationale</span><span class="count"></span></h2>`
        + `<pre>${escape(g.rationale)}</pre>`
      : "";

    card.innerHTML = `
      <header class="card-head">
        <div class="row1">
          <span class="id">${escape(g.id)}</span>
          <span class="status ${escape(g.status)}">${escape(g.status)}</span>
          ${pillHtml(g)}
        </div>
        <h1>${escape(g.title)}</h1>
        <div class="tags">${tags}</div>
      </header>
      <section class="card-body">
        <div class="actions">
          <button data-copy="serve" class="primary">/goal serve ${escape(g.id)}</button>
          <button data-copy="show">/goal show</button>
          <button data-copy="prompt">자연어 프롬프트</button>
          <span class="copied" hidden>복사됨</span>
        </div>
        <h2><span><span class="arrow">📝</span>Intent</span><span class="count"></span></h2>
        <pre>${escape(g.intent || "(미작성)")}</pre>
        <h2><span><span class="arrow">✅</span>Success Criteria</span>`
        + `<span class="count">${(g.success_criteria || []).length}</span></h2>`
        + `<ul class="linked">${sc}</ul>`
        + `<h2><span><span class="arrow">🛠</span>Realizes</span>`
        + `<span class="count">${(g.realizes || []).length}</span></h2>`
        + `<ul class="linked">${realizes}</ul>`
        + rationaleSection
        + renderRelationSection("↑", "parents", g.parents || [], idx, 0)
        + renderRelationSection("↑↑", "ancestors (전이)", ancestors, idx, 8)
        + renderRelationSection("⊂", "constraints", g.constraints || [], idx, 0)
        + renderRelationSection("⊃", "constrained by (역참조)", constrainedBy, idx, 0)
        + renderRelationSection("↔", "siblings (부모 공유)", siblings, idx, 10)
        + renderRelationSection("↓", "children", g.children || [], idx, 0)
        + renderRelationSection("↓↓", "descendants (전이)", descendants, idx, 12)
      + `</section>`;
    return card;
  }

  function attachCardHandlers(card) {
    card.querySelectorAll("[data-goto]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = el.dataset.goto;
        const from = parseInt(el.dataset.from, 10);
        navigateToChild(id, from);
      });
    });
    card.querySelectorAll(".toggle-more").forEach(el => {
      el.addEventListener("click", () => {
        const ul = el.previousElementSibling;
        if (ul && ul.classList.contains("rel")) {
          ul.querySelectorAll("li.overflow").forEach(li => { li.hidden = false; });
        }
        el.remove();
      });
    });
    card.querySelectorAll("[data-copy]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = card.dataset.id;
        const g = goalsById[id];
        if (!g) return;
        copyHandoff(g, btn.dataset.copy, card);
      });
    });
  }

  function copyHandoff(g, kind, card) {
    let text;
    if (kind === "serve") {
      text = `/goal serve ${g.id}`;
    } else if (kind === "show") {
      text = `/goal show ${g.id}`;
    } else {
      const intent = (g.intent || "").trim().split(/\n+/).slice(0, 3).join(" ");
      text = `${g.id} (${g.title}) 봉사 작업 시작해줘. `
           + `Goal 본문은 Docs/goals/${g.id}.md 를 참조하고, `
           + `serve-context 로 constraints 와 realizes 를 먼저 로드해줘.`
           + (intent ? `\n\n의도: ${intent}` : "");
    }
    navigator.clipboard.writeText(text).then(() => {
      const m = card.querySelector(".copied");
      if (m) {
        m.hidden = false;
        setTimeout(() => { m.hidden = true; }, 1200);
      }
    });
  }

  function renderStack() {
    stackEl.innerHTML = "";
    stackIds.forEach((id, idx) => {
      const card = renderCard(id, idx);
      if (idx === stackIds.length - 1) card.classList.add("tip");
      stackEl.appendChild(card);
      attachCardHandlers(card);
    });
    btnBack.disabled = stackIds.length <= 1;
    requestAnimationFrame(scrollToTip);
  }

  function scrollToTip() {
    const last = stackEl.lastElementChild;
    if (!last) return;
    if (window.matchMedia("(max-width: 800px)").matches) {
      window.scrollTo({ top: 0 });
      last.scrollTop = 0;
    } else {
      last.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
    }
  }

  // --- 네비게이션 ---
  function syncHistory(replace) {
    const url = "#" + stackIds.join("/");
    const stateObj = { stack: [...stackIds] };
    if (replace) {
      history.replaceState(stateObj, "", url);
    } else if (location.hash !== url || !history.state || !history.state.stack) {
      history.pushState(stateObj, "", url);
    } else {
      history.replaceState(stateObj, "", url);
    }
  }

  function navigateToChild(id, fromIdx) {
    if (!goalsById[id]) return;
    if (typeof fromIdx !== "number" || fromIdx < 0) fromIdx = stackIds.length - 1;
    const nextStack = stackIds.slice(0, fromIdx + 1);
    const existing = nextStack.indexOf(id);
    if (existing !== -1) {
      stackIds = nextStack;
      syncHistory(false);
      renderBreadcrumb();
      renderListSelection();
      renderStack();
      requestAnimationFrame(() => {
        const card = stackEl.children[existing];
        if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      });
      return;
    }
    nextStack.push(id);
    stackIds = nextStack;
    syncHistory(false);
    renderBreadcrumb();
    renderListSelection();
    renderStack();
  }

  function navigateToIndex(idx) {
    if (idx < 0 || idx >= stackIds.length) return;
    if (idx === stackIds.length - 1) { scrollToTip(); return; }
    stackIds = stackIds.slice(0, idx + 1);
    syncHistory(false);
    renderBreadcrumb();
    renderListSelection();
    renderStack();
  }

  function setRoot(id) {
    if (!goalsById[id]) return;
    stackIds = [id];
    syncHistory(false);
    renderBreadcrumb();
    renderListSelection();
    renderStack();
  }

  function back() {
    if (stackIds.length > 1) history.back();
  }

  window.addEventListener("popstate", e => {
    let next = null;
    if (e.state && Array.isArray(e.state.stack)) {
      next = e.state.stack.filter(id => goalsById[id]);
    } else {
      next = parseHash();
    }
    if (!next.length && DATA.goals.length) next = [DATA.goals[0].id];
    stackIds = next;
    renderBreadcrumb();
    renderListSelection();
    renderStack();
  });

  function parseHash() {
    return location.hash.replace(/^#/, "")
      .split("/").map(decodeURIComponent)
      .filter(s => s && goalsById[s]);
  }

  // --- Drawer / 검색 ---
  function passes(g) {
    const q = qEl.value.trim().toLowerCase();
    if (q && !(g.id.toLowerCase().includes(q)
              || g.title.toLowerCase().includes(q)
              || (g.intent || "").toLowerCase().includes(q))) return false;
    if (statusEl.value && g.status !== statusEl.value) return false;
    if (tagSelect.value && !(g.tags || []).includes(tagSelect.value)) return false;
    return true;
  }
  function renderList() {
    const filtered = DATA.goals.filter(passes);
    countEl.textContent = `${filtered.length} / ${DATA.goals.length}`;
    listEl.innerHTML = "";
    for (const g of filtered) {
      const li = document.createElement("li");
      li.dataset.id = g.id;
      if (inStack(g.id)) li.classList.add(isTip(g.id) ? "tip" : "in-stack");
      li.innerHTML = `<span class="id">${escape(g.id)}</span>${escape(g.title)} `
                   + `<span class="status ${escape(g.status)}">${escape(g.status)}</span>`
                   + `${pillHtml(g)}`;
      li.addEventListener("click", () => {
        setRoot(g.id);
        if (window.matchMedia("(max-width: 800px)").matches) closeDrawer();
      });
      listEl.appendChild(li);
    }
  }
  function renderListSelection() {
    listEl.querySelectorAll("li").forEach(li => {
      li.classList.remove("in-stack", "tip");
      if (inStack(li.dataset.id)) {
        li.classList.add(isTip(li.dataset.id) ? "tip" : "in-stack");
      }
    });
  }

  function openDrawer() {
    drawerEl.classList.add("open");
    drawerEl.setAttribute("aria-hidden", "false");
    scrimEl.classList.add("show");
    setTimeout(() => qEl.focus(), 50);
  }
  function closeDrawer() {
    drawerEl.classList.remove("open");
    drawerEl.setAttribute("aria-hidden", "true");
    scrimEl.classList.remove("show");
  }

  btnMenu.addEventListener("click", () => {
    drawerEl.classList.contains("open") ? closeDrawer() : openDrawer();
  });
  btnCloseDrawer.addEventListener("click", closeDrawer);
  scrimEl.addEventListener("click", closeDrawer);
  btnBack.addEventListener("click", back);

  qEl.addEventListener("input", renderList);
  statusEl.addEventListener("change", renderList);
  tagSelect.addEventListener("change", renderList);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (drawerEl.classList.contains("open")) {
        closeDrawer(); e.preventDefault();
      }
      return;
    }
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "Backspace" || (e.key === "ArrowLeft" && (e.altKey || e.metaKey))) {
      e.preventDefault(); back();
    } else if (e.key === "/" || e.key === "s") {
      e.preventDefault(); openDrawer();
    }
  });

  // --- 초기화 ---
  renderList();
  let initial = parseHash();
  if (!initial.length && DATA.goals.length) {
    initial = [DATA.goals[0].id];
  }
  stackIds = initial;
  syncHistory(true);
  renderBreadcrumb();
  renderListSelection();
  renderStack();
})();
</script>
</body>
</html>
"""
