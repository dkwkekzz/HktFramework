// =====================================================================
// 플레이 클라이언트 (P0.5) — 캔버스 게임 뷰 (src/ import 금지, 원칙 ⑥)
// ---------------------------------------------------------------------
// P0 은 버튼 패널이었다. P0.5 는 MMORPG 의 몸을 그린다: 존(zone) 좌표 위에서
// 내 캐릭터를 클릭/WASD 로 움직이고, 돌아다니는 몹을 클릭해 사냥하고(HP바·
// 데미지 플로터·처치), 노드에 다가가 채집한다(채널링 진행 링). 재료 공명은
// GLOW 로 빛난다. 판정은 전부 서버(법칙 apply → done_when → 파문) — 여기엔
// 게임 규칙이 한 줄도 없다. 클라이언트는 상태 payload 를 그리고 의도만 보낸다.
//
// 렌더는 폴링(250ms)한 스냅샷 위치를 목표로 삼아 매 프레임 보간(lerp)해
// 부드럽게 움직인다. 카메라는 내 캐릭터를 추적한다.
// =====================================================================
/* global document, window, fetch, localStorage, requestAnimationFrame, devicePixelRatio */

var $ = function (id) { return document.getElementById(id); };
var ME = localStorage.getItem('hktadv-player') || null;
var STATE = null;

// 지역 노드의 화면 좌표 (지도는 추상 그래프 — 이 좌표는 그리기 전용)
var POS = {
  R0: [105, 25], R6: [28, 118], R3: [72, 118], R1: [122, 118],
  R2: [172, 118], R4: [195, 178], R5: [107, 185],
};

// 무대별 정밀 행동 (채집으로 안 잡히는 관찰·정제 등 — 판정은 서버)
var ACTIONS = {
  'S-0045': [
    { label: '표본 관찰 (에너지 순환)', act: { verb: '관찰', stage: 'S-0045', params: { 주제: '신.에너지순환' } } },
  ],
  'S-0103': [
    { label: '흉터 조사 (행동 주기)', act: { verb: '관찰', stage: 'S-0103', params: { 주제: '신.행동주기' } } },
  ],
  'S-0302': [
    { label: '압착 → 단열재 (정제)', act: { verb: '정제', stage: 'S-0302', params: { 산출: '단열재' } } },
  ],
};

// ── 렌더 상태 (보간용) ──
var VIEW_W = 900;            // 가로로 보이는 월드 폭 (카메라 줌)
var render = {};             // id → {x,y} 화면에 그려지는 보간 위치
var cam = { x: 700, y: 450 };
var floaters = [];          // 데미지/획득 플로터 [{x,y,text,color,life}]
var seenHits = {};          // 중복 소비 방지
var keys = {};              // WASD 눌림 상태
var lastMoveSent = 0;

async function api(path, body) {
  var res = await fetch(path, body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  return res.json();
}

function err(msg) {
  var e = $('err');
  e.textContent = msg || '';
  e.style.display = msg ? 'block' : 'none';
  if (msg) setTimeout(function () { if (e.textContent === msg) { e.textContent = ''; e.style.display = 'none'; } }, 3200);
}

async function join() {
  var r = await api('/api/play/join', { name: $('name').value || '모험가' });
  ME = r.id;
  localStorage.setItem('hktadv-player', ME);
  $('joinWrap').style.display = 'none';
  ingest(r.state);
}

async function send(path, body) {
  var r = await api(path, Object.assign({ id: ME }, body));
  if (r && r.error) err(r.error);
  if (r && r.state) ingest(r.state);
  return r;
}

// 존 명령 — 상태를 되돌려받지 않는다(폴링이 곧 따라옴), 거부는 피드백.
async function cmd(c) {
  var r = await api('/api/play/cmd', Object.assign({ id: ME }, c));
  if (r && r.ok === false && r.error) err(r.error);
  return r;
}

// ── 스냅샷 수신 — 목표 위치·플로터를 갱신, 렌더는 프레임 루프가 한다 ──
function ingest(s) {
  STATE = s;
  var z = s.zone;
  if (z && z.hits) {
    for (var i = 0; i < z.hits.length; i++) {
      var h = z.hits[i];
      var key = h.x + ':' + h.y + ':' + h.text + ':' + Math.round(h.ttl * 5);
      if (!seenHits[key]) { seenHits[key] = 1; floaters.push({ x: h.x, y: h.y, text: h.text, color: h.color, life: 1 }); }
    }
    if (Object.keys(seenHits).length > 200) seenHits = {};
  }
  paintSide(s);
}

// ── 사이드 패널(HTML) — 지도·목적·무대·소지품·피드·주기 ──
function paintSide(s) {
  $('tick').textContent = 't' + s.tick;
  $('energy').textContent = '에너지 ' + s.you.energy;
  $('regionChip').textContent = s.region.name + ' (' + s.region.id + ')';

  $('cycles').innerHTML = s.cycles.map(function (c) {
    return c.open
      ? '<span class="chip open">' + c.name + ' 열림 ·' + c.closesIn + '</span>'
      : '<span class="chip">' + c.name + ' +' + c.opensIn + '</span>';
  }).join(' ');

  drawMap(s);
  $('travel').textContent = s.you.traveling
    ? '이동 중 → ' + s.you.traveling.to + ' (남은 ' + s.you.traveling.remaining + '틱)' : '';

  var r = s.region;
  $('regionTitle').textContent = r.name + ' (' + r.id + ') — 위험도 ' + '★'.repeat(r.danger || 0);
  $('others').textContent = r.others.length ? '함께 있는 존재: ' + r.others.join(', ') : '이 지역엔 나뿐이다.';
  $('stages').innerHTML = r.stages.map(function (st) {
    var acts = (ACTIONS[st.id] || []).map(function (a, i) {
      return '<button class="' + (a.warn ? 'warn' : '') + '" ' + (s.you.traveling ? 'disabled' : '') +
        ' data-stage="' + st.id + '" data-i="' + i + '">' + a.label + '</button>';
    }).join('');
    if (!acts && st.source === '?') return '';
    return '<div class="stage"><b>' + (st.source === '?' ? st.id + ' — ?' : st.source) + '</b>' +
      (acts ? '<div style="margin-top:4px">' + acts + '</div>' : '') + '</div>';
  }).join('') || '<div class="timers">캔버스에서 몹·노드를 직접 클릭해 사냥·채집한다.</div>';

  var g = s.you.activeGoal;
  $('goalCard').innerHTML = g ? (
    '<div class="title">' + g.title + ' ' + (g.done ? '✓' : '') + '</div>' +
    '<div class="timers">' + g.desired + '</div>' +
    g.conditions.map(function (c) {
      return '<div class="cond ' + (c.met ? 'met' : 'unmet') + '">' + (c.met ? '●' : '○') + ' ' + c.text + '</div>';
    }).join('')
  ) : '활성 목적 없음';

  $('goalSel').innerHTML = s.you.goals.map(function (o) {
    return '<option value="' + o.id + '" ' + (o.id === (g && g.id) ? 'selected' : '') + '>' +
      (o.done ? '✓ ' : '') + '[' + o.state + '] ' + o.title + '</option>';
  }).join('');

  $('inv').innerHTML = s.you.inventory.map(function (m) { return '<li>' + m + '</li>'; }).join('') || '<li>비어 있음</li>';

  $('feed').innerHTML = s.feed.map(function (f) { return '<div class="f-' + f.kind + '">t' + f.t + ' · ' + f.text + '</div>'; }).join('');
  $('feed').scrollTop = $('feed').scrollHeight;

  // HUD — HP·부활
  var y = s.zone ? s.zone.you : null;
  if (y) {
    var pct = Math.max(0, Math.round((y.hp / y.maxHp) * 100));
    $('hpFill').style.width = pct + '%';
    $('hpLabel').textContent = 'HP ' + y.hp + ' / ' + y.maxHp;
    var rs = $('respawn');
    if (y.dead) { rs.style.display = 'flex'; rs.innerHTML = '쓰러졌다<br><span style="font-size:14px;color:#c9a15f">' + y.respawnIn + '초 후 깨어난다</span>'; }
    else rs.style.display = 'none';
  }
}

function drawMap(s) {
  var cv = $('map');
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#26304a';
  s.map.forEach(function (r) {
    (r.adjacent || []).forEach(function (a) {
      var p1 = POS[r.id] || [0, 0], p2 = POS[a] || [0, 0];
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    });
  });
  s.map.forEach(function (r) {
    var p = POS[r.id] || [0, 0];
    ctx.beginPath();
    ctx.fillStyle = r.here ? '#3d68b0' : '#1b2233';
    ctx.arc(p[0], p[1], 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = r.here ? '#7fb7ff' : '#33538a'; ctx.stroke();
    ctx.fillStyle = '#cfd6e4'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(r.id, p[0], p[1] + 3);
    ctx.fillStyle = '#7f9cc4'; ctx.fillText(r.name, p[0], p[1] + 25);
  });
  if (s.you.traveling) {
    var p = POS[s.you.traveling.to] || [0, 0];
    ctx.strokeStyle = '#ffd479';
    ctx.beginPath(); ctx.arc(p[0], p[1], 18, 0, Math.PI * 2); ctx.stroke();
  }
}

// ── 존 캔버스: 매 프레임 보간 렌더 + 카메라 추적 ──
function zoneCanvas() { return $('zone'); }

function sizeCanvas() {
  var cv = zoneCanvas();
  var dpr = window.devicePixelRatio || 1;
  var w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  return { w: w, h: h, dpr: dpr };
}

function scaleOf(cssW) { return cssW / VIEW_W; }

// 보간: 목표(스냅샷) 위치로 render 를 부드럽게 당긴다.
function lerpTo(id, tx, ty, k) {
  var p = render[id];
  if (!p) { render[id] = { x: tx, y: ty }; return render[id]; }
  p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
  return p;
}

var ARCH_COLOR = {
  '권속': '#c05b8c', '마수': '#d98a3a', '평원짐승': '#a9925f',
};

function drawZone() {
  var dim = sizeCanvas();
  var cv = zoneCanvas();
  var ctx = cv.getContext('2d');
  var s = STATE, z = s && s.zone;
  ctx.setTransform(dim.dpr, 0, 0, dim.dpr, 0, 0);
  ctx.clearRect(0, 0, dim.w, dim.h);
  // 바닥
  ctx.fillStyle = '#0c111c'; ctx.fillRect(0, 0, dim.w, dim.h);
  if (!z) { requestAnimationFrame(drawZone); return; }

  var scale = scaleOf(dim.w);
  var viewW = dim.w / scale, viewH = dim.h / scale;

  // 카메라: 내 보간 위치 추적, 월드 경계로 클램프
  var you = lerpTo('_you', z.you.x, z.you.y, 0.25);
  cam.x = viewW >= z.w ? z.w / 2 : Math.max(viewW / 2, Math.min(z.w - viewW / 2, you.x));
  cam.y = viewH >= z.h ? z.h / 2 : Math.max(viewH / 2, Math.min(z.h - viewH / 2, you.y));

  function sx(wx) { return (wx - cam.x) * scale + dim.w / 2; }
  function sy(wy) { return (wy - cam.y) * scale + dim.h / 2; }

  // 월드 경계·격자
  ctx.strokeStyle = '#182236';
  ctx.lineWidth = 1;
  for (var gx = 0; gx <= z.w; gx += 100) { ctx.beginPath(); ctx.moveTo(sx(gx), sy(0)); ctx.lineTo(sx(gx), sy(z.h)); ctx.stroke(); }
  for (var gy = 0; gy <= z.h; gy += 100) { ctx.beginPath(); ctx.moveTo(sx(0), sy(gy)); ctx.lineTo(sx(z.w), sy(gy)); ctx.stroke(); }
  ctx.strokeStyle = '#2a3550'; ctx.strokeRect(sx(0), sy(0), z.w * scale, z.h * scale);

  var ents = z.entities || [];

  // 노드(채집물) 먼저
  ents.forEach(function (e) {
    if (e.kind !== 'node') return;
    var p = lerpTo(e.id, e.x, e.y, 1);
    var x = sx(p.x), y = sy(p.y);
    var col = e.alive ? '#5fd0a0' : '#4a5568';
    if (e.resonate && e.alive) { ctx.save(); ctx.shadowColor = '#8fe3ae'; ctx.shadowBlur = 22; }
    ctx.fillStyle = e.alive ? '#183021' : '#161c28';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath();
    var rr = 13;
    ctx.moveTo(x, y - rr); ctx.lineTo(x + rr, y); ctx.lineTo(x, y + rr); ctx.lineTo(x - rr, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (e.resonate && e.alive) ctx.restore();
    ctx.fillStyle = e.alive ? '#bfe8d3' : '#6a7690';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText((e.label || e.archetype) + (e.alive ? '' : ' (닫힘)'), x, y + rr + 13);
  });

  // 몹
  ents.forEach(function (e) {
    if (e.kind !== 'mob') return;
    var p = lerpTo(e.id, e.x, e.y, 0.25);
    var x = sx(p.x), y = sy(p.y);
    var col = ARCH_COLOR[e.archetype] || '#b06d6d';
    if (e.resonate) { ctx.save(); ctx.shadowColor = '#8fe3ae'; ctx.shadowBlur = 18; }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
    if (e.resonate) ctx.restore();
    if (e.aggro) { ctx.strokeStyle = '#ff6a6a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke(); }
    if (STATE.zone.you.attacking === e.id) { ctx.strokeStyle = '#ffd479'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.stroke(); }
    // HP 바
    hpBar(ctx, x, y - 22, 30, e.hp, e.maxHp);
    ctx.fillStyle = '#e4c7d6'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e.archetype + (e.aggro ? ' !' : ''), x, y + 25);
  });

  // 다른 플레이어·봇
  ents.forEach(function (e) {
    if (e.kind !== 'player') return;
    var p = lerpTo(e.id, e.x, e.y, 0.25);
    var x = sx(p.x), y = sy(p.y);
    ctx.globalAlpha = e.dead ? 0.35 : 1;
    ctx.fillStyle = '#5c7fc9';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9fb8e8'; ctx.lineWidth = 2; ctx.stroke();
    hpBar(ctx, x, y - 20, 28, e.hp, e.maxHp);
    ctx.fillStyle = '#aebfdd'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e.name, x, y + 24);
    ctx.globalAlpha = 1;
  });

  // 나
  var yx = sx(you.x), yy = sy(you.y);
  ctx.globalAlpha = z.you.dead ? 0.3 : 1;
  ctx.fillStyle = '#8fe3ae';
  ctx.beginPath(); ctx.arc(yx, yy, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e8fff2'; ctx.lineWidth = 2.5; ctx.stroke();
  // 채집 채널링 진행 링
  if (z.you.gathering) {
    ctx.strokeStyle = '#ffd479'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(yx, yy, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * z.you.gathering.progress); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e8fff2'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText((STATE.you.name || '나') + ' (나)', yx, yy + 26);

  // 플로터(데미지·획득) — 떠오르며 사라진다
  for (var i = floaters.length - 1; i >= 0; i--) {
    var f = floaters[i];
    f.life -= 0.016;
    if (f.life <= 0) { floaters.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    ctx.fillStyle = f.color || '#ffd479';
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(f.text, sx(f.x), sy(f.y) - (1 - f.life) * 26);
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(drawZone);
}

function hpBar(ctx, x, top, w, hp, maxHp) {
  var frac = Math.max(0, Math.min(1, hp / maxHp));
  ctx.fillStyle = '#20141a'; ctx.fillRect(x - w / 2, top, w, 4);
  ctx.fillStyle = frac > 0.5 ? '#6fcf8f' : frac > 0.25 ? '#e0b357' : '#d24d5e';
  ctx.fillRect(x - w / 2, top, w * frac, 4);
}

// 화면 클릭 → 월드 좌표 → 타겟팅(몹=공격/노드=채집/지면=이동)
function onCanvasClick(ev) {
  if (!STATE || !STATE.zone) return;
  var cv = zoneCanvas();
  var rect = cv.getBoundingClientRect();
  var dim = { w: cv.clientWidth, h: cv.clientHeight };
  var scale = scaleOf(dim.w);
  var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
  var wx = (mx - dim.w / 2) / scale + cam.x;
  var wy = (my - dim.h / 2) / scale + cam.y;

  var ents = STATE.zone.entities || [];
  // 몹 우선 → 노드
  var pick = null, pd = 1e9;
  ents.forEach(function (e) {
    if (e.kind !== 'mob') return;
    var d = (e.x - wx) * (e.x - wx) + (e.y - wy) * (e.y - wy);
    if (d < 34 * 34 && d < pd) { pd = d; pick = e; }
  });
  if (pick) { cmd({ cmd: 'attack', target: pick.id }); return; }
  var npick = null; pd = 1e9;
  ents.forEach(function (e) {
    if (e.kind !== 'node') return;
    var d = (e.x - wx) * (e.x - wx) + (e.y - wy) * (e.y - wy);
    if (d < 34 * 34 && d < pd) { pd = d; npick = e; }
  });
  if (npick) {
    if (!npick.alive) { err(npick.hint || '지금은 채집할 수 없다'); return; }
    cmd({ cmd: 'gather', target: npick.id }); return;
  }
  cmd({ cmd: 'moveTo', x: Math.round(wx), y: Math.round(wy) });
}

// WASD — 눌린 방향으로 계속 moveTo (스로틀), 전부 떼면 정지
function pumpKeys() {
  if (ME && STATE && STATE.zone && !STATE.zone.you.dead && !STATE.you.traveling) {
    var dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    var dy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
    var now = Date.now();
    if ((dx || dy) && now - lastMoveSent > 130) {
      lastMoveSent = now;
      var len = Math.hypot(dx, dy) || 1;
      cmd({ cmd: 'moveTo', x: Math.round(STATE.zone.you.x + (dx / len) * 240), y: Math.round(STATE.zone.you.y + (dy / len) * 240) });
    }
  }
  window.setTimeout(pumpKeys, 60);
}

// ── 입력 배선 ──
$('joinBtn').onclick = join;
$('name').addEventListener('keydown', function (e) { if (e.key === 'Enter') join(); });
zoneCanvas().addEventListener('click', onCanvasClick);
$('stages').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b || b.disabled) return;
  var a = (ACTIONS[b.dataset.stage] || [])[Number(b.dataset.i)];
  if (a) send('/api/play/act', a.act);
});
$('map').addEventListener('click', function (e) {
  if (!STATE) return;
  var rect = e.target.getBoundingClientRect();
  var x = (e.clientX - rect.left) * (e.target.width / rect.width);
  var y = (e.clientY - rect.top) * (e.target.height / rect.height);
  var ids = Object.keys(POS);
  for (var i = 0; i < ids.length; i++) {
    var pp = POS[ids[i]];
    if ((x - pp[0]) * (x - pp[0]) + (y - pp[1]) * (y - pp[1]) < 16 * 16 && ids[i] !== STATE.you.region) {
      send('/api/play/move', { to: ids[i] });
      return;
    }
  }
});
$('goalSel').addEventListener('change', function (e) { send('/api/play/goal', { goal: e.target.value }); });
window.addEventListener('keydown', function (e) {
  var k = e.key.toLowerCase();
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') { keys[k] = true; if (document.activeElement !== $('name')) e.preventDefault(); }
});
window.addEventListener('keyup', function (e) {
  var k = e.key.toLowerCase();
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') { keys[k] = false; if (!keys.w && !keys.a && !keys.s && !keys.d) cmd({ cmd: 'stop' }); }
});

// ── 폴링(250ms) — 다른 플레이어·몹·주기·봇의 변화가 흘러들어온다 ──
async function poll() {
  if (ME) {
    var r = await api('/api/play/state?id=' + ME);
    if (r && r.error) { ME = null; localStorage.removeItem('hktadv-player'); $('joinWrap').style.display = 'flex'; }
    else if (r) ingest(r);
  }
  window.setTimeout(poll, 250);
}

// ?name=... 자동 입장 / ?id=... 기존 플레이어로 재접속 (데모·스크린샷 재현용)
var qs = new URLSearchParams(window.location.search);
if (qs.get('id')) { ME = qs.get('id'); localStorage.setItem('hktadv-player', ME); }
var auto = qs.get('name');
if (ME) { $('joinWrap').style.display = 'none'; }
else if (auto) { $('name').value = auto; join(); }

requestAnimationFrame(drawZone);
pumpKeys();
poll();
