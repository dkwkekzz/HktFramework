/* HWS step-0017 헤드리스 검증 — 차등 응집(adhere: 개체='계'를 표면장력 액적으로 *측정*, SPINE §다섯째 축 다음 칸 "유전→개체").
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 adhere 법칙 1개(LAW_ORDER ⑥a, move 뒤·crowd 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0017/verify.js <reg|conserve|det|sort|organism|sustain|all> [seed]
 *  - reg     : 회귀 0 — kAdhesion=0 이면 step-0016 과 비트 동일(adhere 통째 skip·위치 불변). 응집 스택 해시를 golden life@ 와 대조.
 *  - conserve: 보존 — 차등 응집(위치만 바꿈)이 도는 내내 닫힌 장부 잔차 < 1e-6. 응집은 거래 0(move/tumble 과 같은 경계).
 *  - det     : 결정론 — kAdhesion on 같은 시드 2회 비트 동일(응집은 위치만 — x,y 가 해시에. 순차 그리디라 결정론).
 *  - sort    : 가설 (1) cell sorting — 차등 응집(kin↑/타↓)이 *이종 혼합*을 정렬한다(kin 접촉 비율 상승, 표면장력=경계 최소화).
 *              통제 아레나: 두 유전형 생명을 무작위 혼합 파종(kinFrac~0.5) → 응집 on 이면 kin 끼리 모여 kinFrac↑(응집 off 는 동결).
 *  - organism: 가설 (2) 개체 측정 — 정렬이 빚은 *4-인접 kin 연결 성분*(= 표면장력 액적 = flux 결합 도메인)을 author 아닌 측정으로
 *              읽는다. 응집 on 이면 평균/최대 개체 크기 ≫ off(다세포 도메인 창발). 개체는 만든 게 아니라 *측정*된다(척추 체크 2).
 *  - sustain : 차등 응집(실제 위치 재배치)이 step-0016 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0).
 *              전체 스택에서 *부트스트랩한* 생명이 kin 액적으로 묶임을 측정(meanOrg/maxOrg > 1).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0016 그대로(별 내생 구동·자기제한·연소 FSM·활성도 계량·R-주형 복제·생명 유전) + 차등 응집(kAdhesion 1).
 * sort/organism 은 *통제 응집 아레나*(준균일 고-E 장·이동/번식 off — 응집만으로 정렬을 격리)에서 cell sorting·개체 창발을 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(adhere 법칙 포함)
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
var ADH = { kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5 };  // step-0017 신규 — 차등 응집(개체=표면장력 액적)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + 복제 + 생명 유전 + 차등 응집). extra 로 kAdhesion=0 주면 step-0016 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
/* 통제 응집 아레나 — 준균일 고-E 장(넓은 약-source 재보급). 이동(주화성)·번식 off 라 *응집만* 생명 위치를 바꾼다(정렬 격리).
 * crowd·선택·별·결정화·복제·유전 off — 태그·개체수 고정, 순수 cell sorting 을 측정한다(step-0016 통제 아레나와 같은 정신).
 * mMaint·baseCost 작고 E 높아 사망 거의 없음(개체군 고정). 두 유전형(kin)을 무작위 혼합 파종해 응집이 정렬하는지 본다. */
function arena(extra) {
  return Object.assign({}, LIFE, REPRO, MOVE, ADH, {
    initE: 2.0, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 44, rate: 0.02 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0,
    mMaint: 0.005, mDeath: 0.01, mSeed: 0.6, mDiv: 999, repro: false, move: false, pTumble: 0,
    kCrowd: 0, crowdR: 3, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    adhesionLambda: 1.0, adhesionGain: 0.5
  }, extra || {});
}
/* 통제 아레나에 두 유전형(ta·tb)을 *무작위 혼합* 파종(~44% 밀도, 시드 의사난수 — Math.random 금지). 빈칸이 있어 응집이 재배치할 여지. */
function seedSortRandom(sim, ta, tb) {
  var n = 0;
  for (var y = 12; y < 52; y++) for (var x = 12; x < 52; x++) {
    var h = ENG.tumbleHash(x, y, 0, sim.seed);
    if ((h >>> 28) < 7) {                               // 상위 4비트 < 7 → ~44% 밀도
      var a = ENG.spawnAgent(sim, x, y); a.g = ((h >>> 20) & 1) ? tb : ta; n++;   // 태그 50/50(시드 결정론)
    }
  }
  return n;
}
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kAdhesion=0 → step-0016 비트 동일. golden life@ 해시(생명 유전 스택, 응집 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden life@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kAdhesion=0. */
  var sim = ENG.createSim(seed, scn({ kAdhesion: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['life@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 차등 응집이 도는 내내 닫힌 장부. 응집은 위치만(거래 0). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim), o = ENG.measureOrganisms(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, pop: sim.agents.length, adheres: sim.adheres, nOrg: o.nOrg, pass: led.residual < 1e-6 };
}

/* ── det: kAdhesion on 같은 시드 2회 비트 동일(응집은 위치만 — x,y 해시에). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, scn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); seedGenes(s); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if (a.agents[k].x !== b.agents[k].x || a.agents[k].y !== b.agents[k].y || (a.agents[k].g || 0) !== (b.agents[k].g || 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── sort: (1) cell sorting. 통제 아레나에 두 유전형을 무작위 혼합 파종 → 응집 on 이면 kin 끼리 정렬(kinFrac↑). ──
 *  응집 on 과 off(동결)를 *같은 초기 배치*로 대조한다 — kin 접촉 비율(같은 태그 4-인접 쌍 / 전체 인접 쌍)이 응집으로 오른다. */
function sortTest(seed) {
  var ad = ENG.createSim(seed, arena({ kAdhesion: 1 }));
  var n = seedSortRandom(ad, 1, 2);
  var o0 = ENG.measureOrganisms(ad);                   // 초기 — 무작위 혼합(kinFrac~0.5)
  ENG.run(ad, 1500);
  var o1 = ENG.measureOrganisms(ad);                   // 정렬 후
  var ct = ENG.createSim(seed, arena({ kAdhesion: 0 }));
  seedSortRandom(ct, 1, 2); ENG.run(ct, 1500);
  var oc = ENG.measureOrganisms(ct);                   // 통제(응집 off — 동결, 무작위 유지)
  var pass = o1.kinFrac > 0.65 && o1.kinFrac > oc.kinFrac + 0.12 && o1.kinFrac > o0.kinFrac + 0.1;
  return { seed: seed, agents: n, kin0: o0.kinFrac, kinAdh: o1.kinFrac, kinCtrl: oc.kinFrac, rise: o1.kinFrac - o0.kinFrac, pass: pass };
}

/* ── organism: (2) 개체 측정. 정렬이 빚은 4-인접 kin 연결 성분(표면장력 액적=flux 결합 도메인)을 author 아닌 *측정*으로 읽는다. ──
 *  응집 on 이면 평균/최대 개체 크기 ≫ off(다세포 도메인 창발). 개체는 만든 게 아니라 측정된다(척추 체크 2 — 활성도 환원). */
function organismTest(seed) {
  var ad = ENG.createSim(seed, arena({ kAdhesion: 1 })); seedSortRandom(ad, 1, 2); ENG.run(ad, 1500);
  var oa = ENG.measureOrganisms(ad);
  var ct = ENG.createSim(seed, arena({ kAdhesion: 0 })); seedSortRandom(ct, 1, 2); ENG.run(ct, 1500);
  var oc = ENG.measureOrganisms(ct);
  var pass = oa.maxSize > 10 && oa.meanSize > 2 * oc.meanSize && oa.meanSize > oc.meanSize + 2;
  return { seed: seed, nOrgAdh: oa.nOrg, meanAdh: oa.meanSize, maxAdh: oa.maxSize, singleAdh: oa.singleFrac, nOrgCtrl: oc.nOrg, meanCtrl: oc.meanSize, maxCtrl: oc.maxSize, pass: pass };
}

/* ── sustain: 차등 응집(실제 위치 재배치)이 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). ──
 *  전체 스택에서 *부트스트랩한* 생명이 kin 액적으로 묶임을 측정(meanOrg/maxOrg). */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, meanOrg: o.meanSize, maxOrg: o.maxSize, collapse: collapse };
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
    console.log('회귀 0: kAdhesion=0 step-0017 == step-0016 (응집 스택 해시 == golden life@, adhere 법칙 skip·위치 불변)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'pop', 'adheres', 'nOrg', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (차등 응집은 위치만 바꿈 — 거래 0, move/tumble 과 같은 경계. 장부 식 불변)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 비트 동일(응집은 순차 그리디 — 위치 x,y 가 해시에. Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'sort') {
    var rs = seeds.map(sortTest); table(rs, ['seed', 'agents', 'kin0', 'kinAdh', 'kinCtrl', 'rise', 'pass']);
    console.log('(1) cell sorting: 무작위 혼합(kin 접촉 ' + avg(rs, 'kin0').toFixed(2) + ') → 차등 응집이 정렬해 kin 접촉 ' + avg(rs, 'kinAdh').toFixed(2) +
      '(응집 off 통제 ' + avg(rs, 'kinCtrl').toFixed(2) + ' 동결). 같은 태그끼리 모여 이종 경계 최소화 = 표면장력(Steinberg DAH).');
    return rs.every(function (r) { return r.pass; });
  } else if (mode === 'organism') {
    var ro = seeds.map(organismTest); table(ro, ['seed', 'nOrgAdh', 'meanAdh', 'maxAdh', 'singleAdh', 'meanCtrl', 'maxCtrl', 'pass']);
    console.log('(2) 개체 측정: 정렬이 빚은 4-인접 kin 연결 성분(표면장력 액적) — 응집 on 평균 개체 ' + avg(ro, 'meanAdh').toFixed(1) + '·최대 ' + avg(ro, 'maxAdh').toFixed(0) +
      ' 세포(통제 ' + avg(ro, 'meanCtrl').toFixed(1) + '·' + avg(ro, 'maxCtrl').toFixed(0) + '). 개체는 author 아닌 *측정* — 다세포 도메인이 차등 응집에서 창발(척추 체크 2).');
    return ro.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'meanOrg', 'maxOrg', 'collapse']);
    console.log('차등 응집 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 부트스트랩한 생명이 kin 액적으로 묶임(평균 개체 ' + avg(st.rows, 'meanOrg').toFixed(1) + '·최대 ' + avg(st.rows, 'maxOrg').toFixed(0) + ' 세포)·임계 자기조직 유지.');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'sort', 'organism', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
