/* HWS step-0025 헤드리스 검증 — 방향성 결정화(anisotropy: genotype 이 결정 성장 *방향*을 정해 등방 blob 대신 가지·결정축. 형태 사다리 R3, R 하이트필드).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 anisotropy 법칙 1개(LAW_ORDER ⑤e, replicate 뒤·combust 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0025/verify.js <reg|conserve|det|aniso|sustain|all> [seed]
 *  - reg     : 회귀 0 — kAniso=0 이면 step-0024 와 비트 동일(anisotropy 통째 skip·R·E·G 불변). 방향성 결정화 스택 해시를 golden curv@ 와 대조.
 *  - conserve: 보존 — 방향성 결정화(E→R 쌍 거래 — 결정화/복제와 같은 경계)가 도는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kAniso on 같은 시드 2회 비트 동일(축 E→R 침착·태그 복사가 R·E·G 를 바꿔 해시에. 순차 — 축은 태그의 결정 함수, Math.random 금지).
 *  - aniso   : 가설 — 방향성 결정화(genotype 이 *결정축*을 정함). crystal 아레나(중심 유전 씨앗, 다른 법칙 다 off, anisotropy 만 on/off):
 *              결정이 *태그의 선호 축*으로만 자라 이방성(needle/결정축) → R 주축비↑. 핵심: tag1→가로(axisX≫axisY)·tag2→세로(axisY≫axisX) *직교* — 같은 법칙·다른 태그가 다른 축(유전형이 축을 정함). off 면 씨앗 그대로(등방·지수≈1).
 *  - sustain : 방향성 결정화(실제 E→R 재분배)가 step-0024 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0 — E→R 쌍 거래·자기제한 게이트라 동역학 직교).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0024 그대로(별·…·곡률 표면장력) + 방향성 결정화(kAniso 1).
 *   *전체 스택은 희소·이동성*이라 큰 유전형 결정이 드물어 방향성이 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 방향성 현상은 anisotropy 의 *crystal 아레나*에서 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(anisotropy 법칙 포함)
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
var ANISO = { kAniso: 1, anisoRate: 0.3, anisoThresh: 0.2 };  // step-0025 신규 — 방향성 결정화(전체 스택은 희소라 큰 결정 드물어 거의 안 켜짐 — 현상은 crystal 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 곡률 표면장력 + 방향성 결정화). extra 로 kAniso=0 주면 step-0024 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, ANCHOR, TENSION, ANISO, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* crystal 아레나 — 균일 E 장에 중심 유전 씨앗(tag1) 하나. 다른 법칙 다 off, anisotropy 만 on/off 로 *방향성을 격리*.
 * kAniso=1 이면 결정이 선호 축(태그1→가로)으로만 E→R 침착해 needle/결정축을 키운다(이방성), off 면 씨앗 disc 그대로(등방). kD=0·drive off 라 E 가 제자리(결정론·장부 단순). */
function anisoArena(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0,
    geneTypes: 4, kAniso: 1, anisoRate: 0.3, anisoThresh: 0.2
  }, extra || {});
}
var ARENA_T = 20;   // needle 가 격자 wrap 전에 또렷한 이방성에 들 만큼(20 tick → 축당 ~20 칸, 중심 32±20 ∈ [12,52] 안전).
/* 중심 유전 R 씨앗(태그 disc r2) 하나 — anisotropy 가 *그 태그의 선호 축*으로 needle 결정축을 키운다(tag1·3→가로·tag2·4→세로). */
function seedGeneDisc(sim, tag) { ENG.spawnGene(sim, 32, 32, 2, tag != null ? tag : 1, 1.0); }
/* crystal 아레나 1회 — kAniso·씨앗 태그를 주고 R 하이트필드 이방성 측정. */
function anisoRun(seed, ka, tag) {
  var sim = ENG.createSim(seed, anisoArena({ kAniso: ka })); seedGeneDisc(sim, tag); ENG.run(sim, ARENA_T);
  var a = ENG.measureAnisotropy(sim), led = ENG.ledger(sim);
  return { aniso: a.aniso, axisX: a.axisX, axisY: a.axisY, cells: a.cells, sumR: a.sumR, anisoGrown: sim.anisoGrown, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kAniso=0 → step-0024 비트 동일. golden curv@ 해시(곡률 표면장력 스택, 방향성 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden curv@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kAniso=0. */
  var sim = ENG.createSim(seed, scn({ kAniso: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['curv@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 방향성 결정화(E→R 쌍 거래 — 결정화/복제와 같은 경계)가 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, anisoGrown: sim.anisoGrown, pass: led.residual < 1e-6 };
}

/* ── det: kAniso on 같은 시드 2회 비트 동일(축 E→R 침착·태그 복사가 R·E·G 변경 → 해시에). crystal 아레나로 방향성 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, anisoArena()); seedGeneDisc(s); ENG.run(s, ARENA_T); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── aniso: 가설 — 방향성 결정화(genotype 이 *결정축*을 정함). crystal 아레나서 anisotropy on(kAniso=1) vs off(kAniso=0). ──
 *  ① 방향성 실활성: anisoGrown>0(선호 축 E→R 침착이 실제로 일어난다).
 *  ② 이방성 결정축: aniso(R 주축비)↑·on≫1(등방 blob 대신 한 축으로 자란 needle/결정축, off 씨앗은 ≈1).
 *  ③ *genotype 이 축을 정한다*(핵심 thesis — "방향성 결정화"의 창의 주장): tag1(선호 축=가로)은 axisX≫axisY, tag2(선호 축=세로)는 axisY≫axisX 로 *직교* — 같은 법칙·다른 태그가 다른 결정축.
 *     (tag1 만 보면 "다 가로로 자란다"와 구별 못 한다 — 직교 두 태그라야 *유전형이 축을 정함*이 증명된다.) 보존: anisotropy 는 E→R 쌍 거래라 잔차<1e-6. */
function anisoTest(seed) {
  var off = anisoRun(seed, 0, 1), onX = anisoRun(seed, 1, 1), onY = anisoRun(seed, 1, 2);
  var pass = onX.anisoGrown > 0                           // ① 방향성 실활성
    && onX.aniso > off.aniso && onX.aniso > 2.0           // ② 이방성↑(off 등방 씨앗 ≈1 대비)·또렷한 결정축
    && onX.axisX > onX.axisY                              // ③ tag1 → 가로 축(선호 축=x)
    && onY.axisY > onY.axisX                              // ③ tag2 → 세로 축(선호 축=y) — *genotype 이 축을 정한다*(thesis)
    && onX.residual < 1e-6;                               //   E→R 쌍 거래(보존)라 닫힌 장부
  return { seed: seed, anOff: off.aniso, anOn: onX.aniso, t1axX: onX.axisX, t1axY: onX.axisY, t2axX: onY.axisX, t2axY: onY.axisY, grown: onX.anisoGrown, residual: onX.residual, pass: pass };
}

/* ── sustain: 방향성 결정화(실제 E→R 재분배)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, anisoGrown: sim.anisoGrown, collapse: collapse };
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
    console.log('회귀 0: kAniso=0 step-0025 == step-0024 (방향성 결정화 스택 해시 == golden curv@, anisotropy 법칙 skip·R·E·G 불변).');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'anisoGrown', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (방향성 결정화는 선호 축 빈 이웃에 E→R 침착 — 결정화/복제와 같은 쌍 거래 경계 → 장부 식 불변). 전체 스택은 희소라 큰 결정 드물어 거의 안 켜짐(grown~' + avg(rc, 'anisoGrown').toFixed(0) + ') — *방향성 활성* 효과는 aniso 가 잰다.');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: crystal 아레나(방향성 활성) 같은 시드 2회 비트 동일(축 E→R 침착·태그 복사가 R·E·G 를 바꿔 해시에. 축은 태그의 결정 함수 — Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'aniso') {
    var rk = seeds.map(anisoTest); table(rk, ['seed', 'anOff', 'anOn', 't1axX', 't1axY', 't2axX', 't2axY', 'grown', 'residual', 'pass']);
    console.log('방향성 결정화(genotype 이 *결정축*을 정함): 이방성 지수(R 주축비) ' + avg(rk, 'anOff').toFixed(2) + '→' + avg(rk, 'anOn').toFixed(2) +
      ' (등방 씨앗 → 한 축 needle/결정축). *유전형이 축을 정한다*: tag1 축 분산 가로 ' + avg(rk, 't1axX').toFixed(0) + ' ≫ 세로 ' + avg(rk, 't1axY').toFixed(1) +
      ' · tag2 가로 ' + avg(rk, 't2axX').toFixed(1) + ' ≪ 세로 ' + avg(rk, 't2axY').toFixed(0) + ' (직교 — 같은 법칙·다른 태그가 다른 결정축). 방향성 성장 ' + avg(rk, 'grown').toFixed(0) +
      '. author 아닌 *측정/창발*(태그→축 국소 법칙만 깖 — 척추 체크 2). E→R 쌍 거래(보존)라 잔차 ' + avg(rk, 'residual').toExponential(2) + '.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'anisoGrown', 'collapse']);
    console.log('방향성 결정화 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(방향성 결정)이 동역학을 안 깬다(전체 스택은 희소라 거의 안 켜짐·E→R 쌍 거래·자기제한 게이트 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'aniso', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
