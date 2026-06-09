/* HWS step-0011 헤드리스 검증 — 구동 내생화(별: R 누적 핵에서 점화하는 내생 주입원, 연료 소진까지 서행).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 ignite 법칙 1개. 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0011/verify.js <reg|conserve|det|churn|collapse|all> [seed]
 *  - reg     : 회귀 0 — kIgnite=0 이면 step-0010 코어와 비트 동일(별 분기 통째 skip). cross-core 직접 비교.
 *  - conserve: 보존 — 별이 주입(연료→E, injected 경계)하는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kIgnite on 같은 시드 2회 비트 동일(E+R+에이전트+별). 별 방향 tumbleHash 도 시드 결정.
 *  - churn   : 가설 ① G2/G3 — 내생 구동이 step-0010 의 후반 동결을 *푼다*. 내생 vs 외부-정적의 churn(출생+사망)·
 *              무게중심 떠돎을 대조: 내생이 외부보다 churn 폭발·무게중심 떠돎(영구 전역 봉우리 소멸).
 *  - collapse: 정직한 한계 — 내생 churn 은 *끝없지 않다*. 생명이 이동 채식지에서 과증식→E 과소비→별 연료(R)
 *              형성 억제→별 공멸(overshoot-collapse). 붕괴 tick 을 측정(전 시드 재현). 끝없는 churn 미완.
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오: 외부 source off(drive:false) — 별이 유일한 구동. 응집·생명·번식·이동·탐사·결정화·기복 상수는
 * step-0010 그대로(단 baseCost 0.05 — 내생 풍요에 맞춘 생존 문턱). 별 상수는 step-0011 신규(아래 STAR).
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // 새 law-pipeline 코어
var REF = require('../step-0010/sim-core.js');             // 회귀 골든 레퍼런스

var SEEDS = [42, 7, 1234, 99, 2026];
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02, pTumble: 1.0 };
var STAGE = { kRelief: 1.0, kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };
var STAR = { kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20 };
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, N = W * H;

/* 내생: 외부 source off, 별이 구동. */
function endoScn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
/* 외부-정적: step-0010 표준(고정 source, 별 off). */
function exterScn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, { drive: true, srcJump: 0, kEvap: 0.001, baseCost: 0.08, kIgnite: 0 }, extra || {}); }
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(C, sim, k) { var pl = C.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) C.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(C, sim, k) { for (var i = 0; i < k; i++) C.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function popCentroid(sim) { var a = sim.agents; if (!a.length) return null; var sx = 0, sy = 0; for (var i = 0; i < a.length; i++) { sx += a[i].x; sy += a[i].y; } return { x: sx / a.length, y: sy / a.length }; }
function wanderOf(cs) { if (cs.length < 2) return 0; var mx = 0, my = 0; cs.forEach(function (c) { mx += c.x; my += c.y; }); mx /= cs.length; my /= cs.length; var w = 0; cs.forEach(function (c) { var d = ENG.torusDist(W, H, c.x, c.y, mx, my); w += d * d; }); return Math.sqrt(w / cs.length); }

/* 두 sim 비트 동일 비교(E·R·장부·에이전트). */
function sameState(a, b) {
  var maxd = 0, i;
  for (i = 0; i < a.E.length; i++) { var dd = Math.abs(a.E[i] - b.E[i]); if (dd > maxd) maxd = dd; }
  for (i = 0; i < a.R.length; i++) { var dr = Math.abs(a.R[i] - b.R[i]); if (dr > maxd) maxd = dr; }
  var ok = maxd === 0;
  if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk || a.metabolized !== b.metabolized) ok = false;
  if (a.agents.length !== b.agents.length) ok = false;
  else for (var k = 0; k < a.agents.length; k++) { var p = a.agents[k], q = b.agents[k]; if (p.x !== q.x || p.y !== q.y || p.m !== q.m) ok = false; }
  return { maxDiff: maxd, pass: ok && maxd === 0 };
}

/* ── reg: kIgnite=0 → step-0010 비트 동일 (별 분기 통째 skip). 에이전트 둔 전체 스택(외부 source on). ── */
function reg(seed) {
  var scn = Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, { drive: true, srcJump: 0, kEvap: 0.001, baseCost: 0.08, kIgnite: 0 });
  var a = ENG.createSim(seed, scn); ENG.run(a, 6000); spawnLife(ENG, a, 3); ENG.run(a, 3000);
  var b = REF.createSim(seed, scn); REF.run(b, 6000); spawnLife(REF, b, 3); REF.run(b, 3000);
  var r = sameState(a, b); r.seed = seed; r.hashE = ENG.hashState(a); r.hashR = REF.hashState(b); r.pass = r.pass && r.hashE === r.hashR;
  return r;
}

/* ── conserve: 별 주입(연료→E, injected) 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, endoScn()); seedStars(ENG, sim, 6); ENG.run(sim, 4000); spawnLife(ENG, sim, 5); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, injected: sim.injected, burned: sim.burned, starB: sim.starBirths, pass: led.residual < 1e-6 };
}

/* ── det: kIgnite on 같은 시드 2회 비트 동일(별 방향 tumbleHash 시드 결정). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, endoScn()); seedStars(ENG, s, 6); ENG.run(s, 4000); spawnLife(ENG, s, 5); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* 한 시나리오: 풍경 형성 → 생명 심기 → 정착 → 측정 창의 churn(출생+사망) + 무게중심 떠돎. */
function runChurn(C, scn, withStars) {
  var rows = SEEDS.map(function (seed) {
    var sim = C.createSim(seed, scn);
    if (withStars) seedStars(C, sim, 6);
    C.run(sim, 4000); spawnLife(C, sim, 5); C.run(sim, 2000);    // 4000 형성 + 5 심음 + 2000 정착
    var b0 = sim.births, d0 = sim.deaths, cens = [];
    for (var t = 0; t < 5000; t += 250) { C.run(sim, 250); var c = popCentroid(sim); if (c) cens.push(c); }   // 측정 창 6000~11000
    return { seed: seed, churn: (sim.births - b0) + (sim.deaths - d0), wander: wanderOf(cens), pop: sim.agents.length };
  });
  return rows;
}

/* ── churn: 가설 — 내생 구동이 후반 동결을 푼다(외부 대비 churn 폭발 + 무게중심 떠돎). ── */
function churnTest() {
  var ext = runChurn(REF, exterScn(), false);   // 외부-정적은 step-0010 코어로(별 없음)
  var end = runChurn(ENG, endoScn(), true);
  var eC = avg(ext, 'churn'), nC = avg(end, 'churn'), eW = avg(ext, 'wander'), nW = avg(end, 'wander');
  return { ext: ext, end: end, extChurn: eC, endChurn: nC, extWander: eW, endWander: nW,
    /* 내생 churn 이 외부의 5배↑ & 무게중심 떠돎이 외부의 5배↑(영구 전역 봉우리 소멸). */
    pass: nC > eC * 5 && nW > eW * 5 && nW > 2.0 };
}

/* ── collapse: 정직한 한계 — 내생 churn 은 끝없지 않다. 과증식→붕괴 tick 측정. ── */
function collapse(seed) {
  var sim = ENG.createSim(seed, endoScn()); seedStars(ENG, sim, 6); ENG.run(sim, 4000); spawnLife(ENG, sim, 5);
  var peak = 0, collapseTick = -1;
  for (var t = 4000; t <= 24000 && collapseTick < 0; t += 250) {
    ENG.run(sim, 250);
    if (sim.agents.length > peak) peak = sim.agents.length;
    if (sim.agents.length === 0) collapseTick = t;
  }
  return { seed: seed, peakPop: peak, collapseTick: collapseTick, pass: collapseTick > 0 };  // pass=붕괴 재현(한계 확인)
}

function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'maxDiff', 'hashE', 'hashR', 'pass']);
    console.log('회귀 0: kIgnite=0 step-0011 == step-0010 (전체 스택 + 에이전트, 별 분기 skip)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'injected', 'burned', 'starB', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (별 주입=injected 경계, sumE+M+R+evap+sunk+metab−injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']); return rd.every(function (r) { return r.pass; });
  } else if (mode === 'churn') {
    var r = churnTest();
    console.log('외부-정적(step-0010):'); table(r.ext, ['seed', 'churn', 'wander', 'pop']);
    console.log('내생 서행 별(step-0011):'); table(r.end, ['seed', 'churn', 'wander', 'pop']);
    console.log('측정 창 churn(출생+사망): 외부 ' + r.extChurn.toFixed(0) + ' → 내생 ' + r.endChurn.toFixed(0) +
      ' (' + (r.endChurn / Math.max(1, r.extChurn)).toFixed(0) + '배). 무게중심 떠돎: 외부 ' + r.extWander.toFixed(2) + ' → 내생 ' + r.endWander.toFixed(2) +
      '. 영구 전역 봉우리 소멸 → step-0010 후반 동결을 푼다(G2/G3 방향 확증).');
    return r.pass;
  } else if (mode === 'collapse') {
    var rg = seeds.map(collapse); table(rg, ['seed', 'peakPop', 'collapseTick', 'pass']);
    console.log('정직한 한계: 내생 churn 은 *끝없지 않다*. 생명이 이동 채식지에서 과증식(peak ' + avg(rg, 'peakPop').toFixed(0) +
      ')→E 과소비→별 연료(R) 억제→공멸(붕괴 tick 평균 ' + avg(rg, 'collapseTick').toFixed(0) + '). 끝없는 churn 미완 — 생명의 *방향성 드리프트 추적* 필요(step-0010 §8.2 백로그).');
    return rg.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'churn', 'collapse'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
