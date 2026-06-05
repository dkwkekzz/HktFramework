/* HWS step-0004 헤드리스 검증
 * 사용: node verify.js <reg|conserve|det|grow|regulate|collapse|capacity|all> [seed]
 *  - reg      : 회귀 0 — 번식 off(repro=false) step-0004 == step-0003 비트 단위 동일
 *               (에이전트 0·구동 on/off, 그리고 에이전트 있음·번식 off 둘 다)
 *  - conserve : V1 보존 — 번식 on 에서도 닫힌 장부(+M+metabolized) 잔차 < 1e-6 (성장+사멸 긴 구간)
 *  - det      : V2 결정론 — 번식 on, 같은 시드 2회 실행 비트 단위 동일(E+에이전트)
 *  - grow     : ① 생명이 자원 위에서 *번식*해 개체군을 이루는가 (1 → 다수)
 *  - regulate : ② 자원 한계가 개체수를 *조절*하는가 (과잉 후 carrying capacity 로 정착, 폭발·멸종 없음)
 *  - collapse : ③ 자원을 다 먹으면(구동 off) 개체군이 *붕괴*하는가 (전멸 + 닫힌 장부)
 *  - capacity : ② 보강 — 자원(source.rate)이 많을수록 carrying capacity K 가 커지는가(자원이 K 를 정함)
 *  - all      : 전 모드 + 요약
 * 응집 시나리오 상수: kA=0.45, aggMc=1.1, aggW=0.7 (step-0002 그대로).
 * 생명 시나리오 상수: kL=0.05, mMaint=0.03, mDeath=0.05, mSeed=0.5, lifeR=1 (step-0003 그대로).
 * 번식 시나리오 상수: mDiv=1.2, divR=1 (step-0004.md §2).
 */
'use strict';
var core = require('./sim-core.js');
var core3 = require('../step-0003/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var TICKS = 10000;
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };    // 응집 on (step-0002 와 동일)
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };              // 번식 (step-0004 신규)
var POOL = { minE: 1.5, prom: 0.3 };
var N = core.DEFAULTS.W * core.DEFAULTS.H;

function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

/* 가장 강한 고임(들)에 에이전트를 놓는다 — core 를 인자로 받아 step-0003/step-0004 양쪽에 쓴다. */
function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}

/* ── reg: 회귀 0 — 번식 off 면 step-0003 과 비트 단위 동일 ──
 * (A) 에이전트 0, 구동 on/off: E 비트 + 기본 장부 정확 일치.
 * (B) 에이전트 있음(강고임 3), 번식 off, +4000 tick: 전체 상태 해시(E+에이전트) 일치. */
function reg(seed) {
  var maxd = 0, ok = true;
  /* (A) 에이전트 0 */
  [true, false].forEach(function (drive) {
    var a = core3.createSim(seed, Object.assign({ drive: drive }, AGG, LIFE)); core3.run(a, TICKS);
    var b = core.createSim(seed, Object.assign({ drive: drive, repro: false }, AGG, LIFE)); core.run(b, TICKS);
    for (var i = 0; i < a.E.length; i++) maxd = Math.max(maxd, Math.abs(a.E[i] - b.E[i]));
    if (core3.hashState(a) !== core.hashState(b)) ok = false;
    if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk) ok = false;
  });
  /* (B) 에이전트 있음, 번식 off */
  var a3 = core3.createSim(seed, Object.assign({}, AGG, LIFE)); core3.run(a3, FORM);
  var b4 = core.createSim(seed, Object.assign({ repro: false }, AGG, LIFE)); core.run(b4, FORM);
  spawnStrongest(core3, a3, 3); spawnStrongest(core, b4, 3);
  core3.run(a3, 4000); core.run(b4, 4000);
  for (var j = 0; j < a3.E.length; j++) maxd = Math.max(maxd, Math.abs(a3.E[j] - b4.E[j]));
  if (core3.hashState(a3) !== core.hashState(b4)) ok = false;
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: 번식 on, 닫힌 장부(+생물량+대사) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnStrongest(core, sim, 1);
  core.run(sim, 8000);                            // 성장→과잉→사멸→정상상태 긴 구간
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass,
    pop: sim.agents.length, births: sim.births, deaths: sim.deaths,
    metabolized: sim.metabolized, pass: led.residual < 1e-6 };
}

/* ── det: 번식 on, 결정론(비트 동일) ── */
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

/* ── grow: ① 생명이 번식해 개체군을 이루는가 ──
 * 강한 고임에 에이전트 1 → 번식 on → 4000 tick. 개체수가 1 에서 다수로 늘면 통과. */
function grow(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  if (!spawnStrongest(core, sim, 1)) return { seed: seed, pass: false };
  core.run(sim, 4000);
  var pop = sim.agents.length;
  return { seed: seed, pop: pop, births: sim.births, M: core.totalBiomass(sim),
    pass: pop >= 20 && sim.births > 0 };
}

/* ── regulate: ② 자원 한계가 개체수를 조절하는가 ──
 * 에이전트 1 → 번식 on. 과잉(peak) 후 carrying capacity 로 정착:
 *   n1(+4000) ≈ n2(+8000) (정상상태), 멸종도 폭발도 없음(20 <= n <= N/4). */
function regulate(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  if (!spawnStrongest(core, sim, 1)) return { seed: seed, pass: false };
  var peak = 0;
  for (var t = 0; t < 4000; t++) { core.step(sim); if (sim.agents.length > peak) peak = sim.agents.length; }
  var n1 = sim.agents.length;
  core.run(sim, 4000);
  var n2 = sim.agents.length;
  var ratio = n1 > 0 ? n2 / n1 : 0;
  var steady = ratio > 0.8 && ratio < 1.25;
  var bounded = n2 >= 20 && n2 <= N / 4;          // 멸종(→0)도 폭발(→격자 가득)도 아님
  return { seed: seed, peak: peak, n1: n1, n2: n2, ratio: ratio,
    pass: steady && bounded };
}

/* ── collapse: ③ 자원을 다 먹으면 개체군이 붕괴하는가 ──
 * 정상 개체군 형성(5000 tick) → 구동 off(자원 재생 끊김) → 전멸까지 추적. */
function collapse(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  if (!spawnStrongest(core, sim, 1)) return { seed: seed, pass: false };
  core.run(sim, 5000);
  var before = sim.agents.length;
  sim.p.drive = false;                            // 구동 정지 — 자원 재생 끊김
  var t = 0;
  for (; t < 30000 && sim.agents.length; t++) core.step(sim);
  var led = core.ledger(sim);
  return { seed: seed, before: before, survivors: sim.agents.length, extinctAt: t,
    deaths: sim.deaths, residual: led.residual,
    pass: before >= 20 && sim.agents.length === 0 && led.residual < 1e-6 };
}

/* ── capacity: ② 보강 — 자원(source.rate)이 K 를 정하는가 ──
 * 같은 번식 규칙으로 source.rate 를 낮음/높음 스윕 → carrying capacity 비교.
 * 자원이 많을수록 K 가 커야 한다(K 는 생명이 정한 게 아니라 자원이 정한다). */
function capacity(seed) {
  function K(rate) {
    var s = core.createSim(seed, scn({ source: { rate: rate } })); core.run(s, FORM);
    if (!spawnStrongest(core, s, 1)) return -1;
    core.run(s, 8000);
    return s.agents.length;
  }
  var kLo = K(0.05), kMid = K(0.08), kHi = K(0.12);
  return { seed: seed, kLo: kLo, kMid: kMid, kHi: kHi,
    pass: kLo > 0 && kHi > kLo };                 // 자원↑ → K↑ (조절의 방향)
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
    console.log('회귀 0: 번식 off step-0004 == step-0003 (에이전트 0 구동 on/off + 에이전트 있음 번식 off)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'pop', 'births', 'deaths', 'metabolized', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (분열은 생물량 내부 분배 → 장부 불변; sumE+M+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'grow') {
    var rg = seeds.map(grow); table(rg, ['seed', 'pop', 'births', 'M', 'pass']);
    console.log('avg pop=' + avg(rg, 'pop').toFixed(1) + ' (에이전트 1 → 번식 → 개체군)');
    return rg.every(function (r) { return r.pass; });
  } else if (mode === 'regulate') {
    var rr2 = seeds.map(regulate); table(rr2, ['seed', 'peak', 'n1', 'n2', 'ratio', 'pass']);
    console.log('avg peak=' + avg(rr2, 'peak').toFixed(0) + ' → avg K=' + avg(rr2, 'n2').toFixed(0) + ' (과잉 후 carrying capacity 정착, ratio≈1 = 정상상태)');
    return rr2.every(function (r) { return r.pass; });
  } else if (mode === 'collapse') {
    var rv = seeds.map(collapse); table(rv, ['seed', 'before', 'survivors', 'extinctAt', 'deaths', 'residual', 'pass']);
    console.log('avg extinctAt=' + avg(rv, 'extinctAt').toFixed(0) + ' tick (구동 off → 자원 고갈 → 전멸, 장부 닫힘)');
    return rv.every(function (r) { return r.pass; });
  } else if (mode === 'capacity') {
    var rcap = seeds.map(capacity); table(rcap, ['seed', 'kLo', 'kMid', 'kHi', 'pass']);
    console.log('source.rate 0.05→0.08→0.12: K 가 자원과 함께 커진다 (K 를 정하는 건 생명이 아니라 자원)');
    return rcap.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'grow', 'regulate', 'collapse', 'capacity'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
