/* HWS step-0015 헤드리스 검증 — R-주형 자기복제(heredity: 유전의 씨앗, SPINE §다섯째 축).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 replicate 법칙 1개(LAW_ORDER ⑤d, 결정화 뒤). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0015/verify.js <reg|conserve|det|heredity|select|all> [seed]
 *  - reg     : 회귀 0 — kTemplate=0 이면 step-0014 와 비트 동일(replicate 통째 skip·G 미적분). 활성도 스택 해시를 golden flux@ 와 대조.
 *  - conserve: 보존 — 복제가 도는 내내 닫힌 장부 잔차 < 1e-6. 복제는 E→R 쌍 거래(G 태그는 거래 0 — 정보지 에너지 아님).
 *  - det     : 결정론 — kTemplate on 같은 시드 2회 비트 동일(E+R+에이전트+별+상태+활성도 A+*유전형 G*가 해시에).
 *  - heredity: 가설 (1) 유전 — 주형이 제 태그를 자식 R 로 *충실히 복사*(mu=0 → fidelity 1.00, 순수 클론 성장) ·
 *              (2) 변이 — 복제오류(mu>0)로 변종 태그 출현, 변이율 ≈ mu. *이산* 태그라 정보가 번지지 않고 보존된다(연속 필드 불가).
 *  - select  : 가설 (3) 선택 — 적합도 차(저적합 tag1 vs 고적합 tag4)에서 고적합이 더 많은 칸 점유(차등 번식=선택) ·
 *              (3b) 적응 — 저적합만 파종+변이 → 고적합 변종이 선택돼 *평균 적합도가 상승*(다윈 동역학: 변이+선택).
 *  - sustain : 복제(읽기 전용 아닌 *실제 변환*)가 step-0014 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0).
 *              유전형이 이미 도는 R 순환에 *올라타* substrate 를 잠그되 별·생명 동역학은 임계 자기조직을 유지하는가. 부수 검증.
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0014 그대로(외부 source off, 별 내생 구동 + 자기제한 + 연소 FSM + 활성도 계량) + R-주형 복제(kTemplate 1).
 * heredity/select 는 *통제 아레나*(균일 고-E 장, 별·생명·확산 off — 복제만)에서 유전·변이·선택을 격리해 측정한다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(replicate 법칙 포함)
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
var GENE = { kTemplate: 1, geneRate: 0.5, geneThresh: 0.3, geneMu: 0.01, geneTypes: 4, geneFit0: 0.5, geneFitStep: 0.15, geneClear: 0.05 };  // step-0015 신규 — R-주형 복제
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + 활성도 계량 + 복제). extra 로 kTemplate=0 주면 step-0014 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
/* 통제 아레나 — 균일 고-E 장, 복제만(별·생명·확산·증발·결정화 off). 유전·변이·선택을 격리해 측정. */
function ctrl(extra) {
  return Object.assign({}, GENE, {
    initE: 3.0, noise: 0.5, drive: false, kD: 0, kEvap: 0, kA: 0,
    life: false, repro: false, move: false, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kCrowd: 0, kFlux: 0
  }, extra || {});
}
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }   // golden gene@ 와 동일 씨앗(저적합 tag1·고적합 tag4)

/* 유전형 셈 — 태그별 칸 수 + 총 점유. */
function countTags(sim) {
  var G = sim.G, nG = sim.p.geneTypes, by = new Array(nG + 1).fill(0), total = 0;
  for (var i = 0; i < G.length; i++) { var g = G[i]; if (g !== 0) { by[g]++; total++; } }
  return { byTag: by, total: total };
}
/* 평균 적합도(점유 칸 가중) — fit(tag)=geneFit0+geneFitStep·(tag−1). */
function meanFit(sim) {
  var c = countTags(sim), p = sim.p, num = 0;
  for (var g = 1; g <= p.geneTypes; g++) num += c.byTag[g] * (p.geneFit0 + p.geneFitStep * (g - 1));
  return c.total ? num / c.total : 0;
}
function distinctTags(c) { var n = 0; for (var g = 1; g < c.byTag.length; g++) if (c.byTag[g] > 0) n++; return n; }

/* ── reg: kTemplate=0 → step-0014 비트 동일. golden flux@ 해시(활성도 스택, 복제 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden flux@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + run 3000, 전 스택 on·kTemplate=0(유전 씨앗 없음). */
  var sim = ENG.createSim(seed, scn({ kTemplate: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['flux@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 복제가 도는 내내 닫힌 장부. 복제는 E→R 쌍 거래(G 태그는 거래 0). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim), c = countTags(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, geneCells: c.total, geneReps: sim.geneReps, pop: sim.agents.length, pass: led.residual < 1e-6 };
}

/* ── det: kTemplate on 같은 시드 2회 비트 동일(유전형 필드 G 가 해시에). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, scn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); seedGenes(s); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── heredity: (1) 유전(충실 복제) + (2) 변이. 통제 아레나에서 한 유전형을 심고 클론 성장을 읽는다. ──
 *  A: mu=0 → 자식이 부모 태그를 *완벽히* 물려받음(fidelity=1.00, 순수 클론). *이산* 태그라 정보가 안 번진다(연속 필드 불가).
 *  B: mu>0 → 복제오류로 변종 태그 출현(distinct>1), 변이율 geneMut/geneReps ≈ mu. */
function heredityTest(seed) {
  /* A — 순수 유전(mu=0): 중앙에 tag 2 한 점 씨앗 → 클론 성장. */
  var a = ENG.createSim(seed, ctrl({ geneMu: 0 }));
  var seedCells = ENG.spawnGene(a, 32, 32, 2, 2, 1.0) > 0 ? ENG.discCells(W, H, 32, 32, 2).length : 0;
  ENG.run(a, 120);
  var ca = countTags(a), fidelity = ca.total ? ca.byTag[2] / ca.total : 0, grew = ca.total > seedCells;
  /* B — 변이(mu>0): 같은 씨앗 + 복제오류. */
  var b = ENG.createSim(seed, ctrl({ geneMu: 0.02 }));
  ENG.spawnGene(b, 32, 32, 2, 2, 1.0); ENG.run(b, 120);
  var cb = countTags(b), mutRate = b.geneReps ? b.geneMut / b.geneReps : 0, variants = distinctTags(cb);
  var pass = grew && fidelity === 1 && a.geneReps > 0 && variants > 1 && mutRate > 0.005 && mutRate < 0.05;
  return { seed: seed, cloneCells: ca.total, fidelity: fidelity, repsA: a.geneReps, variants: variants, mutRate: mutRate, pass: pass };
}

/* ── select: (3) 선택 + (3b) 적응. 통제 아레나. ──
 *  선택: 저적합 tag1(fit 0.50) vs 고적합 tag4(fit 0.95) 대칭 씨앗, mu=0 → 고적합이 더 많은 칸 점유(차등 번식). ratio>1.
 *  적응: 저적합 tag1 만 흩뿌리고 mu>0 → 고적합 변종이 선택돼 *평균 적합도 상승*(meanFit 상승 = 다윈 동역학). */
function selectTest(seed) {
  /* 선택 — 두 유전형 경쟁(mu=0). */
  var s = ENG.createSim(seed, ctrl({ geneMu: 0 }));
  ENG.spawnGene(s, 16, 32, 2, 1, 1.0); ENG.spawnGene(s, 48, 32, 2, 4, 1.0);
  ENG.run(s, 90);
  var cs = countTags(s), ratio = cs.byTag[1] > 0 ? cs.byTag[4] / cs.byTag[1] : 0;
  /* 적응 — 저적합만 파종 + 변이 → 평균 적합도 상승. */
  var a = ENG.createSim(seed, ctrl({ geneMu: 0.03 }));
  for (var gx = 8; gx < W; gx += 16) for (var gy = 8; gy < H; gy += 16) ENG.spawnGene(a, gx, gy, 0, 1, 1.0);   // tag1 격자 점 파종
  var fit0 = meanFit(a);
  ENG.run(a, 260);
  var fit1 = meanFit(a), rose = fit1 - fit0;
  var pass = cs.byTag[4] > 0 && cs.byTag[1] > 0 && ratio > 1.2 && rose > 0.05;
  return { seed: seed, hi4: cs.byTag[4], lo1: cs.byTag[1], ratio: ratio, fit0: fit0, fit1: fit1, rose: rose, pass: pass };
}

/* ── sustain: 복제(실제 변환)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, geneCells: countTags(sim).total, collapse: collapse };
  });
  var surv = rows.every(function (r) { return r.collapse < 0; });
  var churn = rows.every(function (r) { return r.lateBirths > 0 && r.lateDeaths > 0; });
  return { rows: rows, pass: surv && churn };
}

function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hash', 'golden', 'pass']);
    console.log('회귀 0: kTemplate=0 step-0015 == step-0014 (활성도 스택 해시 == golden flux@, replicate 법칙 skip·G 필드 미적분)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'geneCells', 'geneReps', 'pop', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (복제는 E→R 쌍 거래 — 결정화와 같은 경계. G 태그는 거래 0(정보지 에너지 아님). sumE+M+R+evap+sunk+metab−injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 비트 동일(유전형 필드 G 도 해시에 — 가법, kTemplate=0 면 flux@ 불변).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'heredity') {
    var rh = seeds.map(heredityTest); table(rh, ['seed', 'cloneCells', 'fidelity', 'repsA', 'variants', 'mutRate', 'pass']);
    console.log('(1) 유전: mu=0 → 자식이 부모 태그를 *완벽 복사*(fidelity=' + avg(rh, 'fidelity').toFixed(2) + ', 순수 클론 ' + avg(rh, 'cloneCells').toFixed(0) + '칸). *이산* 태그라 정보가 안 번진다(연속 필드 불가 — Schrödinger 비주기 결정).');
    console.log('(2) 변이: mu=0.02 → 복제오류로 변종 ' + avg(rh, 'variants').toFixed(0) + '종 출현, 변이율 ' + avg(rh, 'mutRate').toFixed(4) + ' ≈ mu(0.02). 유전+변이 = 다윈 동역학의 두 토대.');
    return rh.every(function (r) { return r.pass; });
  } else if (mode === 'select') {
    var rs = seeds.map(selectTest); table(rs, ['seed', 'hi4', 'lo1', 'ratio', 'fit0', 'fit1', 'rose', 'pass']);
    console.log('(3) 선택: 고적합 tag4(fit .95) vs 저적합 tag1(fit .50) 경쟁 → 고적합이 ' + avg(rs, 'ratio').toFixed(1) + '배 더 점유(차등 번식=선택, 기질 경쟁).');
    console.log('(3b) 적응: 저적합만 파종+변이 → 평균 적합도 ' + avg(rs, 'fit0').toFixed(2) + '→' + avg(rs, 'fit1').toFixed(2) + '(+' + avg(rs, 'rose').toFixed(2) + ') — 고적합 변종이 선택돼 *적응이 창발*(다윈 동역학).');
    return rs.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'geneCells', 'collapse']);
    console.log('복제 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 유전형이 도는 R 순환에 *올라타* substrate(' + avg(st.rows, 'geneCells').toFixed(0) + '칸)를 잠그되 임계 자기조직은 유지(별·생명 동역학 보존).');
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
