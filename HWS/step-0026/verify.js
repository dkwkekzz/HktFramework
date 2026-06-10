/* HWS step-0026 헤드리스 검증 — 가지치기·덴드라이트(branch: 곧은 needle 의 옆면 불안정 → 수직 측면 가지. 형태 사다리 R4, R 하이트필드).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 branch 법칙 1개(LAW_ORDER ⑤f, anisotropy 뒤·combust 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0026/verify.js <reg|conserve|det|branch|sustain|all> [seed]
 *  - reg     : 회귀 0 — kBranch=0 이면 step-0025 와 비트 동일(branch 통째 skip·R·E·G 불변). 가지치기 스택 해시를 golden aniso@ 와 대조.
 *  - conserve: 보존 — 가지치기(E→R 쌍 거래 — 결정화/복제/방향성과 같은 경계)가 도는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kBranch on 같은 시드 2회 비트 동일(고정 기둥 수직 E→R 침착·태그 복사가 R·E·G 를 바꿔 해시에. 기둥은 위치의 결정 함수, Math.random 금지).
 *  - branch  : 가설 — 가지치기(곧은 needle → 측면 가지 덴드라이트). needle 아레나(가로 R needle 씨앗·방향성 off, branch 만 on/off):
 *              branch on 이면 needle 의 *수직*으로 고정 간격 측면 톱니가 자라 perpExtent(수직 폭)↑·branchCells↑ → 곧은 needle(off: perp 0·가지 0)이 *분기 구조*로. 단 *덴드라이트*(이방성>1, 줄기가 줄대로 — 둥근 blob 아님). E→R 쌍 거래라 잔차<1e-6.
 *  - sustain : 가지치기(실제 E→R 재분배)가 step-0025 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0 — E→R 쌍 거래·자기제한 게이트라 동역학 직교).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0025 그대로(별·…·방향성 결정화) + 가지치기(kBranch 1).
 *   *전체 스택은 희소·이동성*이라 큰 유전형 결정이 드물어 가지가 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 가지 현상은 branch 의 *needle 아레나*에서 잰다.
 *   정직한 한계: 전체 스택(방향성+가지 동시·균일 풍부 기질)에선 anisotropy 가 가지 씨앗을 주축으로 재성장시키는 cascade 가 형태를 *채운다*(슬래브) — 진짜 덴드라이트는 *확산-제한* 기질이 필요(needle 아레나는 방향성을 얼려 가지를 격리해 깨끗한 톱니를 보인다).
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(branch 법칙 포함)
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
var BRANCH = { kBranch: 1, branchRate: 0.3, branchThresh: 0.2, branchSpacing: 4 };  // step-0026 신규 — 가지치기(전체 스택은 희소라 큰 결정 드물어 거의 안 켜짐 — 현상은 needle 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 방향성 결정화 + 가지치기). extra 로 kBranch=0 주면 step-0025 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, ANCHOR, TENSION, ANISO, BRANCH, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* needle 아레나 — 균일 E 장에 *가로 R needle 씨앗*(tag1, y=32·x=22..42) 하나. 방향성 off(needle 얼림), 다른 법칙 다 off, branch 만 on/off 로 *가지를 격리*.
 * kBranch=1 이면 needle 의 *수직*으로 고정 간격(branchSpacing) 측면 톱니가 자라 덴드라이트(분기), off 면 needle 그대로(가지 0). kD=0·drive off 라 E 가 제자리(결정론·장부 단순). */
function branchArena(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0,
    geneTypes: 4, kAniso: 0, kBranch: 1, branchRate: 0.3, branchThresh: 0.2, branchSpacing: 4
  }, extra || {});
}
var ARENA_T = 20;   // 톱니가 격자 wrap 전에 또렷한 분기에 들 만큼(20 tick → 축당 ~20 칸, 중심 32±20 ∈ [12,52] 안전).
/* 가로 R needle 씨앗(tag1, 1-셀 두께) — branch 가 *그 needle 의 수직*으로 고정 기둥 측면 톱니를 친다. */
function seedNeedle(sim) { for (var x = 22; x <= 42; x++) ENG.spawnGene(sim, x, 32, 0, 1, 1.0); }
/* needle 아레나 1회 — kBranch 를 주고 R 하이트필드 분기 측정. */
function branchRun(seed, kb) {
  var sim = ENG.createSim(seed, branchArena({ kBranch: kb })); seedNeedle(sim); ENG.run(sim, ARENA_T);
  var b = ENG.measureBranching(sim), a = ENG.measureAnisotropy(sim), led = ENG.ledger(sim);
  return { cells: b.cells, branchCells: b.branchCells, perpExtent: b.perpExtent, aniso: a.aniso, branchGrown: sim.branchGrown, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kBranch=0 → step-0025 비트 동일. golden aniso@ 해시(방향성 결정화 스택, 가지치기 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden aniso@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kBranch=0. */
  var sim = ENG.createSim(seed, scn({ kBranch: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['aniso@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 가지치기(E→R 쌍 거래 — 결정화/복제/방향성과 같은 경계)가 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, branchGrown: sim.branchGrown, pass: led.residual < 1e-6 };
}

/* ── det: kBranch on 같은 시드 2회 비트 동일(고정 기둥 수직 E→R 침착·태그 복사가 R·E·G 변경 → 해시에). needle 아레나로 가지 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, branchArena()); seedNeedle(s); ENG.run(s, ARENA_T); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── branch: 가설 — 가지치기(곧은 needle → 측면 가지 덴드라이트). needle 아레나서 branch on(kBranch=1) vs off(kBranch=0). ──
 *  ① 가지 실활성: branchGrown>0(고정 기둥 수직 E→R 침착이 실제로 일어난다).
 *  ② 수직 분기: perpExtent(주축 중심선 대비 수직 폭)↑·on≫off(off 곧은 needle perp≈0 → on 측면 톱니가 수직으로 뻗음)·branchCells↑(수직 같은 태그 이웃 — off 단일 줄 needle 은 0).
 *  ③ *덴드라이트지 blob 아님*(핵심 thesis — "가지치기"의 창의 주장): 가지 친 뒤에도 이방성>1(주줄기가 줄대로 — 둥근 등방 blob 이 아니라 *분기한 결정*). off 곧은 needle(이방성 무한)에서 *측면 가지 분화*. 보존: branch 는 E→R 쌍 거래라 잔차<1e-6. */
function branchTest(seed) {
  var off = branchRun(seed, 0), on = branchRun(seed, 1);
  var pass = on.branchGrown > 0                            // ① 가지 실활성
    && on.perpExtent >= 5 && off.perpExtent < 1            // ② 수직 분기(off 곧은 needle perp≈0 → on 측면 톱니)
    && on.branchCells >= 20 && off.branchCells === 0       // ② 수직 분기 셀(off 단일 줄 needle 은 0)
    && on.cells > off.cells                                //   가지로 결정이 자랐다(더 많은 R)
    && isFinite(on.aniso) && on.aniso > 1.3                // ③ 덴드라이트(주줄기 줄대로 — 둥근 blob 아님)
    && on.residual < 1e-6;                                 //   E→R 쌍 거래(보존)라 닫힌 장부
  return { seed: seed, offBc: off.branchCells, onBc: on.branchCells, offPerp: off.perpExtent, onPerp: on.perpExtent, aniso: on.aniso, cells: on.cells, grown: on.branchGrown, residual: on.residual, pass: pass };
}

/* ── sustain: 가지치기(실제 E→R 재분배)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, branchGrown: sim.branchGrown, collapse: collapse };
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
    console.log('회귀 0: kBranch=0 step-0026 == step-0025 (가지치기 스택 해시 == golden aniso@, branch 법칙 skip·R·E·G 불변).');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'branchGrown', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (가지치기는 고정 기둥 수직 빈 이웃에 E→R 침착 — 결정화/복제/방향성과 같은 쌍 거래 경계 → 장부 식 불변). 전체 스택은 희소라 큰 결정 드물어 거의 안 켜짐(grown~' + avg(rc, 'branchGrown').toFixed(0) + ') — *가지 활성* 효과는 branch 가 잰다.');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: needle 아레나(가지 활성) 같은 시드 2회 비트 동일(고정 기둥 수직 E→R 침착·태그 복사가 R·E·G 를 바꿔 해시에. 기둥은 위치의 결정 함수 — Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'branch') {
    var rk = seeds.map(branchTest); table(rk, ['seed', 'offBc', 'onBc', 'offPerp', 'onPerp', 'aniso', 'cells', 'grown', 'residual', 'pass']);
    console.log('가지치기(곧은 needle → 측면 가지 덴드라이트): 수직 폭(perpExtent) ' + avg(rk, 'offPerp').toFixed(1) + '→' + avg(rk, 'onPerp').toFixed(1) +
      ' (곧은 needle → 수직 측면 톱니)·수직 분기 셀 ' + avg(rk, 'offBc').toFixed(0) + '→' + avg(rk, 'onBc').toFixed(0) +
      ' (off 단일 줄 needle 0 → on 분기). 덴드라이트지 blob 아님: 이방성 ' + avg(rk, 'aniso').toFixed(1) + '>1(주줄기 줄대로). 가지 성장 ' + avg(rk, 'grown').toFixed(0) +
      '. author 아닌 *측정/창발*(태그→수직 축·고정 기둥 국소 법칙만 깖 — 척추 체크 2). E→R 쌍 거래(보존)라 잔차 ' + avg(rk, 'residual').toExponential(2) + '.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'branchGrown', 'collapse']);
    console.log('가지치기 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(가지치기)이 동역학을 안 깬다(전체 스택은 희소라 거의 안 켜짐·E→R 쌍 거래·자기제한 게이트 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'branch', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
