/* HWS step-0018 헤드리스 검증 — 막/flux 결합 도메인(couple: 개체='계'를 측정 윤곽에서 *물리적 도메인*으로, SPINE 주요 전이 사다리 "다세포=flux 결합 도메인").
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 couple 법칙 1개(LAW_ORDER ⑥c, adhere 뒤·crowd 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0018/verify.js <reg|conserve|det|membrane|sustain|all> [seed]
 *  - reg     : 회귀 0 — kMembrane=0 이면 step-0017 과 비트 동일(couple 통째 skip·E 불변). 막 결합 스택 해시를 golden org@ 와 대조.
 *  - conserve: 보존 — 막 결합(kin E 공유)이 도는 내내 닫힌 장부 잔차 < 1e-6. 공유는 쌍 거래(균등화 — 나간 만큼 들어옴).
 *  - det     : 결정론 — kMembrane on 같은 시드 2회 비트 동일(공유는 E 재분배 — E 가 해시에. 순차 Gauss-Seidel 라 결정론).
 *  - membrane: 가설 — 막/flux 결합. kin 끼리 E 를 공유하면 액적 *내부* E 가 균질해지고(interior↓) *경계*엔 단차(막)가 창발(index=boundary/interior↑).
 *              통제 응집 아레나(같은 액적 — adhere 로 정렬, kMembrane 만 on/off): 공유 on 이면 막 지수↑·내부 분산↓(공유 off 통제 ≈구조 없음).
 *  - sustain : 막 결합(실제 E 재분배)이 step-0017 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0).
 *              전체 스택에서 부트스트랩한 생명이 kin 액적으로 묶이고 그 안에서 E 를 공유함을 측정(coupled>0·막 지수).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0017 그대로(별 내생 구동·자기제한·연소 FSM·활성도 계량·복제·생명 유전·차등 응집) + 막/flux 결합(kMembrane 0.5).
 * membrane 은 *통제 응집 아레나*(준균일 고-E 장·이동/번식 off — adhere 로 액적을 빚고 couple 만 on/off 로 막을 격리)에서 막 창발을 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(couple 법칙 포함)
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
var MEM = { kMembrane: 0.5 };  // step-0018 신규 — 막/flux 결합(개체=측정 윤곽 → 물리적 flux 결합 도메인)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + 복제 + 생명 유전 + 차등 응집 + 막 결합). extra 로 kMembrane=0 주면 step-0017 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
/* 통제 응집 아레나 — 준균일 고-E 장(넓은 약-source). 이동·번식 off, 차등 응집 on(액적을 빚는다). couple 만 on/off 로 *막을 격리*.
 * 생명은 흡수(kL)로 제 칸 E 를 깎는다 — 막 결합이 없으면 셀마다 따로 고갈(내부 분산↑), 있으면 kin 끼리 공유(내부 균질·경계 단차). */
function arena(extra) {
  return Object.assign({}, LIFE, REPRO, MOVE, ADH, {
    initE: 2.0, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 44, rate: 0.02 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0,
    mMaint: 0.005, mDeath: 0.01, mSeed: 0.6, mDiv: 999, repro: false, move: false, pTumble: 0,
    kCrowd: 0, crowdR: 3, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    adhesionLambda: 1.0, adhesionGain: 0.5, kMembrane: 0
  }, extra || {});
}
/* 통제 아레나에 두 유전형(ta·tb)을 *무작위 혼합* 파종(~44% 밀도, 시드 의사난수 — Math.random 금지). step-0017 sort 와 동일. */
function seedSortRandom(sim, ta, tb) {
  var n = 0;
  for (var y = 12; y < 52; y++) for (var x = 12; x < 52; x++) {
    var h = ENG.tumbleHash(x, y, 0, sim.seed);
    if ((h >>> 28) < 7) {                               // 상위 4비트 < 7 → ~44% 밀도
      var a = ENG.spawnAgent(sim, x, y); a.g = ((h >>> 20) & 1) ? tb : ta; n++;
    }
  }
  return n;
}
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kMembrane=0 → step-0017 비트 동일. golden org@ 해시(차등 응집 스택, 막 결합 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden org@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kMembrane=0. */
  var sim = ENG.createSim(seed, scn({ kMembrane: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['org@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 막 결합(kin E 공유)이 도는 내내 닫힌 장부. 공유는 쌍 거래(균등화). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim), m = ENG.measureMembrane(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, pop: sim.agents.length, coupled: sim.coupled, memIdx: m.index, pass: led.residual < 1e-6 };
}

/* ── det: kMembrane on 같은 시드 2회 비트 동일(공유는 E 재분배 — E 가 해시에). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, scn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); seedGenes(s); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if (a.agents[k].x !== b.agents[k].x || a.agents[k].y !== b.agents[k].y || (a.agents[k].g || 0) !== (b.agents[k].g || 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── membrane: 가설 — 막/flux 결합. 같은 액적(adhere 로 정렬)에 couple 만 on/off. ──
 *  공유 on 이면 액적 *내부* E 가 균질해지고(interior |ΔE|↓·intraVar↓) *경계*엔 단차(막)가 창발(index=boundary/interior↑).
 *  공유 off(통제)는 같은 액적이되 셀마다 따로 고갈 — 내부/경계 대비가 없다(index≈1, 막 없음). 막은 author 아닌 *측정/창발*. */
function membraneTest(seed) {
  var cp = ENG.createSim(seed, arena({ kMembrane: 0.5 })); seedSortRandom(cp, 1, 2); ENG.run(cp, 1500);
  var ma = ENG.measureMembrane(cp);                    // 막 결합 on
  var ct = ENG.createSim(seed, arena({ kMembrane: 0 })); seedSortRandom(ct, 1, 2); ENG.run(ct, 1500);
  var mc = ENG.measureMembrane(ct);                    // 통제(공유 off — 같은 액적, 막 없음)
  var pass = ma.index > 1.5 && ma.index > mc.index + 0.5 && ma.interior < mc.interior && ma.intraVar < mc.intraVar;
  return { seed: seed, intCp: ma.interior, bndCp: ma.boundary, idxCp: ma.index, varCp: ma.intraVar, intCtrl: mc.interior, idxCtrl: mc.index, varCtrl: mc.intraVar, pass: pass };
}

/* ── sustain: 막 결합(실제 E 재분배)이 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). ──
 *  전체 스택에서 부트스트랩한 생명이 kin 액적으로 묶이고 그 안에서 E 를 공유(coupled>0). */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim), m = ENG.measureMembrane(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, coupled: sim.coupled, memIdx: m.index, collapse: collapse };
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
    console.log('회귀 0: kMembrane=0 step-0018 == step-0017 (막 결합 스택 해시 == golden org@, couple 법칙 skip·E 불변)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'pop', 'coupled', 'memIdx', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (막 결합은 kin 쌍 E 균등화 — 나간 만큼 들어옴, 거래 0. 장부 식 불변). 누적 공유 flux ~' + avg(rc, 'coupled').toFixed(0) + '·막 지수 ~' + avg(rc, 'memIdx').toFixed(2));
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 비트 동일(막 결합은 순차 Gauss-Seidel — E 재분배가 해시에. Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'membrane') {
    var rm = seeds.map(membraneTest); table(rm, ['seed', 'intCp', 'bndCp', 'idxCp', 'varCp', 'intCtrl', 'idxCtrl', 'varCtrl', 'pass']);
    console.log('막/flux 결합: 같은 액적에 공유 on → 내부 |ΔE| ' + avg(rm, 'intCtrl').toFixed(3) + '→' + avg(rm, 'intCp').toFixed(3) + '(균질화)·막 지수(경계/내부) ' +
      avg(rm, 'idxCtrl').toFixed(2) + '→' + avg(rm, 'idxCp').toFixed(2) + '(막 창발). 내부 분산 ' + avg(rm, 'varCtrl').toFixed(3) + '→' + avg(rm, 'varCp').toFixed(3) +
      '. 막은 author 아닌 *측정/창발*(kin E 공유 국소 법칙만 깖 — 척추 체크 2).');
    return rm.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'coupled', 'memIdx', 'collapse']);
    console.log('막 결합 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 부트스트랩한 생명이 kin 액적으로 묶여 E 를 공유(누적 ~' + avg(st.rows, 'coupled').toFixed(0) + ')·임계 자기조직 유지.');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'membrane', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
