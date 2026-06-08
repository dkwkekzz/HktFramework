/* HWS step-0016 헤드리스 검증 — 생명 유전(inherit: genotype↔대사 결합, SPINE §다섯째 축 "유전↔생명 결합").
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 inherit 법칙 1개(LAW_ORDER ⑧b, 번식 뒤). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0016/verify.js <reg|conserve|det|heredity|select|sustain|all> [seed]
 *  - reg     : 회귀 0 — kInherit=0 이면 step-0015 와 비트 동일(inherit 통째 skip·a.g 미적분). 복제 스택 해시를 golden gene@ 와 대조.
 *  - conserve: 보존 — 생명 유전이 도는 내내 닫힌 장부 잔차 < 1e-6. 표현형세는 m→metabolized 쌍 거래(crowd 와 같은 소산 경계).
 *  - det     : 결정론 — kInherit on 같은 시드 2회 비트 동일(E+R+에이전트+별+상태+활성도 A+유전형 G+*생명 유전형 a.g* 가 해시에).
 *  - heredity: 가설 (1) 상속 — 분열 자식이 인접 부모의 유전형을 *충실히* 물려받음(mu=0 → fidelity 1.00, 순수 클론 계통) ·
 *              (2) 변이 — 복제오류(mu>0)로 변종 태그 출현, 변이율 ≈ mu. 유전이 *생명* 계통에 흐른다(R 위만이 아니라).
 *  - select  : 가설 (3) 선택 — 표현형세(저적합 더 냄)에서 고적합 생명이 더 많이 점유(차등 생존=선택, *생명 개체군에서*) ·
 *              (3b) 적응 — 저적합만 파종+변이 → 고적합 변종이 선택돼 *생명 평균 적합도가 상승*(다윈 동역학이 생명 위에서).
 *  - sustain : 생명 유전(표현형세=실제 대사 변환)이 step-0015 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0015 그대로(외부 source off, 별 내생 구동 + 자기제한 + 연소 FSM + 활성도 계량 + R-주형 복제) + 생명 유전(kInherit 1).
 * heredity/select 는 *통제 생명 아레나*(균일 고-E 장, 별·결정화·복제 off — 생명 번식+유전만)에서 상속·변이·선택을 격리해 측정한다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(inherit 법칙 포함)
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
var INHERIT = { kInherit: 1, inheritMu: 0.01, inheritCost: 0.02 };  // step-0016 신규 — 생명 유전(genotype↔대사 결합)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + 복제 + 생명 유전). extra 로 kInherit=0 주면 step-0015 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
/* 통제 생명 아레나 — 넓고 약한 E 원(준균일 재보급)으로 *지속 churn*(출생≈사망>0), 생명 번식+유전만(별·결정화·복제 off).
 * 자기제한(crowd)이 carrying capacity 를 만들어 그리드를 안 채우고 *연속 회전*시킨다 → 적합 유전형이 *지속* 치환(고정·동결 아님).
 * 표현형 결합을 *강하게*(inheritCost 0.25 — 전체 스택 기본 0.02 보다 큼) 줘 선택 신호를 spatial 잡음 위로 격리한다(step-0015 가 mu 를
 * 통제에서 달리 준 것과 같은 정신 — 통제 아레나는 깨끗한 격리 측정). source r=44(거의 전역)·약한 rate 라 준균일 장. */
function ctrl(extra) {
  return Object.assign({}, LIFE, REPRO, MOVE, INHERIT, {
    inheritCost: 0.25, initE: 1.0, noise: 0.3, drive: true,
    source: { x: 32, y: 32, r: 44, rate: 0.01 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0.04, kCrowd: 0.2, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0
  }, extra || {});
}
/* 통제 아레나에 두 유전형을 *교차*(준균일 혼합) 파종 — spatial 분리(founder 효과) 대신 cell 별 경쟁(깨끗한 경쟁 배제). */
function seedMix(sim, ta, tb) {
  for (var gy = 4; gy < H; gy += 4) for (var gx = 4; gx < W; gx += 4) {
    var a = ENG.spawnAgent(sim, gx, gy); a.g = ((gx / 4 + gy / 4) % 2) ? tb : ta;
  }
}
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }   // golden life@ 와 동일 R 씨앗(저적합 tag1·고적합 tag4)
/* 생명 유전형 씨앗 — (cx,cy) 반경 r 원판 격자에 태그 tag 생명을 심는다(a.g 직접 — 통제 아레나 부트스트랩 대체). */
function seedLifeGene(sim, cx, cy, r, tag) {
  var cells = ENG.discCells(W, H, cx, cy, r), n = 0;
  for (var k = 0; k < cells.length; k++) {
    var x = cells[k] % W, y = (cells[k] - x) / W, a = ENG.spawnAgent(sim, x, y);
    a.g = tag; n++;
  }
  return n;
}

/* 생명 유전형 셈 — 태그별 개체 수 + 총 유전형 생명 수. */
function countLifeTags(sim) {
  var ag = sim.agents, nG = sim.p.geneTypes, by = new Array(nG + 1).fill(0), total = 0;
  for (var i = 0; i < ag.length; i++) { var g = ag[i].g; if (g) { by[g]++; total++; } }
  return { byTag: by, total: total, pop: ag.length };
}
/* 생명 개체군 평균 적합도(유전형 생명 가중) — fit(tag)=geneFit0+geneFitStep·(tag−1). */
function meanLifeFit(sim) {
  var c = countLifeTags(sim), p = sim.p, num = 0;
  for (var g = 1; g <= p.geneTypes; g++) num += c.byTag[g] * (p.geneFit0 + p.geneFitStep * (g - 1));
  return c.total ? num / c.total : 0;
}
function distinctTags(c) { var n = 0; for (var g = 1; g < c.byTag.length; g++) if (c.byTag[g] > 0) n++; return n; }

/* ── reg: kInherit=0 → step-0015 비트 동일. golden gene@ 해시(복제 스택, 생명 유전 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden gene@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kInherit=0. */
  var sim = ENG.createSim(seed, scn({ kInherit: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['gene@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 생명 유전이 도는 내내 닫힌 장부. 표현형세는 m→metabolized 쌍 거래. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim), c = countLifeTags(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, lifeGenes: c.total, pop: c.pop, inheritMut: sim.inheritMut, pass: led.residual < 1e-6 };
}

/* ── det: kInherit on 같은 시드 2회 비트 동일(생명 유전형 a.g 가 해시에). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, scn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); seedGenes(s); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if ((a.agents[k].g || 0) !== (b.agents[k].g || 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── heredity: (1) 상속(충실 물림) + (2) 변이. 통제 생명 아레나에서 한 유전형 생명을 심고 클론 계통을 읽는다. ──
 *  A: mu=0 → 자식이 인접 부모 태그를 *완벽히* 물려받음(fidelity=1.00, 순수 클론 계통). 유전이 *생명* 계통에 흐른다.
 *  B: mu>0 → 복제오류로 변종 태그 출현(distinct>1), 변이율 inheritMut/(births−seed) ≈ mu. */
function heredityTest(seed) {
  /* A — 순수 상속(mu=0): 중앙에 tag 2 생명 클러스터 → 번식 계통. */
  var a = ENG.createSim(seed, ctrl({ inheritMu: 0 }));
  var seedN = seedLifeGene(a, 32, 32, 2, 2);
  ENG.run(a, 400);
  var ca = countLifeTags(a), fidelity = ca.total ? ca.byTag[2] / ca.total : 0, grew = a.births > 0;
  /* B — 변이(mu>0): 같은 씨앗 + 복제오류. */
  var b = ENG.createSim(seed, ctrl({ inheritMu: 0.02 }));
  seedLifeGene(b, 32, 32, 2, 2);
  ENG.run(b, 400);
  var cb = countLifeTags(b), bornB = b.births, mutRate = bornB ? b.inheritMut / bornB : 0, variants = distinctTags(cb);
  var pass = grew && fidelity === 1 && ca.total > seedN && variants > 1 && mutRate > 0.005 && mutRate < 0.05;
  return { seed: seed, cloneLives: ca.total, fidelity: fidelity, birthsA: a.births, variants: variants, mutRate: mutRate, pass: pass };
}

/* ── select: (3) 선택 + (3b) 적응. 통제 생명 아레나. ──
 *  선택: 저적합 tag1(fit 0.50) vs 고적합 tag4(fit 0.95) 분리 씨앗, mu=0 → 표현형세 차로 고적합이 더 많은 칸 점유(차등 생존). ratio>1.
 *  적응: 저적합 tag1 만 흩뿌리고 mu>0 → 고적합 변종이 선택돼 *생명 평균 적합도 상승*(다윈 동역학이 생명 위에서). */
function selectTest(seed) {
  /* 선택 — 두 유전형 생명을 *교차* 파종(준균일 혼합)해 cell 별 경쟁, mu=0 → 표현형세 차로 고적합이 저적합을 *지속 치환*. ratio>1. */
  var s = ENG.createSim(seed, ctrl({ inheritMu: 0 }));
  seedMix(s, 1, 4);
  ENG.run(s, 3000);
  var cs = countLifeTags(s), ratio = cs.byTag[1] > 0 ? cs.byTag[4] / cs.byTag[1] : (cs.byTag[4] > 0 ? Infinity : 0);
  /* 적응 — 저적합 tag1 만 파종 + 높은 변이(공급) → 고적합 변종이 선택돼 *생명 평균 적합도 상승*. churn 이 변종 침입을 허용. */
  var a = ENG.createSim(seed, ctrl({ inheritMu: 0.1 }));
  for (var gx = 4; gx < W; gx += 8) for (var gy = 4; gy < H; gy += 8) seedLifeGene(a, gx, gy, 1, 1);   // tag1 격자 파종(저적합)
  var fit0 = meanLifeFit(a);
  ENG.run(a, 6000);
  var fit1 = meanLifeFit(a), rose = fit1 - fit0;
  var pass = cs.byTag[4] > 0 && cs.byTag[1] > 0 && ratio > 1.2 && rose > 0.05;
  return { seed: seed, hi4: cs.byTag[4], lo1: cs.byTag[1], ratio: ratio, fit0: fit0, fit1: fit1, rose: rose, pass: pass };
}

/* ── sustain: 생명 유전(실제 대사 변환)이 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, lifeGenes: countLifeTags(sim).total, meanFit: meanLifeFit(sim), collapse: collapse };
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
    console.log('회귀 0: kInherit=0 step-0016 == step-0015 (복제 스택 해시 == golden gene@, inherit 법칙 skip·a.g 미적분)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'lifeGenes', 'pop', 'inheritMut', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (표현형세는 m→metabolized 쌍 거래 — crowd 와 같은 소산 경계. sumE+M+R+evap+sunk+metab−injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 비트 동일(생명 유전형 a.g 도 해시에 — 가법, kInherit=0 면 gene@ 불변).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'heredity') {
    var rh = seeds.map(heredityTest); table(rh, ['seed', 'cloneLives', 'fidelity', 'birthsA', 'variants', 'mutRate', 'pass']);
    console.log('(1) 상속: mu=0 → 자식이 인접 부모 태그를 *충실히* 물려받음(fidelity=' + avg(rh, 'fidelity').toFixed(2) + ', 순수 클론 계통 ' + avg(rh, 'cloneLives').toFixed(0) + '개체). 유전이 *생명* 계통에 흐른다(R 위만이 아니라).');
    console.log('(2) 변이: mu=0.02 → 복제오류로 변종 ' + avg(rh, 'variants').toFixed(0) + '종 출현, 변이율 ' + avg(rh, 'mutRate').toFixed(4) + ' ≈ mu(0.02). 상속+변이 = 다윈 동역학의 두 토대(이제 생명 위에서).');
    return rh.every(function (r) { return r.pass; });
  } else if (mode === 'select') {
    var rs = seeds.map(selectTest); table(rs, ['seed', 'hi4', 'lo1', 'ratio', 'fit0', 'fit1', 'rose', 'pass']);
    console.log('(3) 선택: 고적합 tag4(fit .95) vs 저적합 tag1(fit .50) 생명 경쟁 → 고적합이 ' + avg(rs, 'ratio').toFixed(1) + '배 더 점유(차등 생존=선택, *생명 개체군에서* 표현형세).');
    console.log('(3b) 적응: 저적합만 파종+변이 → 생명 평균 적합도 ' + avg(rs, 'fit0').toFixed(2) + '→' + avg(rs, 'fit1').toFixed(2) + '(+' + avg(rs, 'rose').toFixed(2) + ') — 고적합 변종이 선택돼 *생명이 적응*(다윈 동역학이 생명 위에서).');
    return rs.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'lifeGenes', 'meanFit', 'collapse']);
    console.log('생명 유전 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 생명이 R-genotype 에서 부트스트랩(' + avg(st.rows, 'lifeGenes').toFixed(0) + '개체)·표현형세를 내되 임계 자기조직 유지(별·생명 동역학 보존).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'heredity', 'select', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
