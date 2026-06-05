/* HWS step-0005 헤드리스 검증
 * 사용: node verify.js <reg|conserve|det|chemotaxis|escape|flow|all> [seed]
 *  - reg        : 회귀 0 — 이동 off(move=false) step-0005 == step-0004 비트 단위 동일
 *                 (에이전트 0·구동 on/off, 그리고 에이전트 있음·번식 on·이동 off 둘 다)
 *  - conserve   : V1 보존 — 이동 on 에서도 닫힌 장부(+M+metabolized) 잔차 < 1e-6 (이동=위치 변경)
 *  - det        : V2 결정론 — 이동 on, 같은 시드 2회 실행 비트 단위 동일(E+에이전트)
 *  - chemotaxis : ① 생명이 더 높은 E 를 *따라 이동*하는가 — 고임 비탈에 놓으면 봉우리로 올라간다
 *  - escape     : ② 마른 자리를 떠나 새 고임을 *찾아 살아남는가* — source 가 옮겨가면(옛 자리 마름)
 *                 이동 on 개체군은 따라가 살아남고, 이동 off 개체군은 갇혀 붕괴한다(정지 한계 해소)
 *  - flow       : ③ 개체군이 자원 분포를 *따라 흐르는가* — source 이동 시 무게중심이 새 source 로 이동
 *  - all        : 전 모드 + 요약
 * 응집 시나리오 상수: kA=0.45, aggMc=1.1, aggW=0.7 (step-0002 그대로).
 * 생명 시나리오 상수: kL=0.05, mMaint=0.03, mDeath=0.05, mSeed=0.5, lifeR=1 (step-0003 그대로).
 * 번식 시나리오 상수: mDiv=1.2, divR=1 (step-0004 그대로).
 * 이동 시나리오 상수: moveR=1, moveThresh=0.02 (step-0005 신규).
 */
'use strict';
var core = require('./sim-core.js');
var core4 = require('../step-0004/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var TICKS = 10000;
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };    // 응집 on (step-0002 와 동일)
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };              // 번식 (step-0004)
var MOVE = { moveR: 1, moveThresh: 0.02 };        // 이동 (step-0005 신규)
var POOL = { minE: 1.5, prom: 0.3 };
var W = core.DEFAULTS.W, H = core.DEFAULTS.H, N = W * H;

function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

/* 가장 강한 고임(들)에 에이전트를 놓는다 — core 를 인자로 받아 step-0004/step-0005 양쪽에 쓴다. */
function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}

/* ── reg: 회귀 0 — 이동 off 면 step-0004 와 비트 단위 동일 ──
 * (A) 에이전트 0, 구동 on/off: E 비트 + 기본 장부 정확 일치.
 * (B) 에이전트 있음(강고임 1, 번식 on), 이동 off, +4000 tick: 전체 상태 해시(E+에이전트) 일치. */
function reg(seed) {
  var maxd = 0, ok = true;
  /* (A) 에이전트 0 */
  [true, false].forEach(function (drive) {
    var a = core4.createSim(seed, Object.assign({ drive: drive }, AGG, LIFE, REPRO)); core4.run(a, TICKS);
    var b = core.createSim(seed, Object.assign({ drive: drive, move: false }, AGG, LIFE, REPRO)); core.run(b, TICKS);
    for (var i = 0; i < a.E.length; i++) maxd = Math.max(maxd, Math.abs(a.E[i] - b.E[i]));
    if (core4.hashState(a) !== core.hashState(b)) ok = false;
    if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk) ok = false;
  });
  /* (B) 에이전트 있음, 번식 on, 이동 off */
  var a4 = core4.createSim(seed, Object.assign({}, AGG, LIFE, REPRO)); core4.run(a4, FORM);
  var b5 = core.createSim(seed, Object.assign({ move: false }, AGG, LIFE, REPRO)); core.run(b5, FORM);
  spawnStrongest(core4, a4, 1); spawnStrongest(core, b5, 1);
  core4.run(a4, 4000); core.run(b5, 4000);
  for (var j = 0; j < a4.E.length; j++) maxd = Math.max(maxd, Math.abs(a4.E[j] - b5.E[j]));
  if (core4.hashState(a4) !== core.hashState(b5)) ok = false;
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: 이동 on, 닫힌 장부(이동=위치 변경 → 장부 불변) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnStrongest(core, sim, 1);
  core.run(sim, 8000);                            // 성장→과잉→사멸→이동→정상상태 긴 구간
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass,
    pop: sim.agents.length, moves: sim.moves, births: sim.births, deaths: sim.deaths,
    metabolized: sim.metabolized, pass: led.residual < 1e-6 };
}

/* ── det: 이동 on, 결정론(비트 동일) ── */
function det(seed) {
  function build() {
    var s = core.createSim(seed, scn()); core.run(s, FORM); spawnStrongest(core, s, 1); core.run(s, 4000); return s;
  }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i]) { bit = false; break; }
  return { seed: seed, hashA: core.hashState(a), hashB: core.hashState(b),
    pass: bit && core.hashState(a) === core.hashState(b) };
}

/* ── chemotaxis: ① 생명이 더 높은 E 를 따라 이동하는가 ──
 * source 비탈(거리 10)에 단일 에이전트(번식 off)를 놓고 1500 tick.
 * 이동 on 이면 봉우리(source)로 올라가 거리가 크게 줄고 더 높은 E 에 닿는다.
 * 이동 off 면 제자리(거리 ~10)에 머문다. */
function chemotaxis(seed) {
  function trial(move) {
    var s = core.createSim(seed, scn({ repro: false, move: move })); core.run(s, FORM);
    var sx = s.p.source.x, sy = s.p.source.y;
    var a = core.spawnAgent(s, sx + 10, sy);       // 봉우리에서 거리 10 비탈
    var d0 = core.torusDist(W, H, a.x, a.y, sx, sy);
    core.run(s, 1500);
    var alive = s.agents.length > 0;
    var ax = alive ? s.agents[0].x : a.x, ay = alive ? s.agents[0].y : a.y;
    return { d0: d0, d1: core.torusDist(W, H, ax, ay, sx, sy),
      e1: alive ? s.E[s.agents[0].center] : 0, alive: alive };
  }
  var on = trial(true), off = trial(false);
  return { seed: seed, d0: on.d0, dOn: on.d1, dOff: off.d1, eOn: on.e1, eOff: off.e1,
    /* 이동 on 은 봉우리 근처(거리<3)로 올라가고, 정지보다 가깝고 더 높은 E 에 닿는다 */
    pass: on.alive && on.d1 < 3 && on.d1 < off.d1 - 3 && on.e1 > off.e1 };
}

/* 자원 이동 시나리오 — 개체군을 옛 source 영역에 정착시킨 뒤 source 를 dist 만큼 옮긴다.
 * 옛 자리는 자원이 말라가고(주입 끊김), 새 자리에 자원이 차오른다. ②③ 공용. */
function shiftRun(seed, move) {
  var s = core.createSim(seed, scn({ move: move })); core.run(s, FORM);
  if (!spawnStrongest(core, s, 1)) return null;
  core.run(s, 3000);                               // 옛 source 영역에 개체군 정착(carrying capacity)
  var pop0 = s.agents.length;
  var nx = s.p.source.x + 16, ny = s.p.source.y;   // source 를 16칸 옆으로 이동(옛 자리 마름)
  core.setSource(s, { x: nx, y: ny });
  core.run(s, 6000);                               // 따라가거나(이동 on) 갇혀 붕괴(이동 off)
  var ct = core.centroid(s);
  return { pop0: pop0, pop1: s.agents.length, nx: nx, ny: ny,
    dCent: ct ? core.torusDist(W, H, ct.x, ct.y, nx, ny) : 999 };
}

/* ── escape: ② 마른 자리를 떠나 새 고임을 찾아 살아남는가 ──
 * source 가 옮겨가면 이동 on 개체군은 따라가 살아남고(pop 유지), 이동 off 는 갇혀 붕괴한다. */
function escape(seed) {
  var on = shiftRun(seed, true), off = shiftRun(seed, false);
  if (!on || !off) return { seed: seed, pass: false };
  return { seed: seed, pop0: on.pop0, popOn: on.pop1, popOff: off.pop1,
    /* 이동 on 은 개체군을 유지(≥30)하고, 정지보다 두 배 이상 산다(정지 한계 해소) */
    pass: on.pop1 >= 30 && on.pop1 >= 2 * off.pop1 };
}

/* ── flow: ③ 개체군이 자원 분포를 따라 흐르는가 ──
 * source 이동 시 이동 on 무게중심은 새 source 로 이동(dCent 작음), 이동 off 는 옛 자리에 갇힘(dCent 큼). */
function flow(seed) {
  var on = shiftRun(seed, true), off = shiftRun(seed, false);
  if (!on || !off) return { seed: seed, pass: false };
  return { seed: seed, dCentOn: on.dCent, dCentOff: off.dCent,
    /* 이동 on 무게중심이 새 source 근처(<4)이고, 정지보다 확연히(>5) 가깝다 */
    pass: on.dCent < 4 && on.dCent < off.dCent - 5 };
}

function fmt(x) {
  if (typeof x !== 'number') return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3);
  return x.toFixed(4);
}
function table(rows, cols) {
  console.log(cols.join('\t'));
  rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); });
}

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'maxDiff', 'pass']);
    console.log('회귀 0: 이동 off step-0005 == step-0004 (에이전트 0 구동 on/off + 에이전트 있음 번식 on 이동 off)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'pop', 'moves', 'births', 'deaths', 'metabolized', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (이동은 위치 변경 → 장부 불변; sumE+M+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'chemotaxis') {
    var rg = seeds.map(chemotaxis); table(rg, ['seed', 'd0', 'dOn', 'dOff', 'eOn', 'eOff', 'pass']);
    console.log('avg dOn=' + avg(rg, 'dOn').toFixed(1) + ' vs dOff=' + avg(rg, 'dOff').toFixed(1) + ' (이동 on 은 봉우리로 올라간다 — 주화성)');
    return rg.every(function (r) { return r.pass; });
  } else if (mode === 'escape') {
    var re = seeds.map(escape); table(re, ['seed', 'pop0', 'popOn', 'popOff', 'pass']);
    console.log('avg popOn=' + avg(re, 'popOn').toFixed(0) + ' vs popOff=' + avg(re, 'popOff').toFixed(0) + ' (source 이동 → 이동 on 따라가 생존, 정지 붕괴)');
    return re.every(function (r) { return r.pass; });
  } else if (mode === 'flow') {
    var rf = seeds.map(flow); table(rf, ['seed', 'dCentOn', 'dCentOff', 'pass']);
    console.log('avg dCentOn=' + avg(rf, 'dCentOn').toFixed(1) + ' vs dCentOff=' + avg(rf, 'dCentOff').toFixed(1) + ' (무게중심이 새 source 로 흐른다)');
    return rf.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'chemotaxis', 'escape', 'flow'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
