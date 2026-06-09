#!/usr/bin/env node
'use strict';
// ════════════════════════════════════════════════════════════════════════
//  HktInfra/run.js — 단일 진입점 (TESTBED.md §4)
//   흩어진 step-NNNN/verify.js 앞에 서는 얇은 오케스트레이터.
//   "살아있다 = 손수정 없이 step 마다 자동으로 최신을 가리킨다" — 현재 step 은 파일시스템에서
//   최대 번호 step-NNNN 디렉토리를 읽어 결정적으로 탐지한다(권위는 STATE.md, 어긋나면 경고).
//
//   모드 (TESTBED §4):
//     node run.js                  → 현재 step `verify.js all` 실행·exit code 전파  (에이전트: 검증 권위)
//     node run.js spine            → step-0001..NNNN 회귀 사슬(각자 reg/det/repro 자동) 한 줄 요약 (에이전트: 회귀)
//     node run.js <NNNN> [mode]    → 특정 step·모드 지정 실행(디버깅)                 (에이전트)
//     node run.js report [scen]    → 현재 step 을 headless 녹화 → 자기완결 report.html (사람: 시각화, §5)
//
//   report 외 모드는 stdout 텍스트 + exit code(에이전트가 읽고 판정). report 만 html 산출물을 만든다.
//   이 파일은 step 디렉토리를 *읽기/실행만* 한다 — 동결 단위(frozen step) 무수정(회귀 0 보존).
// ════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;

// ── 현재 step 자동 탐지 (파일시스템 사실 — 결정적) ─────────────────────────
function listSteps() {
  return fs.readdirSync(ROOT)
    .map(n => /^step-(\d{4})$/.exec(n))
    .filter(Boolean)
    .map(m => ({ num: parseInt(m[1], 10), name: m[0], dir: path.join(ROOT, m[0]) }))
    .filter(s => fs.existsSync(path.join(s.dir, 'verify.js')))
    .sort((a, b) => a.num - b.num);
}
function stepDir(num) { return path.join(ROOT, 'step-' + String(num).padStart(4, '0')); }

// STATE.md §1 NOW 와 정합 확인(권위는 STATE — 어긋나면 경고만, 막지 않음)
function stateNow() {
  try {
    const t = fs.readFileSync(path.join(ROOT, 'STATE.md'), 'utf8');
    const m = /닫힌 step\*\*:\s*\[step-(\d{4})\]/.exec(t);
    return m ? parseInt(m[1], 10) : null;
  } catch { return null; }
}

// verify.js 가 *지원하는 모드 토큰*을 정적 스캔으로 추출 ("살아있다" — 하드코딩 맵 없음).
//   `mode === 'x'` 분기 + `const MODES = { x, y }` 객체 키 둘 다 모은다.
function modesOf(dir) {
  let src = '';
  try { src = fs.readFileSync(path.join(dir, 'verify.js'), 'utf8'); } catch { return []; }
  const set = new Set();
  for (const m of src.matchAll(/mode\s*===\s*['"]([a-z0-9]+)['"]/g)) set.add(m[1]);
  const mo = /const\s+MODES\s*=\s*\{([^}]*)\}/.exec(src);
  if (mo) for (const k of mo[1].split(',')) {
    const kk = k.trim().split(':')[0].trim();
    if (/^[a-z0-9]+$/.test(kk)) set.add(kk);
  }
  return [...set];
}
// 회귀 사슬용 모드 선택: reg > det > repro > all (있는 것 중 첫째).
//   0002+ 는 reg, 0001 은 det, 0005(경량 라우터·비트결정론 미사용)는 repro 로 자동 낙착.
function spineMode(dir) {
  const avail = modesOf(dir);
  for (const m of ['reg', 'det', 'repro', 'all']) if (avail.includes(m)) return m;
  return 'all';
}

function verifyArgs(dir, mode, seed) {
  const a = [path.join(dir, 'verify.js')];
  if (mode) a.push(mode);
  if (seed != null) a.push(String(seed));
  return a;
}
// inherit: 자식 stdout 을 그대로 흘림(에이전트가 전문을 읽음). capture: 요약 추출용.
function runVerify(dir, mode, { seed = null, capture = false } = {}) {
  return spawnSync(process.execPath, verifyArgs(dir, mode, seed),
    { cwd: ROOT, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', maxBuffer: 64 * 1024 * 1024 });
}

// ════════════════════════════════════════════════════════════════════════
//  명령 디스패치
// ════════════════════════════════════════════════════════════════════════
function warnStateDrift(curNum) {
  const sn = stateNow();
  if (sn != null && sn !== curNum)
    console.error(`⚠ STATE.md NOW(step-${String(sn).padStart(4, '0')}) ≠ 파일시스템 최신(step-${String(curNum).padStart(4, '0')}) — 권위는 STATE.md`);
}

// 기본: 현재 step verify all → exit 전파
function cmdDefault() {
  const steps = listSteps();
  if (!steps.length) { console.error('step-NNNN 디렉토리를 찾지 못했습니다.'); return 2; }
  const cur = steps[steps.length - 1];
  warnStateDrift(cur.num);
  console.log(`▶ 현재 step = ${cur.name} · verify all (검증 권위)\n`);
  const r = runVerify(cur.dir, 'all');
  return r.status == null ? 1 : r.status;
}

// 특정 step·모드
function cmdStep(num, mode) {
  const dir = stepDir(num);
  if (!fs.existsSync(path.join(dir, 'verify.js'))) { console.error(`step-${num} verify.js 없음`); return 2; }
  const m = mode || 'all';
  console.log(`▶ step-${String(num).padStart(4, '0')} · verify ${m}\n`);
  const r = runVerify(dir, m);
  return r.status == null ? 1 : r.status;
}

// spine: 전 사슬 회귀 한 줄 요약 (각 step reg/det/repro 자동)
function cmdSpine() {
  const steps = listSteps();
  if (!steps.length) { console.error('step 없음'); return 2; }
  warnStateDrift(steps[steps.length - 1].num);
  console.log('▶ spine — 전 시리즈 회귀 사슬 (각 step 회귀 모드 자동 선택)\n');
  console.log('  step       | mode   | 결과');
  console.log('  -----------+--------+------');
  let failed = 0;
  for (const s of steps) {
    const mode = spineMode(s.dir);
    const r = runVerify(s.dir, mode, { capture: true });
    const ok = r.status === 0;
    if (!ok) failed++;
    const tail = (r.stdout || '').trim().split('\n').filter(l => /결과:/.test(l)).pop() || '';
    console.log(`  ${s.name} | ${mode.padEnd(6)} | ${ok ? 'OK  ' : 'FAIL'}  ${ok ? '' : tail}`);
  }
  console.log('\n' + (failed ? `결과: FAIL (${failed} step 회귀 깨짐)` : `결과: ALL OK (${steps.length} step 비트 사슬 통과)`));
  return failed ? 1 : 0;
}

// ════════════════════════════════════════════════════════════════════════
//  report — 플라이트 레코더 (TESTBED §5). 현재 step net-core 를 headless 녹화 → report.html
// ════════════════════════════════════════════════════════════════════════
// addr/kind → 6계층 (TESTBED §10-5: login/gateway→엣지, registry/orch→코디, zone*→월드, client→클라)
function layerOf(spec) {
  switch (spec.kind) {
    case 'login': case 'gateway': return 'edge';
    case 'registry': case 'orch': return 'coord';
    case 'zone': return 'world';
    case 'client': return 'client';
    default: return 'other';
  }
}
const LAYER_LABEL = { edge: '엣지', world: '월드', service: '서비스', bus: '버스', coord: '코디네이션', data: '데이터', client: '클라이언트', other: '기타' };

// 기본 시나리오 — 사망+승격이 들어간 대표 failover 런(타임라인에 이벤트가 보이도록).
function defaultScenario() {
  return {
    name: 'default-failover', seed: 42, ticks: 48,
    transport: null,
    opts: { clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: 40, leaseTimeout: 4, killZone: 'zone1' },
  };
}
// 시나리오 파일(§5-3) → run()/runMulti() opts 로 번역.
//   cmds 의 kill@t → deathTick/killZone 매핑(failover 머신 켬). inject 는 후속(경고).
function loadScenario(file) {
  const sc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const base = defaultScenario();
  const opts = Object.assign({}, base.opts, sc.opts || {});
  if (sc.clients != null) opts.clients = sc.clients;
  if (sc.transport !== undefined) base.transport = sc.transport;
  for (const c of (sc.cmds || [])) {
    if (c.kill != null) { opts.deathTick = c.tick; opts.killZone = c.kill; opts.failover = true; }
    if (c.inject != null) console.error('⚠ scenario inject 는 아직 미지원(후속, §5-3) — 무시함');
  }
  return { name: sc.name || path.basename(file), seed: sc.seed != null ? sc.seed : base.seed, ticks: sc.ticks != null ? sc.ticks : base.ticks, transport: base.transport, opts };
}

function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return h >>> 0; }
function logDigest(log) { return fnv1a(log.map(m => `${m.from}>${m.to}:${JSON.stringify(m.payload)}`).join('|')); }

const EVENT_KINDS = new Set(['handoff', 'handoff_ack', 'lease', 'promote', 'relink', 'reroute', 'retire', 'leave']);

// run() 반환에서 per-tick trace 추출(프레임 단위). net.log(tick 도장) + r.trace(권위 소유자/inflight).
function buildTrace(NET, scenario) {
  const runOpts = Object.assign({ seed: scenario.seed, ticks: scenario.ticks, transport: scenario.transport }, scenario.opts);
  const r = NET.run(runOpts);
  const topo = NET.buildTopology(runOpts);
  const boxes = topo.specs.map(s => ({ addr: s.addr, kind: s.kind, layer: layerOf(s) }));
  const addrSet = new Set(boxes.map(b => b.addr));

  // net.log 를 tick 별 메시지로 묶기
  const byTick = new Map();
  for (const m of r.net.log) {
    if (!byTick.has(m.tick)) byTick.set(m.tick, []);
    byTick.get(m.tick).push(m);
  }

  const ticks = [];
  for (let i = 0; i < r.trace.length; i++) {
    const t = r.trace[i].tick;
    const committed = r.trace[i].committed;   // Map avatar->count
    const inflight = r.trace[i].inflight;     // Set avatar
    // 권위 소유자 패널: 매 엔티티 유효 소유자 수(=1 이어야 함). 공백(0)/중복(>1) 경보.
    const owners = [];
    let violations = 0;
    const avatars = new Set([...committed.keys(), ...inflight]);
    for (const av of [...avatars].sort()) {
      const cnt = committed.get(av) || 0;
      const eff = cnt > 0 ? cnt : (inflight.has(av) ? 1 : 0);
      const ok = eff === 1;
      if (!ok) violations++;
      owners.push({ id: av, count: eff, inflight: inflight.has(av) && cnt === 0, ok });
    }
    // 메시지 흐름 (집계: from>to>kind → 건수). 클라↔게이트웨이/존간/제어평면 전부.
    const edgeMap = new Map();
    const events = [];
    for (const m of (byTick.get(t) || [])) {
      if (!addrSet.has(m.from) || !addrSet.has(m.to)) continue; // 박스 사이 흐름만 그림
      const kind = (m.payload && m.payload.type) || '?';
      const key = m.from + '' + m.to + '' + kind;
      edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      if (EVENT_KINDS.has(kind)) events.push({ kind, from: m.from, to: m.to });
    }
    if (scenario.opts.deathTick === t) events.unshift({ kind: 'death', from: scenario.opts.killZone, to: scenario.opts.killZone });
    const msgs = [...edgeMap.entries()].map(([k, n]) => { const [from, to, kind] = k.split(''); return { from, to, kind, n }; });
    ticks.push({ t, owners, violations, liveN: r.trace[i].liveN, msgs, events });
  }

  const meta = {
    step: scenario.step, scenario: scenario.name, seed: scenario.seed, ticks: scenario.ticks,
    totalViolations: ticks.reduce((a, x) => a + x.violations, 0),
    promotions: r.totals ? r.totals.promotions : 0,
    handoffs: r.totals ? r.totals.handoffs : 0,
    inprocDigest: logDigest(r.net.log),
  };
  return { meta, boxes, layers: boxes.reduce((m, b) => (m[b.addr] = b.layer, m), {}), ticks };
}

// runMulti 멀티프로세스 증명(§10-1) — pids·IPC 건수·logDigest 일치. 없으면 inproc-only 폴백.
async function multiProof(NET, scenario) {
  if (typeof NET.runMulti !== 'function') return null;
  try {
    const runOpts = Object.assign({ seed: scenario.seed, ticks: scenario.ticks, transport: scenario.transport }, scenario.opts);
    const b = await NET.runMulti(runOpts);
    return {
      pids: b.cluster.pids, parentPid: b.cluster.parentPid,
      ipcMsgs: b.cluster.ipcMsgs, ipcBytes: b.cluster.ipcBytes,
      multiDigest: logDigest(b.net.log),
    };
  } catch (e) {
    console.error('⚠ runMulti 멀티프로세스 증명 실패(폴백: inproc only): ' + e.message);
    return null;
  }
}

async function cmdReport(scenarioFile) {
  const steps = listSteps();
  if (!steps.length) { console.error('step 없음'); return 2; }
  const cur = steps[steps.length - 1];
  warnStateDrift(cur.num);
  const NET = require(path.join(cur.dir, 'net-core.js'));
  if (typeof NET.run !== 'function' || typeof NET.buildTopology !== 'function') {
    console.error(`${cur.name}/net-core.js 가 run/buildTopology 를 노출하지 않습니다(레코더 비대상).`); return 2;
  }
  const scenario = scenarioFile ? loadScenario(scenarioFile) : defaultScenario();
  scenario.step = cur.name;
  console.log(`▶ report — ${cur.name} 녹화 (시나리오: ${scenario.name}, seed ${scenario.seed}, ${scenario.ticks} tick)`);

  const trace = buildTrace(NET, scenario);
  const proof = await multiProof(NET, scenario);
  if (proof) {
    trace.meta.pids = proof.pids;
    trace.meta.ipcMsgs = proof.ipcMsgs;
    trace.meta.ipcBytes = proof.ipcBytes;
    trace.meta.multiproc = (proof.multiDigest === trace.meta.inprocDigest);
    console.log(`  멀티프로세스 증명: ${proof.pids.length} pid · IPC ${proof.ipcMsgs}건 · log동일 ${trace.meta.multiproc}`);
  } else {
    trace.meta.multiproc = null;
    console.log('  멀티프로세스 증명: (없음 — inproc only)');
  }

  const out = path.join(ROOT, 'report.html');
  fs.writeFileSync(out, renderHtml(trace));
  console.log(`\n결과: report.html 생성 — ${out}`);
  console.log(`  권위 위반(전 tick 합) = ${trace.meta.totalViolations} · 승격 ${trace.meta.promotions} · 핸드오프 ${trace.meta.handoffs}`);
  return 0;
}

// ── 자기완결 html (외부 의존·fetch 0 — 그냥 열기). 데이터 인라인 임베드. ──
function renderHtml(trace) {
  const json = JSON.stringify(trace).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>HktInfra 플라이트 레코더 — ${trace.meta.step}</title>
<style>
  :root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--fg:#c9d1d9;--dim:#8b949e;--ok:#3fb950;--warn:#d29922;--bad:#f85149;--acc:#58a6ff;}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  header{padding:10px 16px;border-bottom:1px solid var(--line);display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}
  header h1{font-size:15px;margin:0;color:var(--acc)}header .m{color:var(--dim)}header .m b{color:var(--fg)}
  .bad{color:var(--bad)}.ok{color:var(--ok)}.warn{color:var(--warn)}
  main{display:grid;grid-template-columns:1fr 320px;gap:0;height:calc(100vh - 52px)}
  #stage{position:relative;overflow:hidden}svg{width:100%;height:100%}
  aside{border-left:1px solid var(--line);overflow:auto;padding:12px}
  aside h2{font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px;border-bottom:1px solid var(--line);padding-bottom:4px}
  aside h2:first-child{margin-top:0}
  .controls{position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:rgba(13,17,23,.92);border-top:1px solid var(--line);display:flex;gap:10px;align-items:center}
  .controls button{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  .controls button:hover{border-color:var(--acc)}
  .controls input[type=range]{flex:1}
  .owner{display:flex;justify-content:space-between;padding:1px 0}
  .ev{padding:2px 0;border-bottom:1px solid #21262d}
  .legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--dim);font-size:11px;padding:6px 16px;border-bottom:1px solid var(--line)}
  .legend span{display:inline-flex;gap:4px;align-items:center}
  .dot{width:9px;height:9px;border-radius:50%;display:inline-block}
  .kv{display:flex;justify-content:space-between;color:var(--dim)}.kv b{color:var(--fg)}
  .tk{color:var(--acc);font-weight:bold}
</style></head><body>
<header>
  <h1>플라이트 레코더 — <span id="hstep"></span></h1>
  <span class="m">시나리오 <b id="hscen"></b></span>
  <span class="m">seed <b id="hseed"></b></span>
  <span class="m">tick <b><span class="tk" id="htick"></span>/<span id="hticks"></span></b></span>
  <span class="m">멀티프로세스 <b id="hmp"></b></span>
  <span class="m">권위위반(합) <b id="hviol"></b></span>
</header>
<div class="legend" id="legend"></div>
<main>
  <div id="stage">
    <svg id="svg" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid meet"></svg>
    <div class="controls">
      <button id="play">▶ play</button>
      <button id="prev">◀ step</button>
      <button id="next">step ▶</button>
      <input type="range" id="scrub" min="0" value="0">
      <span id="tlabel" class="tk"></span>
    </div>
  </div>
  <aside>
    <h2>요약</h2>
    <div class="kv"><span>총 tick</span><b id="sTicks"></b></div>
    <div class="kv"><span>멀티프로세스</span><b id="sMp"></b></div>
    <div class="kv"><span>pid 수</span><b id="sPids"></b></div>
    <div class="kv"><span>IPC 건수</span><b id="sIpc"></b></div>
    <div class="kv"><span>승격</span><b id="sProm"></b></div>
    <div class="kv"><span>핸드오프</span><b id="sHand"></b></div>
    <h2>이 tick — 활동</h2>
    <div class="kv"><span>live 엔티티</span><b id="sLive"></b></div>
    <div class="kv"><span>권위 위반</span><b id="sViol"></b></div>
    <div class="kv"><span>메시지 흐름</span><b id="sMsgs"></b></div>
    <h2>권위 소유자 (=1 이어야 함)</h2>
    <div id="owners"></div>
    <h2>이벤트</h2>
    <div id="events"></div>
  </aside>
</main>
<script>
const TRACE = ${json};
const M = TRACE.meta, BOXES = TRACE.boxes, TICKS = TRACE.ticks;
const LAYER_ORDER = ['client','edge','coord','world','service','bus','data'];
const LAYER_LABEL = ${JSON.stringify(LAYER_LABEL)};
const LAYER_COLOR = {client:'#8b949e',edge:'#58a6ff',coord:'#bc8cff',world:'#3fb950',service:'#d29922',bus:'#f0883e',data:'#39c5cf',other:'#6e7681'};

// 헤더·요약
document.getElementById('hstep').textContent = M.step;
document.getElementById('hscen').textContent = M.scenario;
document.getElementById('hseed').textContent = M.seed;
document.getElementById('hticks').textContent = TICKS.length;
document.getElementById('hmp').innerHTML = M.multiproc==null?'(없음)':(M.multiproc?'<span class=ok>비트동일</span>':'<span class=bad>불일치</span>');
document.getElementById('hviol').innerHTML = M.totalViolations?('<span class=bad>'+M.totalViolations+'</span>'):'<span class=ok>0</span>';
document.getElementById('sTicks').textContent = TICKS.length;
document.getElementById('sMp').innerHTML = M.multiproc==null?'(없음)':(M.multiproc?'<span class=ok>true</span>':'<span class=bad>false</span>');
document.getElementById('sPids').textContent = M.pids?M.pids.length:'—';
document.getElementById('sIpc').textContent = M.ipcMsgs!=null?M.ipcMsgs:'—';
document.getElementById('sProm').textContent = M.promotions;
document.getElementById('sHand').textContent = M.handoffs;

// 박스 좌표 — 계층별 행(row), 같은 계층은 가로로 분산
const W=1000,H=640,PADX=70,PADY=46,BW=120,BH=40;
const usedLayers = LAYER_ORDER.filter(L=>BOXES.some(b=>b.layer===L));
const rowH=(H-PADY*2)/usedLayers.length;
const pos={};
usedLayers.forEach((L,li)=>{
  const bs=BOXES.filter(b=>b.layer===L);
  const cw=(W-PADX*2)/bs.length;
  bs.forEach((b,bi)=>{ pos[b.addr]={x:PADX+cw*bi+cw/2,y:PADY+rowH*li+rowH/2,layer:L}; });
});

// 범례
const legend=document.getElementById('legend');
usedLayers.forEach(L=>{const s=document.createElement('span');s.innerHTML='<span class=dot style="background:'+LAYER_COLOR[L]+'"></span>'+LAYER_LABEL[L];legend.appendChild(s);});
legend.insertAdjacentHTML('beforeend','<span><span class=dot style="background:var(--bad)"></span>권위위반</span><span>선 굵기=메시지 양</span>');

const svg=document.getElementById('svg');
const NS='http://www.w3.org/2000/svg';
function el(n,a){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e;}

// 계층 행 라벨(정적)
const gStatic=el('g',{});
usedLayers.forEach((L,li)=>{
  gStatic.appendChild(el('line',{x1:8,y1:PADY+rowH*li,x2:W-8,y2:PADY+rowH*li,stroke:'#21262d','stroke-width':1}));
  const t=el('text',{x:12,y:PADY+rowH*li+13,fill:'#6e7681','font-size':11});t.textContent=LAYER_LABEL[L];gStatic.appendChild(t);
});
svg.appendChild(gStatic);
const gEdges=el('g',{});svg.appendChild(gEdges);
const gBoxes=el('g',{});svg.appendChild(gBoxes);

// 박스(정적, 상태만 갱신)
const boxEls={};
BOXES.forEach(b=>{
  const p=pos[b.addr];const g=el('g',{});
  const rect=el('rect',{x:p.x-BW/2,y:p.y-BH/2,width:BW,height:BH,rx:6,fill:'#161b22',stroke:LAYER_COLOR[b.layer],'stroke-width':1.5});
  const t1=el('text',{x:p.x,y:p.y-1,fill:'#c9d1d9','font-size':12,'text-anchor':'middle'});t1.textContent=b.addr;
  const t2=el('text',{x:p.x,y:p.y+13,fill:'#6e7681','font-size':9,'text-anchor':'middle'});t2.textContent=b.kind;
  g.appendChild(rect);g.appendChild(t1);g.appendChild(t2);gBoxes.appendChild(g);
  boxEls[b.addr]={rect};
});

let cur=0,playing=false,timer=null;
const scrub=document.getElementById('scrub');scrub.max=TICKS.length-1;

function draw(i){
  const fr=TICKS[i];
  document.getElementById('htick').textContent=fr.t;
  document.getElementById('tlabel').textContent='tick '+fr.t;
  document.getElementById('sLive').textContent=fr.liveN;
  document.getElementById('sViol').innerHTML=fr.violations?('<span class=bad>'+fr.violations+'</span>'):'<span class=ok>0</span>';
  document.getElementById('sMsgs').textContent=fr.msgs.reduce((a,m)=>a+m.n,0);
  // 박스 사망/위반 상태
  const deadNow=new Set();
  TICKS.slice(0,i+1).forEach(f=>f.events.forEach(e=>{if(e.kind==='death')deadNow.add(e.from);if(e.kind==='promote')deadNow.delete(e.to);}));
  BOXES.forEach(b=>{const r=boxEls[b.addr].rect;
    if(deadNow.has(b.addr)){r.setAttribute('stroke','var(--bad)');r.setAttribute('stroke-dasharray','4 3');r.setAttribute('opacity','.45');}
    else{r.setAttribute('stroke',LAYER_COLOR[b.layer]);r.removeAttribute('stroke-dasharray');r.setAttribute('opacity','1');}
  });
  // 엣지(이 tick 메시지)
  gEdges.innerHTML='';
  fr.msgs.forEach(m=>{
    const a=pos[m.from],b=pos[m.to];if(!a||!b)return;
    const w=Math.min(1+m.n*0.8,6);
    const ctrl=' Q '+((a.x+b.x)/2+(b.y-a.y)*0.06)+' '+((a.y+b.y)/2-(b.x-a.x)*0.06)+' ';
    const isEv=['handoff','promote','lease','relink','reroute','retire'].includes(m.kind);
    gEdges.appendChild(el('path',{d:'M '+a.x+' '+a.y+ctrl+b.x+' '+b.y,fill:'none',stroke:isEv?'#d29922':'#3a4250','stroke-width':w,opacity:isEv?0.95:0.6,'marker-end':'url(#arr)'}));
  });
  // 권위 패널
  const ow=document.getElementById('owners');
  ow.innerHTML=fr.owners.length?'':'<span style="color:#6e7681">— (권위 엔티티 없음)</span>';
  fr.owners.forEach(o=>{const d=document.createElement('div');d.className='owner';
    d.innerHTML='<span>'+o.id+(o.inflight?' <span class=warn>(in-flight)</span>':'')+'</span><b class="'+(o.ok?'ok':'bad')+'">'+o.count+'</b>';ow.appendChild(d);});
  // 이벤트(누적, 최근 우선)
  const ev=document.getElementById('events');ev.innerHTML='';
  const acc=[];TICKS.slice(0,i+1).forEach(f=>f.events.forEach(e=>acc.push({t:f.t,e})));
  acc.slice(-30).reverse().forEach(({t,e})=>{const d=document.createElement('div');d.className='ev';
    const c=e.kind==='death'?'bad':(e.kind==='promote'?'ok':'warn');
    d.innerHTML='<span class=tk>t'+t+'</span> <span class='+c+'>'+e.kind+'</span> '+(e.from!==e.to?(e.from+'→'+e.to):e.from);ev.appendChild(d);});
  scrub.value=i;cur=i;
}
// 화살표 마커
const defs=el('defs',{});defs.innerHTML='<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3a4250"/></marker>';svg.insertBefore(defs,svg.firstChild);

document.getElementById('prev').onclick=()=>{stop();draw(Math.max(0,cur-1));};
document.getElementById('next').onclick=()=>{stop();draw(Math.min(TICKS.length-1,cur+1));};
scrub.oninput=()=>{stop();draw(+scrub.value);};
function stop(){playing=false;clearInterval(timer);document.getElementById('play').textContent='▶ play';}
document.getElementById('play').onclick=()=>{
  if(playing){stop();return;}
  playing=true;document.getElementById('play').textContent='⏸ pause';
  timer=setInterval(()=>{if(cur>=TICKS.length-1){stop();return;}draw(cur+1);},220);
};
draw(0);
</script></body></html>`;
}

// ════════════════════════════════════════════════════════════════════════
//  live — 진짜 라이브 모니터링 서버 (live.js 에 위임). report=녹화 재생, live=실시간.
// ════════════════════════════════════════════════════════════════════════
function cmdLive(portArg) {
  const steps = listSteps();
  if (!steps.length) { console.error('step 없음'); return 2; }
  const cur = steps[steps.length - 1];
  warnStateDrift(cur.num);
  const NET = require(path.join(cur.dir, 'net-core.js'));
  if (typeof NET.buildTopology !== 'function' || typeof NET.makeActor !== 'function' || typeof NET.Net !== 'function') {
    console.error(`${cur.name}/net-core.js 가 buildTopology/makeActor/Net 를 노출하지 않습니다(라이브 비대상).`); return 2;
  }
  const port = portArg ? parseInt(portArg, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080);
  require('./live.js').serve(NET, { port, step: cur.name });
  return null; // 서버는 계속 떠 있음 — process.exit 하지 않음
}

// ════════════════════════════════════════════════════════════════════════
//  main
// ════════════════════════════════════════════════════════════════════════
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  let code;
  if (!cmd) code = cmdDefault();
  else if (cmd === 'spine') code = cmdSpine();
  else if (cmd === 'report') code = await cmdReport(argv[1]);
  else if (cmd === 'live') code = cmdLive(argv[1]);
  else if (/^\d+$/.test(cmd)) code = cmdStep(parseInt(cmd, 10), argv[1]);
  else { console.error(`사용: node run.js [spine | report [scenario.json] | live [port] | <NNNN> [mode]]`); code = 2; }
  if (code === null) return; // live: 서버 상주
  process.exit(code);
}
main();
