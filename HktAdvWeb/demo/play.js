// =====================================================================
// 플레이 클라이언트 (P0) — 서버 상태 payload 만 그린다 (src/ import 금지, 원칙 ⑥)
// ---------------------------------------------------------------------
// 폴링으로 상태를 받아 지도·무대·목적 카드·주기·피드를 렌더하고, 버튼 입력을
// /api/play/* 로 보낸다. 규칙 판정은 전부 서버(법칙 apply) — 여기엔 게임 규칙이 없다.
// =====================================================================
/* global document, window, fetch, localStorage */

const $ = (id) => document.getElementById(id);
let ME = localStorage.getItem('hktadv-player') || null;
let STATE = null;

// 지역 노드의 화면 좌표 (지도는 추상 그래프 — 이 좌표는 그리기 전용)
const POS = {
  R0: [140, 30], R6: [35, 150], R3: [95, 150], R1: [160, 150],
  R2: [225, 150], R4: [255, 230], R5: [140, 240],
};

// 무대별 행동 버튼 (표시는 클라이언트, 판정은 서버)
const ACTIONS = {
  'S-0045': [
    { label: '정밀 채취 (소량·깨끗)', act: { verb: '채취', stage: 'S-0045', params: { 정밀도: 0.9 } } },
    { label: '신속 채취 (다량·오염)', act: { verb: '채취', stage: 'S-0045', params: { 정밀도: 0.4 } }, warn: true },
    { label: '표본 관찰 (에너지 순환)', act: { verb: '관찰', stage: 'S-0045', params: { 주제: '신.에너지순환' } } },
  ],
  'S-0103': [
    { label: '흉터 조사 (행동 주기)', act: { verb: '관찰', stage: 'S-0103', params: { 주제: '신.행동주기' } } },
    { label: '유출 에너지 수확', act: { verb: '수확', stage: 'S-0103' } },
  ],
  'S-0102': [
    { label: '심장 적출 (분산 창에만)', act: { verb: '채취', stage: 'S-0102', params: { 정밀도: 0.85 } }, warn: true },
  ],
  'S-0201': [
    { label: '표층 채굴 (실험급)', act: { verb: '채취', stage: 'S-0201', target: '수정-표층-R2', params: { 정밀도: 0.9 } } },
    { label: '심부 채굴 (무기급)', act: { verb: '채취', stage: 'S-0201', target: '수정-심부-R2', params: { 정밀도: 0.9 } }, warn: true },
  ],
  'S-0302': [
    { label: '균류 채취', act: { verb: '채취', stage: 'S-0302', params: { 정밀도: 0.8 } } },
    { label: '압착 → 단열재 (정제)', act: { verb: '정제', stage: 'S-0302', params: { 산출: '단열재' } } },
  ],
  'S-0502': [
    { label: '증표로 신뢰 쌓기 (협상)', act: { verb: '협상', stage: 'S-0502', params: { 신뢰단계: 1 } } },
  ],
};

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  return res.json();
}

function err(msg) {
  $('err').textContent = msg || '';
  if (msg) setTimeout(() => { if ($('err').textContent === msg) $('err').textContent = ''; }, 3500);
}

async function join() {
  const r = await api('/api/play/join', { name: $('name').value || '모험가' });
  ME = r.id;
  localStorage.setItem('hktadv-player', ME);
  $('joinWrap').style.display = 'none';
  render(r.state);
}

async function send(path, body) {
  const r = await api(path, { id: ME, ...body });
  if (r.error) err(r.error);
  if (r.state) render(r.state);
}

function render(s) {
  STATE = s;
  $('tick').textContent = `t${s.tick}`;
  $('energy').textContent = `에너지 ${s.you.energy}`;

  // 주기 칩 — 상태형 재료의 다이얼
  $('cycles').innerHTML = s.cycles.map((c) => c.open
    ? `<span class="chip open">${c.name} 열림 ·${c.closesIn}</span>`
    : `<span class="chip">${c.name} +${c.opensIn}</span>`).join(' ');

  drawMap(s);
  $('travel').textContent = s.you.traveling
    ? `이동 중 → ${s.you.traveling.to} (남은 ${s.you.traveling.remaining}틱)` : '';

  // 지역·무대
  const r = s.region;
  $('regionTitle').textContent = `${r.name} (${r.id}) — 위험도 ${'★'.repeat(r.danger || 0)}`;
  $('stages').innerHTML = r.stages.map((st) => {
    const timers = [];
    if (st.timers['잔여시간'] !== null) timers.push(`잔여시간 ${st.timers['잔여시간']}`);
    if (st.timers['신선도'] !== null) timers.push(`신선도 ${st.timers['신선도']}`);
    const acts = (ACTIONS[st.id] || []).map((a, i) => {
      const gone = st.source !== '?' && a.act.verb === '채취' && st.targets.length === 0;
      return `<button class="${a.warn ? 'warn' : ''}" ${s.you.traveling || gone ? 'disabled' : ''}
        data-stage="${st.id}" data-i="${i}">${a.label}</button>`;
    }).join('');
    const gates = st.targets.filter((t) => t.gate).map((t) =>
      `<span class="chip ${t.gateOpen ? 'open' : ''}">${t.gate} ${t.gateOpen ? '창 열림' : '창 밖'}</span>`).join(' ');
    return `<div class="stage"><b>${st.source === '?' ? `${st.id} — ?` : st.source}</b>
      <div class="timers">${timers.join(' · ') || '&nbsp;'} ${gates}</div>${acts}</div>`;
  }).join('') || '<div class="timers">이 지역에는 알려진 무대가 없다.</div>';
  $('others').textContent = r.others.length ? `함께 있는 존재: ${r.others.join(', ')}` : '';

  // 활성 목적 카드 — 퍼센트 없음, 조건 서술만 (§6.3)
  const g = s.you.activeGoal;
  $('goalCard').innerHTML = g ? `
    <div class="title">${g.title} ${g.done ? '✓' : ''}</div>
    <div class="timers">${g.desired}</div>
    ${g.conditions.map((c) => `<div class="cond ${c.met ? 'met' : 'unmet'}">${c.met ? '●' : '○'} ${c.text}</div>`).join('')}
  ` : '활성 목적 없음';

  const sel = $('goalSel');
  sel.innerHTML = s.you.goals.map((o) =>
    `<option value="${o.id}" ${o.id === g?.id ? 'selected' : ''}>${o.done ? '✓ ' : ''}[${o.state}] ${o.title}</option>`).join('');

  $('inv').innerHTML = s.you.inventory.map((m) => `<li>${m}</li>`).join('') || '<li>비어 있음</li>';

  $('feed').innerHTML = s.feed.map((f) => `<div class="f-${f.kind}">t${f.t} · ${f.text}</div>`).join('');
  $('feed').scrollTop = $('feed').scrollHeight;
}

function drawMap(s) {
  const cv = $('map');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#26304a';
  for (const r of s.map) {
    for (const a of r.adjacent) {
      const [x1, y1] = POS[r.id] || [0, 0];
      const [x2, y2] = POS[a] || [0, 0];
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  for (const r of s.map) {
    const [x, y] = POS[r.id] || [0, 0];
    ctx.beginPath();
    ctx.fillStyle = r.here ? '#3d68b0' : '#1b2233';
    ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = r.here ? '#7fb7ff' : '#33538a'; ctx.stroke();
    ctx.fillStyle = '#cfd6e4'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(r.id, x, y + 3);
    ctx.fillStyle = '#7f9cc4';
    ctx.fillText(r.name, x, y + 28);
  }
  if (s.you.traveling) {
    const [x, y] = POS[s.you.traveling.to] || [0, 0];
    ctx.strokeStyle = '#ffd479';
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.stroke();
  }
}

// ── 입력 배선 ──
$('joinBtn').onclick = join;
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

$('stages').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const a = (ACTIONS[b.dataset.stage] || [])[Number(b.dataset.i)];
  if (a) send('/api/play/act', a.act);
});

$('map').addEventListener('click', (e) => {
  if (!STATE) return;
  const rect = e.target.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (e.target.width / rect.width);
  const y = (e.clientY - rect.top) * (e.target.height / rect.height);
  for (const [rid, [px, py]] of Object.entries(POS)) {
    if ((x - px) ** 2 + (y - py) ** 2 < 20 ** 2 && rid !== STATE.you.region) {
      send('/api/play/move', { to: rid });
      return;
    }
  }
});

$('goalSel').addEventListener('change', (e) => send('/api/play/goal', { goal: e.target.value }));

// ── 폴링 — 다른 플레이어·주기·봇의 변화가 흘러들어온다 ──
async function poll() {
  if (ME) {
    const r = await api(`/api/play/state?id=${ME}`);
    if (r.error) { ME = null; localStorage.removeItem('hktadv-player'); $('joinWrap').style.display = 'flex'; }
    else render(r);
  }
  window.setTimeout(poll, 800);
}

// ?name=... 자동 입장 / ?id=... 기존 플레이어로 재접속 (데모·스크린샷 재현용)
const qs = new URLSearchParams(window.location.search);
if (qs.get('id')) { ME = qs.get('id'); localStorage.setItem('hktadv-player', ME); }
const auto = qs.get('name');
if (ME) {
  $('joinWrap').style.display = 'none';
} else if (auto) {
  $('name').value = auto;
  join();
}
poll();
