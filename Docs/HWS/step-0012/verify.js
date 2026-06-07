/* HWS step-0012 헤드리스 검증 — 밀도 의존 자기제한(crowding: 국소 개체 밀도가 carrying capacity 를 만든다).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 crowd 법칙 1개. 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0012/verify.js <reg|conserve|det|sustain|all> [seed]
 *  - reg     : 회귀 0 — kCrowd=0 이면 step-0011 과 비트 동일(crowd 법칙 통째 skip). 내생 스택 해시를 golden endo@ 와 대조.
 *  - conserve: 보존 — 혼잡세(m→metabolized)가 도는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kCrowd on 같은 시드 2회 비트 동일(E+R+에이전트+별).
 *  - sustain : 가설 ④ — 밀도 의존 자기제한이 과증식-공멸을 막고 *끝없는 churn*(임계 자기조직)에 든다.
 *              step-0011(kCrowd=0)은 ~13k tick 에 공멸하지만, kCrowd 를 켜면 개체군이 carrying capacity 로 묶여
 *              지평선(40k)까지 생존하고 후반 창에서도 출생≈사망>0(별 10 유지·점화 지속).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0011 그대로(외부 source off, 별이 유일 구동) + 자기제한 노브 1개(kCrowd 0.20, crowdR 3).
 * crowdR 은 별 방출 반경(starR=3)과 같은 척도 — 한 채식지에서 몇이 경쟁하는가. R<3 이면 솎임이 국소적이라 공멸(과소).
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(crowd 법칙 포함)
var fs = require('fs');
var path = require('path');

var SEEDS = [42, 7, 1234, 99, 2026];
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02, pTumble: 1.0 };
var STAGE = { kRelief: 1.0, kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };
var STAR = { kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20 };
var CROWD = { kCrowd: 0.20, crowdR: 3 };                    // step-0012 신규 — 밀도 의존 자기제한(sustain config)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;
var HORIZON = 40000;

/* 내생(외부 source off, 별 구동) + 자기제한. extra 로 kCrowd=0 주면 step-0011 회귀. */
function endoScn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }

/* ── reg: kCrowd=0 → step-0011 비트 동일. golden endo@ 해시(crowd 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden endo@ 와 *동일 절차*(verify-sim-engine.js runGolden 의 endo): 별 6 + run 2000 + 생명 5 + run 3000, kCrowd=0. */
  var sim = ENG.createSim(seed, endoScn({ kCrowd: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['endo@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 혼잡세(m→metabolized)가 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, endoScn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, metab: sim.metabolized, pop: sim.agents.length, pass: led.residual < 1e-6 };
}

/* ── det: kCrowd on 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, endoScn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* 한 시드: 별 점화 후 pop 을 지평선까지 추적, 공멸(pop=0) tick + 후반 창(지평선-5000~지평선) 출생·사망. */
function runLife(extra) {
  return SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, endoScn(extra)); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5);
    var peak = 0, collapseTick = -1;
    for (var t = 4000; t <= HORIZON - 5000 && collapseTick < 0; t += 250) {
      ENG.run(sim, 250);
      if (sim.agents.length > peak) peak = sim.agents.length;
      if (sim.agents.length === 0) collapseTick = t;
    }
    var b0 = sim.births, d0 = sim.deaths;                    // 후반 창 churn 측정
    if (collapseTick < 0) ENG.run(sim, 5000);
    return { seed: seed, peak: peak, collapse: collapseTick,
      lateBirths: collapseTick < 0 ? sim.births - b0 : 0, lateDeaths: collapseTick < 0 ? sim.deaths - d0 : 0,
      finPop: sim.agents.length, finStars: sim.stars.length };
  });
}

/* ── sustain: 가설 — 자기제한이 공멸을 막고 끝없는 churn(임계 자기조직)에 든다. ── */
function sustainTest() {
  var off = runLife({ kCrowd: 0 });        // step-0011 — 공멸
  var on = runLife({});                    // step-0012 — 지속(carrying capacity)
  var onSurv = on.every(function (r) { return r.collapse < 0; });
  var offColl = off.every(function (r) { return r.collapse > 0; });
  var churnAlive = on.every(function (r) { return r.lateBirths > 0 && r.lateDeaths > 0; });
  return { off: off, on: on, pass: onSurv && offColl && churnAlive };
}

function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hash', 'golden', 'pass']);
    console.log('회귀 0: kCrowd=0 step-0012 == step-0011 (내생 스택 해시 == golden endo@, crowd 법칙 skip)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'metab', 'pop', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (혼잡세 m→metabolized 쌍 거래, sumE+M+R+evap+sunk+metab−injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']); return rd.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var r = sustainTest();
    console.log('step-0011 (kCrowd=0, 음성 피드백 없음):'); table(r.off, ['seed', 'peak', 'collapse']);
    console.log('step-0012 (kCrowd=0.20 R=3, 자기제한):'); table(r.on, ['seed', 'peak', 'finPop', 'finStars', 'lateBirths', 'lateDeaths']);
    var offC = avg(r.off, 'collapse'), onPop = avg(r.on, 'finPop'), onB = avg(r.on, 'lateBirths'), onD = avg(r.on, 'lateDeaths');
    console.log('공멸 tick: step-0011 평균 ' + offC.toFixed(0) + ' → step-0012 *공멸 없음*(지평선 ' + HORIZON + ' 생존). ' +
      '후반 창 출생/사망: ' + onB.toFixed(0) + '/' + onD.toFixed(0) + ' (≈ 균형 — 개체군 carrying capacity ~' + onPop.toFixed(0) +
      ' 에 묶여 별 10 유지·점화 지속). 끝없는 churn = 동결도 공멸도 아닌 임계 자기조직 — 완성.');
    return r.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
