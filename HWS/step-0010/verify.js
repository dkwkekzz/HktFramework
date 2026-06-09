/* HWS step-0010 헤드리스 검증 — 확률적 탐사(run-and-tumble): 생명이 움직이는 풍경을 능동 추적한다
 * 사용: node verify.js <reg|conserve|det|escape|churn|all> [seed]
 *  - reg     : 회귀 0 — pTumble=0 step-0010 == step-0009 비트 단위 동일(E·R·장부·에이전트 직접 비교).
 *              에이전트를 둔 전체 스택(정적 source + 떠도는 자원)에서 이동 블록을 타되 tumble 분기는 skip.
 *  - conserve: V1 보존 — 탐사 on 에서도 닫힌 장부 잔차 < 1e-6 (탐사는 위치만 바꿀 뿐 거래가 없다).
 *  - det     : V2 결정론 — 탐사 on, 같은 시드 2회 실행 비트 동일(E+R+에이전트). 의사난수도 시드 결정론.
 *  - escape  : 가설 ② 국소 최대 탈출 — 옅은 트랩(굶주리는 국소 최대)에 갇힌 생명이 *옅은 골짜기(해자)를 건너*
 *              피난처로 가는가. 정적 두-봉우리 필드(트랩 C + 해자 + 피난처 B). 탐사 on 이면 tumble 로 해자를
 *              건너 B 에서 생존, off(greedy)면 C 의 국소 최대에 갇혀 굶어 죽는다(step-0005~0009 국소 최대 함정).
 *  - churn   : 가설 ①(생존) + 정직한 한계(G2) — 기복(움직이는 풍경)·정적 source 세계에서 탐사 생명이 *산다*
 *              (pop>0, 0009 §8.1 의 생존 재확인), *그러나* 정착 후반의 churn 은 탐사가 있어도 멎는다.
 *              전반 6k vs 후반 6k 의 출생·사망을 탐사 on/off 로 대조: 후반엔 둘 다 churn 이 붕괴한다 —
 *              개체군이 *영구 전역 끌개*인 정적 source 로 수렴하기 때문(G3). 탐사의 도달거리는 국소적(가까운
 *              refuge 로 골짜기 건너기 = escape)이라 전역 봉우리를 못 이긴다. 즉 G2 의 진짜 장애는 *생명의
 *              이동 능력*(escape 로 해결)이 아니라 *영구 전역 봉우리의 존재* — 구동 내생화가 G2 완전 해소의 조건.
 *              (step-0005·0006 의 "능력 추가가 정적 끌개로 수렴" 패턴의 churn 차원 재연.)
 *  - all     : 전 모드 + 요약
 * 응집/생명/번식/이동/기초대사비/결정화/기복 시나리오 상수는 step-0009 그대로. 이 step 표준 source 는 *정적*
 * (srcJump=0) — 내생 풍경 churn 이 주인공이고 외부 sawtooth 는 끈다(0009 §8.1 표준·패널 기본과 일치).
 * 탐사 시나리오 상수: pTumble=1.0 (step-0010 신규 — 갇힌·굶주린 매 tick 무조건 tumble = 최대 탐사).
 */
'use strict';
var core = require('./sim-core.js');
var core9 = require('../step-0009/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02 };
var BASE = 0.08;
var STATIC = { srcJump: 0, srcPeriod: 150 };       // 이 step 표준: 정적 source(내생 churn 이 주인공)
var CRYST = { kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };  // step-0009 그대로
var RELIEF = { kRelief: 1.0 };                     // 무대(기복) — step-0009
var TUMBLE = { pTumble: 1.0 };                     // 탐사(run-and-tumble) — step-0010 신규
var POOL = { minE: 1.5, prom: 0.3 };
var W = core.DEFAULTS.W, H = core.DEFAULTS.H, N = W * H;

/* 탐사까지 켠 표준 시나리오(전체 스택, 정적 source). 회귀(reg)는 pTumble=0 으로 따로 만든다. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, STATIC, CRYST, RELIEF, TUMBLE, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}

/* 두 sim 의 상태(E·R·장부·에이전트)가 비트 단위 동일한가 — cross-core 회귀 비교용. */
function sameState(a, b) {
  var maxd = 0;
  for (var i = 0; i < a.E.length; i++) { var dd = Math.abs(a.E[i] - b.E[i]); if (dd > maxd) maxd = dd; }
  for (i = 0; i < a.R.length; i++) { var dr = Math.abs(a.R[i] - b.R[i]); if (dr > maxd) maxd = dr; }
  var ok = maxd === 0;
  if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk || a.metabolized !== b.metabolized) ok = false;
  if (a.agents.length !== b.agents.length) ok = false;
  else for (var k = 0; k < a.agents.length; k++) {
    var p = a.agents[k], q = b.agents[k];
    if (p.x !== q.x || p.y !== q.y || p.m !== q.m) ok = false;
  }
  return { maxDiff: maxd, pass: ok };
}

/* ── reg: 회귀 0 — pTumble=0 면 step-0009 와 비트 단위 동일 ──
 * 에이전트를 둔 전체 스택(기복·결정화·생명·번식·이동·baseCost)에서 정적 source / 떠도는 source 두 경우 모두:
 * pTumble=0 이면 이동 블록을 타되 tumble 분기가 skip 되어 step-0009 의 greedy("갇히면 제자리")와 동일.
 * (에이전트 0 일 땐 이동 블록 자체가 안 돌므로 자명 — 의미 있는 비교는 에이전트가 있을 때.) */
function reg(seed) {
  var maxd = 0, ok = true;
  [{ srcJump: 0 }, { srcJump: 6 }].forEach(function (jump) {
    var a = core9.createSim(seed, scn(Object.assign({ pTumble: 0 }, jump)));
    core9.run(a, FORM); spawnStrongest(core9, a, 3); core9.run(a, 4000);
    var b = core.createSim(seed, scn(Object.assign({ pTumble: 0 }, jump)));
    core.run(b, FORM); spawnStrongest(core, b, 3); core.run(b, 4000);
    var r = sameState(a, b); maxd = Math.max(maxd, r.maxDiff); if (!r.pass) ok = false;
  });
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: 탐사 on(전체 스택), 닫힌 장부(sumE+M+R+evap+sunk+metab-injected=E0) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnStrongest(core, sim, 3);
  core.run(sim, 8000);
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass, store: led.store,
    pop: sim.agents.length, births: sim.births, deaths: sim.deaths, tumbles: sim.tumbles, pass: led.residual < 1e-6 };
}

/* ── det: 탐사 on, 결정론(비트 동일, R 포함) — 의사난수 방향도 시드 결정론(tumbleHash) ── */
function det(seed) {
  function build() {
    var s = core.createSim(seed, scn()); core.run(s, FORM); spawnStrongest(core, s, 3); core.run(s, 4000); return s;
  }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: core.hashState(a), hashB: core.hashState(b),
    pass: bit && core.hashState(a) === core.hashState(b) };
}

/* 셀 E 를 val 로 *설정*하고 E0 보정(장부 유지) — escape 트랩 필드 합성용. */
function setCell(sim, x, y, val) {
  var i = ((y % H) + H) % H * W + ((x % W) + W) % W;
  sim.E0 += val - sim.E[i]; sim.E[i] = val;
}

/* 트랩 필드 합성 — 배경 0, 트랩 스파이크 C(굶주리는 국소 최대), 해자(C 둘레 1~√2), 피난처 B(거리 2~6 고리 high).
 * C 에서 4 축 이웃(해자)은 낮아 greedy 가 갇히고, 해자 너머 B 는 높다 — 한 번 tumble 로 해자를 건너면 greedy 가
 * B 로 올라탄다. 트랩 C 의 흡수는 비용 미만(굶주림 게이트 충족)이라 갇힌 생명은 도박(탐사)할 만하다. */
function buildTrap(sim, sx, sy, trap, refuge) {
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) setCell(sim, x, y, 0);   // 배경 0
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {                                // 피난처 B 고리
    var dx = Math.min((x - sx + W) % W, (sx - x + W) % W);
    var dy = Math.min((y - sy + H) % H, (sy - y + H) % H);
    var d2 = dx * dx + dy * dy;
    if (d2 >= 4 && d2 <= 36) setCell(sim, x, y, refuge);
  }
  setCell(sim, sx, sy, trap);                                                       // 트랩 스파이크 C
}

/* ── escape: 가설 ② 국소 최대 탈출 — 탐사가 옅은 골짜기를 건넌다 ──
 * 정적·동결 필드(확산·증발·구동·응집·결정화·기복·번식 off — 순수 이동 측정)에서 트랩 C 에 생명 1 을 놓고 200 tick.
 *  - 탐사 on(pTumble=1): 굶주린 생명이 tumble 로 해자를 건너 피난처 B 에 올라타 생존(C 에서 거리 ≥2).
 *  - 탐사 off(greedy): C 가 국소 최대(이웃 해자가 더 낮음)라 못 움직이고 그 자리에서 굶어 죽는다.
 * step-0005~0009 내내 이월된 "greedy=국소 최대 함정"의 첫 해소(DURABLE CONSTRAINTS). */
function escape(seed) {
  var T = 200, sx = 32, sy = 32, TRAP = 1.2, REFUGE = 3.0;
  function trial(pt) {
    var s = core.createSim(seed, { kA: 0, life: true, repro: false, move: true, drive: false,
      kCryst: 0, kRelief: 0, kD: 0, kEvap: 0, baseCost: 0.10, kL: 0.05, mMaint: 0.03, mDeath: 0.05,
      mSeed: 0.50, lifeR: 1, pTumble: pt });
    buildTrap(s, sx, sy, TRAP, REFUGE);
    core.spawnAgent(s, sx, sy);
    core.run(s, T);
    var a = s.agents[0];
    var dist = a ? core.torusDist(W, H, a.x, a.y, sx, sy) : -1;   // -1 = 사망
    return { alive: !!a, m: a ? a.m : 0, dist: dist, tumbles: s.tumbles, led: core.ledger(s) };
  }
  var on = trial(TUMBLE.pTumble), off = trial(0);
  return { seed: seed, onAlive: on.alive, onDist: on.dist, onM: on.m, onTum: on.tumbles,
    offAlive: off.alive, offDist: off.dist, offTum: off.tumbles,
    residual: Math.max(on.led.residual, off.led.residual),
    /* ② 탐사 on: 해자 건너 B 생존(거리≥2). off: 갇혀 죽거나(dist=-1) 제자리(dist=0). 장부도 닫힌 채. */
    pass: on.alive && on.dist >= 2 && off.dist < 2 && Math.max(on.led.residual, off.led.residual) < 1e-6 };
}

/* ── churn: 가설 ①(생존) + 정직한 한계(G2 미완) — 산다, 그러나 후반 churn 은 탐사로도 안 풀린다 ──
 * 전체 스택(기복·결정화·생명, 정적 source). FORM(8000) 후 강고임 3 에 씨앗, 전반 6k / 후반 6k 의 출생·사망을
 * 탐사 on/off 로 대조. 검증되는 사실(전 시드 robust):
 *  - 생존(①): 탐사 on 개체군이 산다(pop>0 — 0009 §8.1 의 "정적 세계엔 생명 산다" 재확인).
 *  - 전반 colonization churn: 탐사 on 의 전반 6k 출생이 활발(씨앗→정착 transient).
 *  - 후반 동결(정직한 한계): 후반 6k 의 churn 은 탐사 유무와 무관하게 멎는다(on·off 둘 다 낮음) — 개체군이
 *    영구 전역 끌개(정적 source)로 수렴(G3)해 떠도는 field 고임을 안 쓴다. 탐사가 오히려 source 로의 수렴을
 *    가속(전역 봉우리를 국소 tumble 로 못 이김). → G2 완전 해소는 *구동 내생화*(영구 전역 봉우리 제거) 필요. */
function churn(seed) {
  function trial(pt) {
    var s = core.createSim(seed, scn({ pTumble: pt })); core.run(s, FORM);
    spawnStrongest(core, s, 3);
    core.run(s, 6000);
    var eB = s.births, eD = s.deaths, eTum = s.tumbles;
    core.run(s, 6000);
    return { earlyB: eB, earlyD: eD, lateB: s.births - eB, lateD: s.deaths - eD,
      lateTum: s.tumbles - eTum, pop: s.agents.length };
  }
  var on = trial(TUMBLE.pTumble), off = trial(0);
  return { seed: seed, onEarlyB: on.earlyB, onLateB: on.lateB, onLateD: on.lateD, onPop: on.pop, onLateTum: on.lateTum,
    offLateB: off.lateB, offLateD: off.lateD, offPop: off.pop,
    /* ① 생존(pop>0) + 전반 colonization churn 활발 + 후반 동결(on·off 둘 다 낮음 — G2 미완, 구동 내생화 필요). */
    pass: on.pop > 0 && on.earlyB >= 15 && (on.lateB + on.lateD) < 15 && (off.lateB + off.lateD) < 25 };
}

function fmt(x) {
  if (typeof x === 'boolean') return x ? 'true' : 'false';
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
    console.log('회귀 0: pTumble=0 step-0010 == step-0009 (전체 스택 + 에이전트, 정적·떠도는 source 모두 — tumble skip)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'store', 'pop', 'births', 'deaths', 'tumbles', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (탐사는 위치만 — sumE+M+R+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'escape') {
    var re = seeds.map(escape); table(re, ['seed', 'onAlive', 'onDist', 'onM', 'onTum', 'offAlive', 'offDist', 'offTum', 'residual', 'pass']);
    console.log('탐사 on: 해자 건너 피난처 생존(거리 ' + avg(re, 'onDist').toFixed(1) + ', tumble ' + avg(re, 'onTum').toFixed(0) +
      ') vs off: 국소 최대에 갇혀 사멸(거리 ' + avg(re, 'offDist').toFixed(1) + ') — 탐사가 옅은 골짜기를 건넌다(가설 ②)');
    return re.every(function (r) { return r.pass; });
  } else if (mode === 'churn') {
    var rg = seeds.map(churn); table(rg, ['seed', 'onEarlyB', 'onLateB', 'onLateD', 'onPop', 'onLateTum', 'offLateB', 'offLateD', 'offPop', 'pass']);
    console.log('생존(①): 탐사 on pop=' + avg(rg, 'onPop').toFixed(0) + ' (산다). 전반 6k 출생=' + avg(rg, 'onEarlyB').toFixed(0) +
      ' → 후반 6k 출생 on=' + avg(rg, 'onLateB').toFixed(1) + ' off=' + avg(rg, 'offLateB').toFixed(1) +
      ' (둘 다 동결 — 정직한 한계 §G2). 개체군이 정적 source(전역 끌개)로 수렴 → G2 완전 해소는 구동 내생화 필요.');
    return rg.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'escape', 'churn'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
