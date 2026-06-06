/* HWS step-0008 헤드리스 검증 — 저장체(평형 개체) + 첫 비가역 문턱(결정화·풍화)
 * 사용: node verify.js <reg|conserve|det|store|thresh|all> [seed]
 *  - reg     : 회귀 0 — kCryst=0 step-0008 == step-0007 비트 단위 동일(E·R·장부·에이전트 직접 비교).
 *  - conserve: V1 보존 — 결정화 on 에서도 닫힌 장부(R 을 보유 항으로) 잔차 < 1e-6.
 *  - det     : V2 결정론 — 결정화 on, 같은 시드 2회 실행 비트 동일(E+R+에이전트).
 *  - store   : 가설 ①② 저장체 — ① 결정화로 저장체 R 이 떠오르고 ② *흐름이 끊겨도(구동 off) 존재한다*.
 *              구동 off 후, 저장체 R 은 천천히 풍화(반감기 길다)하는데 소산 자원(고임 E)은 빠르게 붕괴.
 *              저장체의 정의(평형 = 흐름 0에서 존재)를 소산과 *대조*로 증명.
 *  - thresh  : 가설 ③ 비가역 문턱 — 결정화는 E>crystThresh 인 셀에서만 켜진다(질적 경계).
 *              문턱을 들판 위로 올리면(crystThresh 과대) R≈0(아무것도 안 굳음), 정상 문턱이면 R>0.
 *              "문턱 이전엔 흐르는 재료, 넘으면 굳은 상" 을 수치로.
 *  - all     : 전 모드 + 요약
 * 응집/생명/번식/이동/기초대사비/떠도는 자원 시나리오 상수는 step-0007 그대로.
 * 결정화 시나리오 상수: kCryst=0.02, crystThresh=2.0, kWeather=0.0004 (step-0008 신규).
 */
'use strict';
var core = require('./sim-core.js');
var core7 = require('../step-0007/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02 };
var BASE = 0.08;
var JUMP = { srcJump: 6, srcPeriod: 150 };
var CRYST = { kCryst: 0.01, crystThresh: 3.0, kWeather: 0.0003 };  // 결정화 (step-0008 신규)
/* 저장체/문턱 가설은 *생명 없는 정적 필드*로 검증한다(결정화는 필드 항 — step-0002 가 고임을 생명 없이 보였듯).
 * 생명 포함 전체 스택(reg·conserve·det)과 분리: greedy 생명은 source 를 먹어 흐르는 E 를 항상 낮게 만들어
 * 필드 현상을 가린다. 필드 프로브 = 정적 source(srcJump=0) + 생명 off + 결정화 on. */
function fieldScn(extra) { return Object.assign({}, AGG, { life: false, srcJump: 0 }, CRYST, extra || {}); }
var POOL = { minE: 1.5, prom: 0.3 };
var W = core.DEFAULTS.W, H = core.DEFAULTS.H, N = W * H;

/* 결정화까지 켠 표준 시나리오. 회귀(reg)는 kCryst=0 으로 따로 만든다. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, JUMP, CRYST, extra || {}); }
/* 회귀 비교용 — step-0007 기준 시나리오(결정화 없음). */
function scn7(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, JUMP, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}

/* 두 sim 의 상태(E·R·장부·에이전트)가 비트 단위 동일한가 — cross-core 회귀 비교용.
 * step-0007 은 R 이 없으므로(undefined) R 비교는 step-0008 쪽 R 이 전부 0 인지로 대신한다. */
function sameState(a, b) {
  var maxd = 0;
  for (var i = 0; i < a.E.length; i++) { var dd = Math.abs(a.E[i] - b.E[i]); if (dd > maxd) maxd = dd; }
  var ok = maxd === 0;
  if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk || a.metabolized !== b.metabolized) ok = false;
  if (a.agents.length !== b.agents.length) ok = false;
  else for (var k = 0; k < a.agents.length; k++) {
    var p = a.agents[k], q = b.agents[k];
    if (p.x !== q.x || p.y !== q.y || p.m !== q.m) ok = false;
  }
  /* step-0008 의 R 은 전부 0 이어야 회귀(결정화 off) */
  var rsum = 0; var Rb = b.R || a.R; for (var r = 0; r < Rb.length; r++) rsum += Rb[r];
  if (rsum !== 0) ok = false;
  return { maxDiff: maxd, pass: ok };
}

/* ── reg: 회귀 0 — kCryst=0 면 step-0007 와 비트 단위 동일 ──
 * (A) 에이전트 0, 구동 on/off. (B) 에이전트 있음(번식·이동·baseCost·떠도는 자원 on), kCryst=0, +4000 tick. */
function reg(seed) {
  var maxd = 0, ok = true;
  [true, false].forEach(function (drive) {
    var a = core7.createSim(seed, scn7({ drive: drive })); core7.run(a, 10000);
    var b = core.createSim(seed, scn({ drive: drive, kCryst: 0 })); core.run(b, 10000);
    var r = sameState(a, b); maxd = Math.max(maxd, r.maxDiff); if (!r.pass) ok = false;
  });
  var a7 = core7.createSim(seed, scn7()); core7.run(a7, FORM);
  var b8 = core.createSim(seed, scn({ kCryst: 0 })); core.run(b8, FORM);
  spawnStrongest(core7, a7, 1); spawnStrongest(core, b8, 1);
  core7.run(a7, 4000); core.run(b8, 4000);
  var rr = sameState(a7, b8); maxd = Math.max(maxd, rr.maxDiff); if (!rr.pass) ok = false;
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: 결정화 on, 닫힌 장부(sumE+M+R+evap+sunk+metab-injected=E0) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnStrongest(core, sim, 1);
  core.run(sim, 8000);
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass, store: led.store,
    crystallized: sim.crystallized, weathered: sim.weathered, pass: led.residual < 1e-6 };
}

/* ── det: 결정화 on, 결정론(비트 동일, R 포함) ── */
function det(seed) {
  function build() {
    var s = core.createSim(seed, scn()); core.run(s, FORM); spawnStrongest(core, s, 1); core.run(s, 4000); return s;
  }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: core.hashState(a), hashB: core.hashState(b),
    pass: bit && core.hashState(a) === core.hashState(b) };
}

/* ── store: 가설 ①② 저장체 — 결정화로 R 출현 + 흐름 끊겨도(구동 off) 존재(저장체 정의) ──
 * 두 세계를 같은 FORM 으로 키운 뒤 구동을 끊고 OFF tick 동안 보존율을 *대조*한다(생명 없는 정적 필드):
 *  - World R(결정화 on): 강한 고임 핵이 굳어 저장체 R 이 쌓인다(①). 구동 off 후 R 은 풍화로 *천천히* 준다.
 *  - World D(결정화 off = 순수 소산): 흐르는 고임은 source 없이 증발·확산·sink 로 *빠르게* 붕괴.
 * 결정화 off 세계를 기준선으로 쓰면 풍화 되먹임 교란이 빠져 평형 vs 소산 대비가 깨끗하다. */
function store(seed) {
  var OFF = 2000;
  var R = core.createSim(seed, fieldScn()); core.run(R, FORM);
  var R0 = core.totalStore(R); R.p.drive = false; core.run(R, OFF);
  var storeKeep = R0 > 0 ? core.totalStore(R) / R0 : 0;          // 저장체 보존율(평형적 → 높다)
  var D = core.createSim(seed, fieldScn({ kCryst: 0 })); core.run(D, FORM);
  var E0 = core.measure(D).sumE; D.p.drive = false; core.run(D, OFF);
  var flowKeep = E0 > 0 ? core.measure(D).sumE / E0 : 0;       // 순수 소산 보존율(소산적 → 낮다)
  return { seed: seed, R0: R0, storeKeep: storeKeep, flowKeep: flowKeep, margin: storeKeep - flowKeep,
    /* ① R0>10: 결정화로 저장체가 떠올랐다. ② 저장체는 순수 소산보다 훨씬 잘 남는다(평형 vs 소산). */
    pass: R0 > 10 && storeKeep > 0.45 && storeKeep - flowKeep > 0.25 };
}

/* ── thresh: 가설 ③ 비가역 문턱 — 결정화는 E>crystThresh 셀에서만(질적 경계) ──
 * 생명 없는 정적 필드. 같은 세계를 두 문턱으로: (hi) crystThresh 를 들판 최대(≈4) 위로 올림 → 아무 셀도
 * 안 넘음 → R=0. (norm) 정상 문턱 → 강한 고임 핵이 넘어 R>0. 문턱이 상전이를 *게이트*함을 대조로. */
function thresh(seed) {
  function trial(cth) {
    var s = core.createSim(seed, fieldScn({ crystThresh: cth })); core.run(s, FORM);
    return core.measureStore(s, 0.01);
  }
  var norm = trial(3.0);
  var hi = trial(100);                            // 어떤 E 도 못 넘는 문턱
  return { seed: seed, normStore: norm.total, normCells: norm.cells, hiStore: hi.total,
    /* 문턱 위로 올리면 결정화가 꺼진다(hiStore=0), 정상 문턱이면 켜진다(normStore>0) */
    pass: norm.total > 10 && norm.cells > 0 && hi.total === 0 };
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
    console.log('회귀 0: kCryst=0 step-0008 == step-0007 (에이전트 0 구동 on/off + 에이전트 있음 떠도는 자원 on kCryst=0)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'store', 'crystallized', 'weathered', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (결정화·풍화는 E↔R 쌍 거래; sumE+M+R+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'store') {
    var rs = seeds.map(store); table(rs, ['seed', 'R0', 'storeKeep', 'flowKeep', 'margin', 'pass']);
    console.log('구동 off 후 2000tick: 저장체 보존율=' + avg(rs, 'storeKeep').toFixed(2) +
      ' vs 순수 소산 보존율=' + avg(rs, 'flowKeep').toFixed(2) + ' — 저장체는 흐름 끊겨도 남는다(평형 vs 소산, 가설 ①②)');
    return rs.every(function (r) { return r.pass; });
  } else if (mode === 'thresh') {
    var rt = seeds.map(thresh); table(rt, ['seed', 'normStore', 'normCells', 'hiStore', 'pass']);
    console.log('정상 문턱 R=' + avg(rt, 'normStore').toFixed(1) + ' vs 문턱 과대 R=' + avg(rt, 'hiStore').toExponential(1) +
      ' — 결정화는 E>crystThresh 셀에서만(질적 경계, 가설 ③)');
    return rt.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'store', 'thresh'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
