/* HWS step-0019 헤드리스 검증 — 개체↔대사 차등 결합(share: kin 생물량 m 공유 → 개체 단위 생존 → kin selection 선택압, SPINE §다섯째 축 "개체를 중립에서 적응으로").
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 share 법칙 1개(LAW_ORDER ⑥d, crowd 뒤·생명 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0019/verify.js <reg|conserve|det|kin|sustain|all> [seed]
 *  - reg     : 회귀 0 — kShare=0 이면 step-0018 과 비트 동일(share 통째 skip·m 불변). share 스택 해시를 golden mem@ 와 대조.
 *  - conserve: 보존 — 생물량 공유(kin m 균등화)가 도는 내내 닫힌 장부 잔차 < 1e-6. 공유는 쌍 거래(나간 만큼 들어옴 → sumM 불변).
 *  - det     : 결정론 — kShare on 같은 시드 2회 비트 동일(공유는 m 재분배 — m 이 해시에. 순차 Gauss-Seidel 라 결정론).
 *  - kin     : 가설 — kin selection 선택압(2×2 요인설계 혈연도×협동). 협동자(coop=1)·배신자(coop=0) 혼합 경쟁(boom-bust). 두 기준선(협동off,
 *              뭉침/흩어짐)이 중립이고, 협동의 효과가 *뭉칠 때만* 살아남는다(흩어지면 낭비된 이타로 해롭다) — 상호작용=kin selection(Hamilton rb>c).
 *  - sustain : 생물량 공유(실제 m 재분배)가 step-0018 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0018 그대로(별·자기제한·연소 FSM·계량·복제·생명 유전·차등 응집·막 결합) + 생물량 공유(kShare 0.5, 균일 협동).
 * kin 은 *통제 선택 아레나*(척박한 장·번식/사망 on — adhere on/off 로 혈연도를 갈라 협동의 차등 적합도=선택압을 격리)에서 kin selection 을 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(share 법칙 포함)
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
var SHARE = { kShare: 0.5, coopFit0: 1.0, coopFitStep: 0.0 };  // step-0019 신규 — 생물량 공유(전체 스택은 *균일 협동*: 모든 kin 이 m 공유 = risk-pooling)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + 복제 + 생명 유전 + 차등 응집 + 막 결합 + 생물량 공유). extra 로 kShare=0 주면 step-0018 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* 통제 선택 아레나 — boom-bust(풍년↔기근 순환). 번식·사망 on(선택), 복제·막·별 off.
 * 두 유전형: 협동자(coop=1)·배신자(coop=0). 협동을 *복제 적합도(fit)와 분리*(geneFitStep=0·inheritCost=0)해 kin selection 만 격리.
 * 평형(자원 제한)에선 m 재분배가 zero-sum(굶주린 하나를 살리면 다른 하나가 굶음) — 선택압 0. *비평형*(기근)에서만 구조가 사망을
 * 막아 선택이 작동한다(다른 하나가 굶는 게 아니라 안 죽음). adhere on/off 로 혈연도(kin 뭉침)를 가른다 — 협동은 kin 곁에서만
 * 떠받치므로(rb>c), 뭉치면 협동이 *지속*하고 흩어지면 *낭비된 이타*(고립 kin 떠받쳐도 함께 죽음)라 협동이 *사라진다*(Hamilton). */
function selArena(extra) {
  return Object.assign({}, {
    initE: 1.2, noise: 0.3, drive: true,
    source: { x: 32, y: 32, r: 30, rate: 0.025 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0.001, kA: 0, baseCost: 0.01,
    kL: 0.06, mMaint: 0.03, mDeath: 0.10, mSeed: 0.45, lifeR: 1,
    repro: true, mDiv: 0.9, divR: 1, popCap: 4096,
    move: true, moveR: 1, moveThresh: 0.02, pTumble: 0,
    kCrowd: 0, crowdR: 3,                                                                       // 밀도세 off — 자원 제한만(밀도세는 협동의 생존 이득을 상쇄)
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kMembrane: 0,
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 2, geneFit0: 0.5, geneFitStep: 0,     // 협동≠복제적합도(격리)
    kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5,
    kShare: 0.6, coopFit0: 0, coopFitStep: 1                                                    // coop(1)=0 배신·coop(2)=1 협동
  }, extra || {});
}
var FEAST_RATE = 0.025, FEAST_T = 400, BUST_RATE = 0.004, BUST_T = 250, CYCLES = 8;  // boom-bust 순환(기근에 구조가 사망을 막는다)
/* 통제 아레나에 두 유전형(배신 ta=1·협동 tb=2)을 *무작위 혼합* 파종(~40% 밀도, 시드 의사난수 — Math.random 금지). 균등 빈도로 시작. */
function seedMix(sim, ta, tb) {
  var n = 0;
  for (var y = 14; y < 50; y++) for (var x = 14; x < 50; x++) {
    var h = ENG.tumbleHash(x, y, 0, sim.seed);
    if ((h >>> 28) < 6) {                               // 상위 4비트 < 6 → ~40% 밀도
      var a = ENG.spawnAgent(sim, x, y); a.g = ((h >>> 20) & 1) ? tb : ta; n++;
    }
  }
  return n;
}
/* boom-bust 순환 — 협동자 비율 변화(Δ)를 잰다. 800 정착 + CYCLES×(풍년+기근). */
function bbCompete(seed, extra) {
  var sim = ENG.createSim(seed, selArena(extra)); seedMix(sim, 1, 2); ENG.run(sim, 800);
  var f0 = coopFrac(sim).frac;
  for (var c = 0; c < CYCLES; c++) { sim.p.source.rate = FEAST_RATE; ENG.run(sim, FEAST_T); sim.p.source.rate = BUST_RATE; ENG.run(sim, BUST_T); }
  var fin = coopFrac(sim);
  return { d: fin.frac - f0, frac: fin.frac, pop: fin.pop };
}
function coopFrac(sim) {   // 협동자(tag2) 비율 = tag2 / (tag1+tag2)
  var ag = sim.agents, c1 = 0, c2 = 0;
  for (var i = 0; i < ag.length; i++) { var g = ag[i].g | 0; if (g === 1) c1++; else if (g === 2) c2++; }
  return { frac: (c1 + c2) > 0 ? c2 / (c1 + c2) : 0, pop: c1 + c2, c1: c1, c2: c2 };
}
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kShare=0 → step-0018 비트 동일. golden mem@ 해시(막 결합 스택, 생물량 공유 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden mem@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kShare=0. */
  var sim = ENG.createSim(seed, scn({ kShare: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['mem@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 생물량 공유(kin m 균등화)가 도는 내내 닫힌 장부. 공유는 쌍 거래(나간 만큼 들어옴 → sumM 불변). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, shared: sim.shared, pass: led.residual < 1e-6 };
}

/* ── det: kShare on 같은 시드 2회 비트 동일(공유는 m 재분배 — m 이 해시에). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, scn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); seedGenes(s); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if (a.agents[k].x !== b.agents[k].x || a.agents[k].y !== b.agents[k].y || a.agents[k].m !== b.agents[k].m || (a.agents[k].g || 0) !== (b.agents[k].g || 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── kin: 가설 — kin selection 선택압(Hamilton's rule). *2×2 요인설계*: 혈연도(뭉침/흩어짐) × 협동(off/on). ──
 *  네 조건(같은 시드·아레나, 협동·혈연도만 변경) — boom-bust 순환서 협동자(coop=1) 비율 변화 Δ:
 *   뭉침·협동off (clustNo) : 기준선 — tag1/tag2 *중립*이어야(협동 외 차이 0). 태그 artifact 0.
 *   뭉침·협동on  (clustCo) : 협동자가 kin 클러스터서 기근 사망을 막아 *지속*.
 *   흩어짐·협동off(scatNo) : 기준선 — *흩어짐 자체*는 tag2 를 불리하게 안 함(중립). 흩어짐 artifact 0.
 *   흩어짐·협동on (scatCo) : 협동자가 고립돼 *낭비된 이타*(떠받쳐도 함께 죽음) → 협동 *사라짐*.
 *  *협동의 효과* = (협동on − 협동off) 를 혈연도별로 잰다: effClust=clustCo−clustNo, effScat=scatCo−scatNo.
 *  *상호작용* inter = effClust − effScat = "혈연도가 협동을 favor 한 폭" = kin selection 의 정량(rb>c: r 이 협동을 가른다).
 *  두 기준선(clustNo·scatNo)이 중립이라 효과는 *오직 협동에서*(흩어짐 자체 아님). 협동은 *복제 적합도와 분리*(geneFitStep=0·inheritCost=0)라 confound 0. */
function kinTest(seed) {
  var clustNo = bbCompete(seed, { kShare: 0, kAdhesion: 1 });    // 뭉침·협동 off (기준선)
  var clustCo = bbCompete(seed, { kShare: 0.6, kAdhesion: 1 });  // 뭉침·협동 on
  var scatNo = bbCompete(seed, { kShare: 0, kAdhesion: 0 });     // 흩어짐·협동 off (기준선)
  var scatCo = bbCompete(seed, { kShare: 0.6, kAdhesion: 0 });   // 흩어짐·협동 on
  var effClust = clustCo.d - clustNo.d, effScat = scatCo.d - scatNo.d, inter = effClust - effScat;
  var pass = Math.abs(clustNo.d) < 0.10 && Math.abs(scatNo.d) < 0.10   // 두 기준선 중립(태그·흩어짐 artifact 0)
    && effScat < -0.05                                                  // 협동이 흩어지면 *해롭다*(낭비된 이타)
    && inter > 0.10;                                                    // 혈연도가 협동을 favor (kin selection)
  return { seed: seed, clustNo: clustNo.d, clustCo: clustCo.d, scatNo: scatNo.d, scatCo: scatCo.d, effClust: effClust, effScat: effScat, inter: inter, pass: pass };
}

/* ── sustain: 생물량 공유(실제 m 재분배)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, shared: sim.shared, collapse: collapse };
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
    console.log('회귀 0: kShare=0 step-0019 == step-0018 (share 스택 해시 == golden mem@, share 법칙 skip·m 불변)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'shared', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (생물량 공유는 kin 쌍 m 균등화 — 나간 만큼 들어옴, 거래 0. sumM 불변·장부 식 불변). 누적 공유 m ~' + avg(rc, 'shared').toFixed(0));
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 비트 동일(생물량 공유는 순차 Gauss-Seidel — m 재분배가 해시에. Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'kin') {
    var rk = seeds.map(kinTest); table(rk, ['seed', 'clustNo', 'clustCo', 'scatNo', 'scatCo', 'effClust', 'effScat', 'inter', 'pass']);
    console.log('kin selection(Hamilton, 2×2 요인설계 혈연도×협동): 기준선 중립 — 뭉침·협동off ' + (avg(rk, 'clustNo') >= 0 ? '+' : '') + avg(rk, 'clustNo').toFixed(3) +
      ' / 흩어짐·협동off ' + (avg(rk, 'scatNo') >= 0 ? '+' : '') + avg(rk, 'scatNo').toFixed(3) + ' (태그·흩어짐 artifact 0). 협동의 효과 — 뭉침 ' +
      (avg(rk, 'effClust') >= 0 ? '+' : '') + avg(rk, 'effClust').toFixed(3) + '(지속)·흩어짐 ' + avg(rk, 'effScat').toFixed(3) + '(낭비된 이타로 해롭다). ' +
      '상호작용(혈연도가 협동을 favor 한 폭) ' + avg(rk, 'inter').toFixed(3) + ' = kin selection 정량(rb>c). 협동≠복제적합도(격리)·기준선 중립 → 효과는 *오직* 협동에서.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'shared', 'collapse']);
    console.log('생물량 공유 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). kin 끼리 m 공유(누적 ~' + avg(st.rows, 'shared').toFixed(0) + ')·임계 자기조직 유지.');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'kin', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
