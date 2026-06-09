/* HWS step-0024 헤드리스 검증 — 곡률 기반 표면장력(tension: 막을 경계 곡률로 편향 → 액적의 E-형태가 둥글어진다. 형태 사다리 R2, INTERPRET §5).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 tension 법칙 1개(LAW_ORDER ⑥a2, adhere 뒤·couple 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0024/verify.js <reg|conserve|det|tension|sustain|all> [seed]
 *  - reg     : 회귀 0 — kTension=0 이면 step-0023 과 비트 동일(tension 통째 skip·E 불변). 표면장력 스택 해시를 golden anchor@ 와 대조.
 *  - conserve: 보존 — 곡률 표면장력(E 쌍 거래 — 볼록 경계→오목/속, 나간 만큼 들어옴)이 도는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kTension on 같은 시드 2회 비트 동일(곡률 E flux 가 E 를 바꿔 해시에. 순차 Gauss-Seidel — coordination·E 의 함수, Math.random 금지).
 *  - tension : 가설 — 곡률 표면장력(막에 Young-Laplace 압력). rounding 아레나(단일 클론 조밀 조직 + adhere·couple[R1 막] on, tension 만 on/off):
 *              표면장력이 *볼록 경계(coordination 낮음)의 E 를 오목/속(coordination 높음)으로* 민다 → 경계 E↓(convexE↓)·속 대비 비율↑(coreRatio=interiorE/convexE↑). 곡률은 author 아닌 *측정/창발*.
 *  - sustain : 곡률 표면장력(실제 E 재분배)이 step-0023 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0 — 쌍 거래라 동역학 직교).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0023 그대로(별·…·정착 생활사) + 곡률 표면장력(kTension 1).
 *   *전체 스택은 희소·이동성*이라 같은 태그 큰 액적(막)이 드물어 곡률 표면장력이 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 곡률 현상은 tension 의 *rounding 아레나*에서 잰다.
 * tension 은 *rounding 아레나*(준균일 고-E 장 + 단일 클론 조밀 조직·adhere·couple on — R1 막 위에서 tension 만 on/off 로 곡률을 격리)에서 Young-Laplace 압력 구배를 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(tension 법칙 포함)
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
var TENSION = { kTension: 1, tensionGamma: 0.10 };  // step-0024 신규 — 곡률 표면장력(전체 스택은 희소라 큰 막 드물어 거의 안 켜짐 — 현상은 rounding 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 정착 + 곡률 표면장력). extra 로 kTension=0 주면 step-0023 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, ANCHOR, TENSION, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* rounding 아레나 — 준균일 고-E 장(넓은 약-source). 이동·번식 off, 차등 응집 + 막 결합(R1) on. tension 만 on/off 로 *곡률을 격리*.
 * couple(R1)이 kin 끼리 E 를 균등화해 평탄한 막을 만들면, tension(R2)이 그 위에 Young-Laplace 곡률 구배를 얹어 *볼록 경계의 E 를 속으로* 민다(액적의 E-형태가 둥근 돔으로). */
function arena(extra) {
  return Object.assign({}, {
    initE: 2.0, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 44, rate: 0.02 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0,
    kL: 0.05, mMaint: 0.005, mDeath: 0.01, mSeed: 0.6, lifeR: 1,
    repro: false, mDiv: 999, divR: 1, popCap: 4096,
    move: false, moveR: 1, moveThresh: 0.02, pTumble: 0,
    kCrowd: 0, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0,
    kInherit: 0, inheritCost: 0,
    kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5,
    kMembrane: 0.5,
    kTension: 1, tensionGamma: 0.10
  }, extra || {});
}
var ARENA_T = 800;  // adhere 가 sorting 하고 couple+tension 이 막·곡률 평형에 들 때까지
/* 단일 클론(tag1) 16×16 조밀 조직 — adhere 로 정렬되고 couple 막이 깔린 위에서 tension 이 곡률 구배를 얹는다. */
function seedBlob(sim, tag) { var n = 0; for (var y = 24; y < 40; y++) for (var x = 24; x < 40; x++) { var a = ENG.spawnAgent(sim, x, y); a.g = tag; n++; } return n; }
/* rounding 아레나 1회 — kTension 을 주고 Young-Laplace 압력 구배 측정. */
function curvRun(seed, kt) {
  var sim = ENG.createSim(seed, arena({ kTension: kt })); seedBlob(sim, 1); ENG.run(sim, ARENA_T);
  var r = ENG.measureRoundness(sim), led = ENG.ledger(sim);
  return { convexE: r.convexE, interiorE: r.interiorE, coreRatio: r.coreRatio, coreCirc: r.coreCirc, footCirc: r.footCirc,
    tensionFlux: sim.tensionFlux, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kTension=0 → step-0023 비트 동일. golden anchor@ 해시(정착 스택, 표면장력 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden anchor@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kTension=0. */
  var sim = ENG.createSim(seed, scn({ kTension: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['anchor@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 곡률 표면장력(E 쌍 거래 — 볼록 경계→오목/속, 나간 만큼 들어옴)이 도는 내내 닫힌 장부. couple 과 같은 경계. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, tensionFlux: sim.tensionFlux, pass: led.residual < 1e-6 };
}

/* ── det: kTension on 같은 시드 2회 비트 동일(곡률 E flux 가 E 변경 → 해시에). rounding 아레나로 곡률 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, arena()); seedBlob(s, 1); ENG.run(s, ARENA_T); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if (a.agents[k].x !== b.agents[k].x || a.agents[k].y !== b.agents[k].y || (a.agents[k].g || 0) !== (b.agents[k].g || 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── tension: 가설 — 곡률 표면장력(막에 Young-Laplace 압력). rounding 아레나서 tension on(kTension=1) vs off(kTension=0). ──
 *  ① 곡률 실활성: tensionFlux>0(볼록→오목 E flux 가 실제로 일어난다).
 *  ② Young-Laplace 압력 구배: convexE↓(볼록 경계 — coordination 낮은 자리 — 의 E 가 속으로 밀려 식는다)·coreRatio=interiorE/convexE↑(속 대비 경계 비율↑ — 곡률 큰 경계의 E 가 빠져나간다 = 표면장력).
 *     보존: tension 은 E 쌍 거래(나간 만큼 들어옴)라 잔차<1e-6. */
function tensionTest(seed) {
  var off = curvRun(seed, 0), on = curvRun(seed, 1);
  var pass = on.tensionFlux > 0                          // ① 곡률 실활성
    && on.convexE < off.convexE                          // ② 볼록 경계 E↓(속으로 밀림 — Young-Laplace)
    && on.coreRatio > off.coreRatio                      //   속/경계 비율↑(곡률 큰 경계의 E 가 빠짐 = 표면장력)
    && on.residual < 1e-6;                               //   E 쌍 거래(보존)라 닫힌 장부
  return { seed: seed, cvOff: off.convexE, cvOn: on.convexE, inOff: off.interiorE, inOn: on.interiorE,
    crOff: off.coreRatio, crOn: on.coreRatio, ccOff: off.coreCirc, ccOn: on.coreCirc, flux: on.tensionFlux, residual: on.residual, pass: pass };
}

/* ── sustain: 곡률 표면장력(실제 E 재분배)이 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, tensionFlux: sim.tensionFlux, collapse: collapse };
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
    console.log('회귀 0: kTension=0 step-0024 == step-0023 (표면장력 스택 해시 == golden anchor@, tension 법칙 skip·E 불변).');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'tensionFlux', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (곡률 표면장력은 kin 4-쌍 E 거래 — 볼록→오목, 나간 만큼 들어옴 → 장부 식 불변, couple 과 같은 경계). 전체 스택은 희소라 큰 막 드물어 거의 안 켜짐(flux~' + avg(rc, 'tensionFlux').toFixed(0) + ') — *곡률 활성* 효과는 tension 이 잰다.');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: rounding 아레나(곡률 활성) 같은 시드 2회 비트 동일(곡률 E flux 가 E 를 바꿔 해시에. 순차 Gauss-Seidel — coordination·E 의 함수, Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'tension') {
    var rk = seeds.map(tensionTest); table(rk, ['seed', 'cvOff', 'cvOn', 'inOff', 'inOn', 'crOff', 'crOn', 'ccOff', 'ccOn', 'flux', 'residual', 'pass']);
    console.log('곡률 표면장력(막에 Young-Laplace 압력): 볼록 경계 E ' + avg(rk, 'cvOff').toFixed(2) + '→' + avg(rk, 'cvOn').toFixed(2) +
      ' (곡률 큰 경계의 E 가 속으로 밀려 식는다 = 표면장력)·속/경계 비율(coreRatio) ' + avg(rk, 'crOff').toFixed(3) + '→' + avg(rk, 'crOn').toFixed(3) +
      ' (속이 상대적으로 차오름). 고-E 핵 원형도 ' + avg(rk, 'ccOff').toFixed(3) + '→' + avg(rk, 'ccOn').toFixed(3) + '. 곡률 E flux ' + avg(rk, 'flux').toFixed(0) +
      '. 곡률은 author 아닌 *측정/창발*(kin coordination 국소 법칙만 깖 — 척추 체크 2). E 쌍 거래(보존)라 잔차 ' + avg(rk, 'residual').toExponential(2) + '.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'tensionFlux', 'collapse']);
    console.log('곡률 표면장력 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(곡률)이 동역학을 안 깬다(전체 스택은 희소라 거의 안 켜짐·E 쌍 거래 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'tension', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
