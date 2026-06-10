/* HWS step-0028 헤드리스 검증 — 선택 투과 막(permeate: 막이 *무엇을 통과시킬지 고르는* 능동 경계 — 0018 수동 막[couple]에서 선택 투과[외부 자원만 들이고 내부는 가둠]로. 형태 사다리 M).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 permeate 법칙 1개(LAW_ORDER ⑥c2, couple 뒤·crowd 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0028/verify.js <reg|conserve|det|select|sustain|all> [seed]
 *  - reg     : 회귀 0 — kPermeate=0 이면 step-0027 과 비트 동일(permeate 통째 skip·E 불변). 선택 투과 막 스택 해시를 golden dend@ 와 대조.
 *  - conserve: 보존 — permeate(바깥→안 E 쌍 거래 — couple 과 같은 경계)가 도는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kPermeate on 같은 시드 2회 비트 동일(능동 import 가 E 를 바꿔 해시에. occ 막 판정 — 패스 무관, Math.random 금지).
 *  - select  : 가설 — *선택 투과 막이 농도 차를 유지한다*(능동 경계). membrane 아레나(균일 E 장 + 중심 kin 액적, 다른 법칙 다 off):
 *              off(막 없음 → 확산이 평형, 안≈바깥) vs on(능동 import·정류 → 안>바깥). ① import(permeated>0) ② *농도 차 유지*(ratio=안/바깥 ≫1·바깥 halo 고갈) ③ 셀↔셀 E 쌍 거래라 보존.
 *  - sustain : permeate(실제 능동 import)가 step-0027 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0 — 표면만 import·쌍 거래라 동역학 직교).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0027 그대로(별·…·가지치기 덴드라이트) + 선택 투과 막(kPermeate 0.3).
 *   *전체 스택은 희소·이동성*이라 큰 kin 액적이 드물어 막이 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 막 현상은 select 의 *membrane 아레나*에서 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(permeate 법칙 포함)
var fs = require('fs');
var path = require('path');

var SEEDS = [42, 7, 1234, 99, 2026];
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02, pTumble: 1.0 };
var STAGE = { kRelief: 1.0, kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };
var STAR = { kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20 };
var CROWD = { kCrowd: 0.20, crowdR: 3 };
var FSM = { kFSM: 1, livingFrac: 0.55, burnOn: 0.6, burnOff: 0.4 };
var FLUX = { kFlux: 1, aFlux: 0.1 };
var GENE = { kTemplate: 1, geneRate: 0.5, geneThresh: 0.3, geneMu: 0.01, geneTypes: 4, geneFit0: 0.5, geneFitStep: 0.15, geneClear: 0.05 };
var INHERIT = { kInherit: 1, inheritMu: 0.01, inheritCost: 0.02 };
var ADH = { kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5 };
var MEM = { kMembrane: 0.5 };
var SHARE = { kShare: 0.5, coopFit0: 1.0, coopFitStep: 0.0 };
var PUBLIC = { kPublic: 0.3, pubSynergy: 2.0 };
var DIFF = { kDiff: 0.3 };
var GERM = { kGermline: 0.3 };
var ANCHOR = { kAnchor: 1, anchorM: 0.6, anchorKin: 2 };
var TENSION = { kTension: 1, tensionGamma: 0.10 };
var ANISO = { kAniso: 1, anisoRate: 0.3, anisoThresh: 0.2 };
var TURING = { kTuring: 1, turRate: 0.3, turDecay: 0.5, turSat: 2.5 };
var DENDRITE = { kDendrite: 1, dendRate: 0.06, dendThresh: 0.5, dendSharp: 1.0 };
var SELECT = { kPermeate: 0.3 };  // step-0028 신규 — 선택 투과 막(전체 스택은 희소라 큰 액적 드물어 거의 안 켜짐 — 현상은 membrane 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 덴드라이트 + 선택 투과 막). extra 로 kPermeate=0 주면 step-0027 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, ANCHOR, TENSION, ANISO, TURING, DENDRITE, SELECT, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* membrane 아레나 — 균일 E 장(noise 미세 섭동) + 중심 kin 액적(tag1 8×8, m0=0 마커). 다른 법칙 다 off, permeate 만 on/off 로 *능동 경계를 격리*.
 * kPermeate>0 이면 액적 표면이 빈 바깥에서 E 를 능동 import(정류)해 안>바깥 농도 차를 유지하고, off 면 확산이 평형(안≈바깥). life off(에이전트는 막 마커)·kEvap=0·drive off 라 닫힌 장부 단순. */
function selArena(extra) {
  return Object.assign({}, {
    initE: 1.0, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0,
    kPermeate: 0.3
  }, extra || {});
}
var ARENA_T = 300;   // 막이 농도 차를 quasi-steady 로 세울 만큼(import flux ≈ 확산 backflow → 안>바깥 유지).
/* 중심 kin 액적 — (28..36)² = 8×8 tag1 블록(m0=0 마커, E 안 깎음). permeate 가 이 표면에서 바깥 E 를 안으로 끈다. */
function seedSelBlock(sim) { for (var y = 28; y < 36; y++) for (var x = 28; x < 36; x++) { var a = ENG.spawnAgent(sim, x, y, 0); a.g = 1; } }
/* membrane 아레나 1회 — kPermeate 를 주고 안/바깥 농도비 측정. */
function selRun(seed, opt) {
  var sim = ENG.createSim(seed, selArena(opt || {})); seedSelBlock(sim); ENG.run(sim, ARENA_T);
  var m = ENG.measureSelective(sim), led = ENG.ledger(sim);
  return { inside: m.inside, halo: m.halo, ratio: m.ratio, gradient: m.gradient, permeated: sim.permeated, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kPermeate=0 → step-0027 비트 동일. golden dend@ 해시(덴드라이트 스택, 막 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden dend@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kPermeate=0. */
  var sim = ENG.createSim(seed, scn({ kPermeate: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['dend@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: permeate(바깥→안 E 쌍 거래 — couple 과 같은 경계)가 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, permeated: sim.permeated, pass: led.residual < 1e-6 };
}

/* ── det: kPermeate on 같은 시드 2회 비트 동일(능동 import 가 E 변경 → 해시에). membrane 아레나로 막 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, selArena()); seedSelBlock(s); ENG.run(s, ARENA_T); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── select: 가설 — *선택 투과 막이 농도 차를 유지한다*(능동 경계). membrane 아레나서 off vs on. ──
 *  ① import: on 의 permeated > 0(능동 import 가 실제로 돈다).
 *  ② *농도 차 유지*(핵심 thesis): on 의 ratio(안/바깥) ≫1(능동 축적 — couple/확산 단독은 평형 ≈1) + 바깥 halo 고갈(on.halo < off.halo).
 *  ③ off 대비: off(막 없음)는 확산이 평형이라 ratio ≈1(안≈바깥). on 이 그보다 *유의하게* 높다(선택 투과의 능동 경계).
 *  보존: 바깥→안 E 쌍 거래라 잔차<1e-6. */
function selectTest(seed) {
  var off = selRun(seed, { kPermeate: 0 }), on = selRun(seed, {});
  var pass = on.permeated > 0                              // ① 능동 import 실활성
    && on.ratio > 1.3                                      // ② 농도 차 유지(안 > 바깥 — 능동 축적)
    && on.ratio > off.ratio * 1.2                          // ③ off(평형 ≈1)보다 유의하게 높다
    && on.halo < off.halo                                  //   바깥 halo 고갈(import 가 빈 바깥서 끌어옴)
    && on.residual < 1e-6;                                 //   바깥→안 E 쌍 거래(보존)라 닫힌 장부
  return { seed: seed, offRatio: off.ratio, ratio: on.ratio, offHalo: off.halo, inside: on.inside, halo: on.halo, gradient: on.gradient, permeated: on.permeated, residual: on.residual, pass: pass };
}

/* ── sustain: permeate(실제 능동 import)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, permeated: sim.permeated, collapse: collapse };
  });
  var surv = rows.every(function (r) { return r.collapse < 0; });
  var churn = rows.every(function (r) { return r.lateBirths > 0 && r.lateDeaths > 0; });
  return { rows: rows, pass: surv && churn };
}

function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hash', 'golden', 'pass']);
    console.log('회귀 0: kPermeate=0 step-0028 == step-0027 (선택 투과 막 스택 해시 == golden dend@, permeate 법칙 skip·E 불변).');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'permeated', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (선택 투과 막은 바깥→안 E 쌍 거래 — couple 과 같은 경계 → 장부 식 불변). 전체 스택은 희소·작은 액적이라 막이 약하게만 — *막* 효과는 membrane 아레나가 잰다(누적 import ' + avg(rc, 'permeated').toFixed(1) + ').');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: membrane 아레나(막 활성) 같은 시드 2회 비트 동일(능동 import 가 E 를 바꿔 해시에. occ 막 판정 — 패스 무관, Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'select') {
    var rk = seeds.map(selectTest); table(rk, ['seed', 'offRatio', 'ratio', 'offHalo', 'inside', 'halo', 'gradient', 'permeated', 'residual', 'pass']);
    console.log('선택 투과 막(*능동 경계가 농도 차를 유지한다*): 안/바깥 농도비 ratio ' + avg(rk, 'offRatio').toFixed(2) + '(막 없음=확산 평형 ≈1)→' + avg(rk, 'ratio').toFixed(2) +
      '(능동 import·정류 → 안>바깥). 안 ' + avg(rk, 'inside').toFixed(2) + ' vs 바깥 halo ' + avg(rk, 'halo').toFixed(2) + '(off ' + avg(rk, 'offHalo').toFixed(2) + ' → 고갈). 0018 couple(무차별 양방향 공유=수동 막)과 달리, permeate 는 *빈 바깥서만 능동 import*(정류=일방향)라 확산이 평형으로 되돌리려 *해도* 농도 차를 유지(far-from-equilibrium 경계 — 막은 *외부 자원만 들이고 내부는 가둔다*). author 아닌 *창발*(import 1개만 깖 — 척추 체크 2). 바깥→안 E 쌍 거래(보존)라 잔차 ' + avg(rk, 'residual').toExponential(2) + '.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'permeated', 'collapse']);
    console.log('막 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(선택 투과 막)이 동역학을 안 깬다(표면만 import·빈 바깥서만 채취·바깥→안 E 쌍 거래 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'select', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
