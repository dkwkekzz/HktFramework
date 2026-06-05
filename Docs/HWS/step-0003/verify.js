/* HWS step-0003 헤드리스 검증
 * 사용: node verify.js <reg|conserve|det|consume|homeo|starve|graze|all> [seed]
 *  - reg      : 회귀 0 — 생명 off(에이전트 0) step-0003 == step-0002 비트 단위 동일 (구동 on/off)
 *  - conserve : V1 보존 — 생명 on 에서도 닫힌 장부(+M+metabolized) 잔차 < 1e-6 (long run)
 *  - det      : V2 결정론 — 생명 on, 같은 시드 2회 실행 비트 단위 동일(E+에이전트)
 *  - consume  : ① 생명이 고임을 소비하는가 — 에이전트 자리의 자원이 대조군 대비 고갈되는가
 *  - homeo    : ② 항상성 — 구동이 살아 자원이 재생되는 한 생명이 지속하는가(생물량 정상상태)
 *  - starve   : ③ 자원이 마르면 죽는가 — 구동을 끄면 생명이 굶어 죽는가
 *  - graze    : §6.5 — 구동(sustained) 자원 위 정지 생명은 kL 을 키워도 과방목 공멸이 *없다*
 *  - all      : 전 모드 + 요약
 * 응집 시나리오 상수: kA=0.45, aggMc=1.1, aggW=0.7 (step-0002 그대로).
 * 생명 시나리오 상수: kL=0.05, mMaint=0.03, mDeath=0.05, mSeed=0.5, lifeR=1 (step-0003.md §2).
 */
'use strict';
var core = require('./sim-core.js');
var core2 = require('../step-0002/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var TICKS = 10000;
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };    // 응집 on (step-0002 와 동일)
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var POOL = { minE: 1.5, prom: 0.3 };

function scn(extra) { return Object.assign({}, AGG, LIFE, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

/* 강한 고임 위에 에이전트를 놓는다 — 가장 잘 먹는(source 가까운) 자원부터. */
function spawnOnStrongest(sim, k) {
  var pools = core.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length), placed = [];
  for (var i = 0; i < n; i++) { core.spawnAgent(sim, pools[i].x, pools[i].y); placed.push(pools[i]); }
  return placed;
}

/* ── reg: 회귀 0 — 에이전트 없으면 step-0002 와 비트 단위 동일 ── */
function reg(seed) {
  var maxd = 0, ok = true;
  [true, false].forEach(function (drive) {
    var a = core2.createSim(seed, Object.assign({ drive: drive }, AGG)); core2.run(a, TICKS);
    var b = core.createSim(seed, Object.assign({ drive: drive }, AGG)); core.run(b, TICKS); // 에이전트 0
    for (var i = 0; i < a.E.length; i++) maxd = Math.max(maxd, Math.abs(a.E[i] - b.E[i]));
    /* E 비트 + 기본 장부(injected/evaporated/sunk) 정확히 일치 */
    if (core2.hashState(a) !== core.hashBase(b)) ok = false;
    if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk) ok = false;
  });
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: 생명 on, 닫힌 장부(+생물량+대사) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnOnStrongest(sim, 3);
  core.run(sim, TICKS - FORM + 4000);             // 흡수·유지·사망이 섞인 긴 구간
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass,
    metabolized: sim.metabolized, deaths: sim.deaths, pass: led.residual < 1e-6 };
}

/* ── det: 생명 on, 결정론(비트 동일) ── */
function det(seed) {
  function build() {
    var s = core.createSim(seed, scn()); core.run(s, FORM); spawnOnStrongest(s, 3); core.run(s, 2000); return s;
  }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i]) { bit = false; break; }
  return { seed: seed, hashA: core.hashState(a), hashB: core.hashState(b),
    pass: bit && core.hashState(a) === core.hashState(b) };
}

/* ── consume: ① 생명이 고임을 소비하는가 ──
 * 같은 형성 상태에서 분기: (life) 강한 고임에 에이전트 / (control) 무생명.
 * 3000 tick 후 그 자리 국소 E 비교 — 생명 쪽이 더 고갈돼야 한다. */
function consume(seed) {
  var base = core.createSim(seed, scn()); core.run(base, FORM);
  var pools = core.detectPools(base, POOL);
  if (!pools.length) return { seed: seed, pass: false };
  var t = pools[0];
  /* life 분기 */
  var life = core.createSim(seed, scn()); core.run(life, FORM);
  core.spawnAgent(life, t.x, t.y);
  core.run(life, 3000);
  var eLife = core.localE(life, t.x, t.y, 3);
  /* control 분기 (무생명) */
  var ctl = core.createSim(seed, scn()); core.run(ctl, FORM + 3000);
  var eCtl = core.localE(ctl, t.x, t.y, 3);
  var drop = eCtl > 0 ? (eCtl - eLife) / eCtl : 0;
  return { seed: seed, e0local: core.localE(base, t.x, t.y, 3), eCtl: eCtl, eLife: eLife,
    drop: drop, pass: eLife < eCtl - 1e-6 };
}

/* ── homeo: ② 항상성 — 자원이 재생되는 한 생명이 지속 ──
 * 강한 고임에 에이전트 → 정착 2000 tick 후 생물량 m1, +4000 tick 후 m2.
 * 둘 다 생존(>mDeath)하고 정상상태(드리프트 작음)면 통과. 구동 on 유지. */
function homeo(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  var placed = spawnOnStrongest(sim, 1);
  if (!placed.length) return { seed: seed, pass: false };
  core.run(sim, 2000);
  var m1 = sim.agents.length ? sim.agents[0].m : 0;
  core.run(sim, 4000);
  var m2 = sim.agents.length ? sim.agents[0].m : 0;
  var alive = sim.agents.length === 1 && m2 > sim.p.mDeath;
  var ratio = m1 > 0 ? m2 / m1 : 0;
  var steady = ratio > 0.5 && ratio < 2.0;          // 생물량이 폭주/소멸 없이 정상상태
  return { seed: seed, m1: m1, m2: m2, ratio: ratio, alive: alive,
    pass: alive && steady };
}

/* ── starve: ③ 자원이 마르면 죽는가 ──
 * 강한 고임에 에이전트 → 2000 tick 정착(살아있음 확인) → 구동 off → 자원 고갈 → 사망. */
function starve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  var placed = spawnOnStrongest(sim, 1);
  if (!placed.length) return { seed: seed, pass: false };
  core.run(sim, 2000);
  var aliveBefore = sim.agents.length === 1 && sim.agents[0].m > sim.p.mDeath;
  sim.p.drive = false;                              // 구동 정지 — 자원 재생 끊김
  var diedAt = -1;
  for (var t = 0; t < 8000 && sim.agents.length; t++) { core.step(sim); }
  if (sim.agents.length === 0) diedAt = sim.deaths;
  var led = core.ledger(sim);
  return { seed: seed, aliveBefore: aliveBefore, deaths: sim.deaths,
    survivors: sim.agents.length, residual: led.residual,
    pass: aliveBefore && sim.agents.length === 0 && led.residual < 1e-6 };
}

/* ── graze: §6.5 — 구동(sustained) 자원 위 정지 생명은 kL 을 키워도 공멸하지 않는다 ──
 * 강고임(구동으로 계속 채워짐)에 에이전트 → kL 을 낮음/높음으로 스윕.
 * 둘 다 생존(과방목 붕괴 없음)하고, 큰 kL 일수록 생물량↑·자리 E↓(더 깊이 깎음)이면 통과.
 * (붕괴는 자원이 *유한*할 때만 — 그건 starve 가 본다.) */
function graze(seed) {
  function run1(kl) {
    var g = core.createSim(seed, scn({ kL: kl })); core.run(g, FORM);
    var p = core.detectPools(g, POOL)[0];
    if (!p) return null;
    core.spawnAgent(g, p.x, p.y); core.run(g, 8000);
    return { alive: g.agents.length, m: g.agents.length ? g.agents[0].m : 0,
      localE: core.localE(g, p.x, p.y, 3), residual: core.ledger(g).residual };
  }
  var lo = run1(0.05), hi = run1(0.80);
  if (!lo || !hi) return { seed: seed, pass: false };
  return { seed: seed, mLo: lo.m, mHi: hi.m, eLo: lo.localE, eHi: hi.localE,
    aliveLo: lo.alive, aliveHi: hi.alive, residual: Math.max(lo.residual, hi.residual),
    /* 과방목 공멸 없음 = 둘 다 생존 + 큰 kL 이 생물량↑·자리E↓ */
    pass: lo.alive === 1 && hi.alive === 1 && hi.m > lo.m && hi.localE < lo.localE && Math.max(lo.residual, hi.residual) < 1e-6 };
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
    console.log('회귀 0: 생명 off(에이전트 0) step-0003 == step-0002 (구동 on/off, ' + TICKS + ' tick)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'metabolized', 'deaths', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (sumE+M+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'consume') {
    var rs = seeds.map(consume); table(rs, ['seed', 'e0local', 'eCtl', 'eLife', 'drop', 'pass']);
    console.log('avg drop=' + (avg(rs, 'drop') * 100).toFixed(1) + '% (에이전트 자리 자원이 무생명 대조군 대비 고갈)');
    return rs.every(function (r) { return r.pass; });
  } else if (mode === 'homeo') {
    var rh = seeds.map(homeo); table(rh, ['seed', 'm1', 'm2', 'ratio', 'alive', 'pass']);
    console.log('avg m2=' + avg(rh, 'm2').toFixed(3) + ' (구동 on → 자원 재생 → 생물량 정상상태 = 항상성)');
    return rh.every(function (r) { return r.pass; });
  } else if (mode === 'starve') {
    var rv = seeds.map(starve); table(rv, ['seed', 'aliveBefore', 'deaths', 'survivors', 'residual', 'pass']);
    console.log('구동 off → 자원 고갈 → 전 에이전트 사망(survivors=0), 장부 닫힘(분해 E 환원)');
    return rv.every(function (r) { return r.pass; });
  } else if (mode === 'graze') {
    var rg = seeds.map(graze); table(rg, ['seed', 'mLo', 'mHi', 'eLo', 'eHi', 'aliveLo', 'aliveHi', 'pass']);
    console.log('kL 0.05→0.80: 구동 자원 위 정지 생명은 *공멸 없음*(둘 다 생존) — 생물량↑(mLo→mHi)·자리E↓(eLo→eHi). 붕괴는 유한 자원(starve)에서만.');
    return rg.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'consume', 'homeo', 'starve', 'graze'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
