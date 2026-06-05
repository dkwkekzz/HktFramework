/* HWS step-0006 헤드리스 검증
 * 사용: node verify.js <reg|conserve|det|starve|seek|confine|all> [seed]
 *  - reg      : 회귀 0 — baseCost=0 step-0006 == step-0005 비트 단위 동일
 *               (에이전트 0·구동 on/off, 그리고 에이전트 있음·번식 on·이동 on·baseCost=0 둘 다)
 *  - conserve : V1 보존 — baseCost on 에서도 닫힌 장부(기초대사도 metabolized 에 기록) 잔차 < 1e-6
 *  - det      : V2 결정론 — baseCost on, 같은 시드 2회 실행 비트 단위 동일(E+에이전트)
 *  - starve   : ① 절대 문턱 — 옅은 곳의 정지 생명이 *굶어 죽는가*. baseCost on 이면 마른 곳 정지 생명은
 *               죽고(고임 위는 산다), baseCost=0 이면 같은 마른 곳에서도 산다(문턱 없음). 자원이 생사를 공간적으로 가른다.
 *  - seek     : ② 떠나야 산다(정적 세계) — 비탈에 놓인 생명이 이동 on 이면 봉우리로 올라가 *살고*,
 *               이동 off 면 그 자리에서 *굶어 죽는다*. source 를 옮기지 않아도(정적) 압력이 생긴다(이동+문턱 결합).
 *  - confine  : ③ 공간 국한 — baseCost on 개체군은 자원 두꺼운 곳에만 산다(생존자 평균 흡수 >= baseCost),
 *               개체수가 줄고(잉여 아사) 세계가 덜 strip 된다(sumE ↑ vs baseCost=0). 단 *얼어붙음*은 미해소(§ 한계).
 *  - all      : 전 모드 + 요약
 * 응집 시나리오 상수: kA=0.45, aggMc=1.1, aggW=0.7 (step-0002 그대로).
 * 생명 시나리오 상수: kL=0.05, mMaint=0.03, mDeath=0.05, mSeed=0.5, lifeR=1 (step-0003 그대로).
 * 번식 시나리오 상수: mDiv=1.2, divR=1 (step-0004 그대로). 이동: moveR=1, moveThresh=0.02 (step-0005 그대로).
 * 기초대사비 시나리오 상수: baseCost=0.08 (step-0006 신규).
 */
'use strict';
var core = require('./sim-core.js');
var core5 = require('../step-0005/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };    // 응집 on (step-0002 와 동일)
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };              // 번식 (step-0004)
var MOVE = { moveR: 1, moveThresh: 0.02 };        // 이동 (step-0005)
var BASE = 0.08;                                  // 기초대사비 (step-0006 신규)
var POOL = { minE: 1.5, prom: 0.3 };
var W = core.DEFAULTS.W, H = core.DEFAULTS.H, N = W * H;

/* baseCost 까지 켠 표준 시나리오. 회귀(reg)는 baseCost=0 으로 따로 만든다. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

/* 가장 강한 고임(들)에 에이전트를 놓는다 — core 를 인자로 받아 step-0005/step-0006 양쪽에 쓴다. */
function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}

/* 에이전트별 흡수량(got) = 입 disc 의 E 합 × kL. 공간 국한 측정용(생존자는 got >= baseCost). */
function meanGot(C, sim) {
  var ag = sim.agents, kL = sim.p.kL, E = sim.E;
  if (!ag.length) return 0;
  var s = 0;
  for (var k = 0; k < ag.length; k++) {
    var cells = ag[k].cells, g = 0;
    for (var c = 0; c < cells.length; c++) g += E[cells[c]] * kL;
    s += g;
  }
  return s / ag.length;
}

/* ── reg: 회귀 0 — baseCost=0 면 step-0005 와 비트 단위 동일 ──
 * (A) 에이전트 0, 구동 on/off: E 비트 + 기본 장부 정확 일치.
 * (B) 에이전트 있음(강고임 1, 번식·이동 on), baseCost=0, +4000 tick: 전체 상태 해시(E+에이전트) 일치. */
function reg(seed) {
  var maxd = 0, ok = true;
  /* (A) 에이전트 0 */
  [true, false].forEach(function (drive) {
    var a = core5.createSim(seed, Object.assign({ drive: drive }, AGG, LIFE, REPRO, MOVE)); core5.run(a, 10000);
    var b = core.createSim(seed, Object.assign({ drive: drive, baseCost: 0 }, AGG, LIFE, REPRO, MOVE)); core.run(b, 10000);
    for (var i = 0; i < a.E.length; i++) maxd = Math.max(maxd, Math.abs(a.E[i] - b.E[i]));
    if (core5.hashState(a) !== core.hashState(b)) ok = false;
    if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk) ok = false;
  });
  /* (B) 에이전트 있음, 번식·이동 on, baseCost=0 */
  var a5 = core5.createSim(seed, Object.assign({}, AGG, LIFE, REPRO, MOVE)); core5.run(a5, FORM);
  var b6 = core.createSim(seed, Object.assign({ baseCost: 0 }, AGG, LIFE, REPRO, MOVE)); core.run(b6, FORM);
  spawnStrongest(core5, a5, 1); spawnStrongest(core, b6, 1);
  core5.run(a5, 4000); core.run(b6, 4000);
  for (var j = 0; j < a5.E.length; j++) maxd = Math.max(maxd, Math.abs(a5.E[j] - b6.E[j]));
  if (core5.hashState(a5) !== core.hashState(b6)) ok = false;
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: baseCost on, 닫힌 장부(기초대사도 metabolized 에 기록) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnStrongest(core, sim, 1);
  core.run(sim, 8000);                            // 성장→과잉→사멸(아사 포함)→정착 긴 구간
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass,
    pop: sim.agents.length, deaths: sim.deaths, births: sim.births,
    metabolized: sim.metabolized, pass: led.residual < 1e-6 };
}

/* ── det: baseCost on, 결정론(비트 동일) ── */
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

/* ── starve: ① 옅은 곳의 정지 생명이 굶어 죽는가(절대 문턱) ──
 * 정지(이동 off)·번식 off 단일 에이전트를 (a) source 봉우리 (b) 마른 곳(40,40 — src/sink 에서 먼 옅은 배경)에 1500 tick.
 * baseCost on: 봉우리는 살고 마른 곳은 죽는다. baseCost=0: 마른 곳도 산다(문턱 없음 → 어디서나 생존). */
function starve(seed) {
  function trial(bc, x, y) {
    var s = core.createSim(seed, scn({ baseCost: bc, move: false, repro: false })); core.run(s, FORM);
    core.spawnAgent(s, x, y); core.run(s, 1500);
    return s.agents.length > 0;
  }
  var sx = 16, sy = 16, tx = 40, ty = 40;
  var poolOn = trial(BASE, sx, sy);     // baseCost on, 봉우리 → 산다
  var thinOn = trial(BASE, tx, ty);     // baseCost on, 마른 곳 → 죽는다
  var thinOff = trial(0, tx, ty);       // baseCost=0, 마른 곳 → 산다(문턱 없음)
  return { seed: seed, poolOn: poolOn, thinOn: thinOn, thinOff: thinOff,
    /* 봉우리 생존 + 마른 곳 아사 + (문턱 없으면 마른 곳도 생존) = 자원이 생사를 공간적으로 가른다 */
    pass: poolOn && !thinOn && thinOff };
}

/* ── seek: ② 떠나야 산다(정적 세계) ──
 * source 비탈 거리 12(옅은 가장자리)에 단일 에이전트(번식 off)를 놓고 1500 tick. source 는 안 옮긴다(정적).
 * 이동 on: 봉우리로 올라가 살아남는다(거리↓). 이동 off: 그 자리에서 굶어 죽는다(baseCost 문턱). */
function seek(seed) {
  function trial(move) {
    var s = core.createSim(seed, scn({ move: move, repro: false })); core.run(s, FORM);
    var sx = s.p.source.x, sy = s.p.source.y;
    var a = core.spawnAgent(s, sx + 12, sy);       // 봉우리에서 거리 12 옅은 비탈
    var d0 = core.torusDist(W, H, a.x, a.y, sx, sy);
    core.run(s, 1500);
    var alive = s.agents.length > 0;
    var ax = alive ? s.agents[0].x : a.x, ay = alive ? s.agents[0].y : a.y;
    return { d0: d0, d1: core.torusDist(W, H, ax, ay, sx, sy), alive: alive };
  }
  var on = trial(true), off = trial(false);
  return { seed: seed, d0: on.d0, dOn: on.d1, aliveOn: on.alive, aliveOff: off.alive,
    /* 이동 on 은 봉우리로 올라가 산다(거리<3), 이동 off 는 굶어 죽는다 — 정적 세계의 "떠나야 산다" */
    pass: on.alive && on.d1 < 3 && !off.alive };
}

/* ── confine: ③ 개체군이 자원 두꺼운 영역에만 공간적으로 국한 ──
 * baseCost on vs off 로 개체군을 키운다(form+seed+8000). baseCost on:
 *  (a) 생존자 평균 흡수 got >= baseCost (전부 진짜 고임 위 — 공간 국한)
 *  (b) 개체수 감소(잉여 아사) + 세계가 덜 strip(sumE ↑) — baseCost off 대비.
 * (얼어붙음(churn=0)은 baseCost 로 안 풀린다 — §6 정직한 한계.) */
function confine(seed) {
  function grow(bc) {
    var s = core.createSim(seed, scn({ baseCost: bc })); core.run(s, FORM);
    spawnStrongest(core, s, 1); core.run(s, 8000);
    return { pop: s.agents.length, sumE: core.measure(s).sumE, mg: meanGot(core, s) };
  }
  var on = grow(BASE), off = grow(0);
  return { seed: seed, popOn: on.pop, popOff: off.pop, sumEOn: on.sumE, sumEOff: off.sumE,
    mgOn: on.mg, baseCost: BASE,
    /* 생존자 전부 got>=baseCost(진짜 고임) + 개체수↓ + 세계 덜 strip(sumE↑) = 공간 국한 */
    pass: on.pop > 0 && on.mg >= BASE && on.pop < off.pop && on.sumE > off.sumE * 2 };
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
    console.log('회귀 0: baseCost=0 step-0006 == step-0005 (에이전트 0 구동 on/off + 에이전트 있음 번식·이동 on baseCost=0)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'pop', 'deaths', 'births', 'metabolized', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (기초대사도 m→소산 → metabolized 에 기록; sumE+M+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'starve') {
    var rs = seeds.map(starve); table(rs, ['seed', 'poolOn', 'thinOn', 'thinOff', 'pass']);
    console.log('baseCost on: 봉우리 생존·마른 곳 아사 / baseCost=0: 마른 곳도 생존 (자원이 생사를 공간적으로 가른다 — 절대 문턱)');
    return rs.every(function (r) { return r.pass; });
  } else if (mode === 'seek') {
    var rk = seeds.map(seek); table(rk, ['seed', 'd0', 'dOn', 'aliveOn', 'aliveOff', 'pass']);
    console.log('avg dOn=' + avg(rk, 'dOn').toFixed(1) + ' (이동 on 봉우리로 올라가 생존, 이동 off 그 자리 아사 — 정적 세계의 "떠나야 산다")');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'confine') {
    var rf = seeds.map(confine); table(rf, ['seed', 'popOn', 'popOff', 'sumEOn', 'sumEOff', 'mgOn', 'baseCost', 'pass']);
    console.log('avg popOn=' + avg(rf, 'popOn').toFixed(0) + ' vs popOff=' + avg(rf, 'popOff').toFixed(0) +
      ' · avg sumEOn=' + avg(rf, 'sumEOn').toFixed(0) + ' vs sumEOff=' + avg(rf, 'sumEOff').toFixed(0) +
      ' (생존자 평균 흡수>=baseCost 인 고임에만 국한, 세계 덜 strip)');
    return rf.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'starve', 'seek', 'confine'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
