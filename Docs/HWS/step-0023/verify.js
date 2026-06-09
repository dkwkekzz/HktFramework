/* HWS step-0023 헤드리스 검증 — 정착 생활사(anchor: 잘 먹은 kin-포위 생명이 *정지·고착*해 큰 안정 confluent 조직을 빚는다. 분화/격리가 전체 스택서 발현하는 *전제*, SPINE 주요 전이 사다리 "분화된 다세포").
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 anchor 법칙 1개(LAW_ORDER ⑥0, move 앞)+ move/adhere 에 정착 게이트(a.sessile skip). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0023/verify.js <reg|conserve|det|anchor|sustain|all> [seed]
 *  - reg     : 회귀 0 — kAnchor=0 이면 step-0022 와 비트 동일(anchor 통째 skip·a.sessile 미설정·move/adhere 게이트 off). 정착 스택 해시를 golden germ@ 와 대조.
 *  - conserve: 보존 — 정착(위치만 — 운동 skip, 거래 0)이 도는 내내 닫힌 장부 잔차 < 1e-6(정착은 m·E·R 을 안 건드린다).
 *  - det     : 결정론 — kAnchor on 같은 시드 2회 비트 동일(a.sessile 게이트가 위치를 바꿔 해시에. 결정론 — m·위치의 함수, Math.random 금지).
 *  - anchor  : 가설 — 정착 생활사(잘 먹은 kin-포위 → 고착 → 큰 안정 조직). settling 아레나(흩어진 단일 클론 + 국소 정적 먹이)서 정착 on(kAnchor=1) vs off(kAnchor=0):
 *              고착(sessileFrac>0)·조직 coalescence(meanOrg↑·nOrg↓ — 잘게 흩어진 조직이 큰 안정 조직 몇으로)·조밀화(interiorFrac↑)·분화 발현↑(differentiated provision↑ — 갇힌 내부 세포가 늘어 분화가 더 돈다).
 *  - sustain : 정착(실제 위치 게이트)이 step-0022 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0 — 굶주린 정착체는 풀려 탐사로 탈출, 자기 보호).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0022 그대로(별·자기제한·연소 FSM·계량·복제·생명 유전·차등 응집·막 결합·생물량 공유·공공재·세포 분화·생식세포 계통 격리) + 정착 생활사(kAnchor 1).
 *   *전체 스택은 희소·이동성*이라(별 봉우리를 쫓는 주화성·탐사가 nascent 클러스터를 끊임없이 해체) 잘 먹고 kin-포위된 생명이 드물어 정착이 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 정착 현상은 anchor 의 *settling 아레나*에서 잰다.
 * anchor 는 *settling 아레나*(흩어진 단일 클론 + 국소 정적 먹이·번식 on·move/adhere on — 정착만 켜고 끄며 비교)에서 정착이 큰 안정 조직을 빚고 분화를 발현시키는지 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(anchor 법칙 포함)
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
var ANCHOR = { kAnchor: 1, anchorM: 0.6, anchorKin: 2 };  // step-0023 신규 — 정착 생활사(전체 스택은 희소라 잘 먹은 kin-포위 생명 드물어 정착 거의 안 켜짐 — 현상은 settling 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 계통 격리 + 정착). extra 로 kAnchor=0 주면 step-0022 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, ANCHOR, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* settling 아레나 — 흩어진 단일 클론(tag1) 씨앗 + 국소 정적 먹이(source r=8). 번식·사망 on·move+adhere on. 위치 분화(kDiff) on·계통 격리/공공재/공유/막 off — *정착만 격리*.
 * 정착 off 면 생명이 먹이를 쫓는 주화성·탐사·재정렬로 잘게 흩어진 채 머문다(여러 작은 조직). 정착 on 이면 잘 먹은 kin-포위 코어가 *고착*해 떠돌지 않고,
 * 이웃 kin 이 그 둘레에 쌓여 *큰 안정 confluent 조직*으로 coalesce → 갇힌 내부 세포가 늘어 분화(0021)가 *더* 돈다(분화/격리는 조밀함의 자식 — 그 조밀함을 정착이 만든다). */
function ancArena(extra) {
  return Object.assign({}, {
    initE: 1.0, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 8, rate: 0.12 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0.001, kA: 0, baseCost: 0.01,
    kL: 0.06, mMaint: 0.03, mDeath: 0.10, mSeed: 0.45, lifeR: 1,
    repro: true, mDiv: 0.9, divR: 1, popCap: 4096,
    move: true, moveR: 1, moveThresh: 0.02, pTumble: 1.0,
    kCrowd: 0, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kMembrane: 0, kShare: 0, kPublic: 0, kGermline: 0,  // 계통 격리/공공재/공유/막 off — 정착만 격리
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 1, geneFit0: 1, geneFitStep: 0,                                              // 단일 클론(confound 0)
    kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5,
    kDiff: 0.3,                                                                                                                       // 위치 분화 on — 정착이 키운 조밀 조직서 분화가 더 도는지 본다
    kAnchor: 1, anchorM: 0.55, anchorKin: 2
  }, extra || {});
}
var ANC_SETTLE = 1500;  // 흩어진 씨앗이 정착으로 confluent 조직을 빚고 정상상태에 들 때까지
/* 흩어진 단일 클론 씨앗(tag1) — 18..46 격자 3칸 간격 산포(정착 off 면 흩어진 채, on 이면 coalesce). */
function seedScatter(sim) { var n = 0; for (var y = 18; y < 46; y += 3) for (var x = 18; x < 46; x += 3) { var a = ENG.spawnAgent(sim, x, y); a.g = 1; n++; } return n; }
/* settling 아레나 1회 — kAnchor 를 주고 정착 후 조직·분화 측정. */
function ancRun(seed, ka) {
  var sim = ENG.createSim(seed, ancArena({ kAnchor: ka })); seedScatter(sim); ENG.run(sim, ANC_SETTLE);
  var o = ENG.measureOrganisms(sim), a = ENG.measureAnchor(sim), d = ENG.measureDifferentiation(sim), led = ENG.ledger(sim);
  return { pop: sim.agents.length, maxOrg: o.maxSize, meanOrg: o.meanSize, nOrg: o.nOrg, kinFrac: o.kinFrac,
    sessile: a.sessile, sessileFrac: a.sessileFrac, sessileM: a.sessileM, interior: a.interior, interiorFrac: a.interiorFrac,
    soma: d.soma, roleGap: d.roleGap, differentiated: sim.differentiated, births: sim.births, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kAnchor=0 → step-0022 비트 동일. golden germ@ 해시(계통 스택, 정착 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden germ@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kAnchor=0. */
  var sim = ENG.createSim(seed, scn({ kAnchor: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['germ@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 정착(위치만 — 운동 skip, 거래 0)이 도는 내내 닫힌 장부. 정착은 m·E·R 을 안 건드린다(move/adhere 와 같은 경계). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, sessile: sim.sessileCount, pass: led.residual < 1e-6 };
}

/* ── det: kAnchor on 같은 시드 2회 비트 동일(a.sessile 게이트가 위치 변경 → 해시에). settling 아레나로 정착 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, ancArena()); seedScatter(s); ENG.run(s, 800); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if (a.agents[k].x !== b.agents[k].x || a.agents[k].y !== b.agents[k].y || a.agents[k].m !== b.agents[k].m || (a.agents[k].sessile ? 1 : 0) !== (b.agents[k].sessile ? 1 : 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── anchor: 가설 — 정착 생활사(잘 먹은 kin-포위 → 고착 → 큰 안정 조직 → 분화 발현). settling 아레나서 정착 on(kAnchor=1) vs off(kAnchor=0). ──
 *  ① 정착 활성: sessileFrac>0(잘 먹고 kin-포위된 생명이 고착) — 정착이 실제로 일어난다. 잘 먹은 코어(sessileM 큼).
 *  ② 조직 coalescence: meanOrg↑·nOrg↓ — 잘게 흩어진 조직(여럿)이 *큰 안정 조직 몇*으로 모인다(정착 코어가 떠돌지 않아 이웃 kin 이 둘레에 쌓임).
 *  ③ 조밀화: interiorFrac↑ — 갇힌 내부(같은 태그 4-근방 ≥3) 세포 비율이 늘어 confluent 조직이 빽빽해진다(분화/격리의 토대).
 *  ④ 분화 발현(payoff): differentiated provision↑ — 갇힌 내부 세포가 늘어 0021 분화(soma→kin 기부)가 *더* 돈다 → "분화는 조밀함의 자식, 그 조밀함을 정착이 만든다"(0021 한계 #3 의 길). 보존: 정착은 위치만이라 잔차<1e-6. */
function ancTest(seed) {
  var off = ancRun(seed, 0), on = ancRun(seed, 1);
  var pass = on.sessileFrac > 0.3                  // ① 정착 활성 — 잘 먹고 kin-포위된 생명이 고착(≈0.66)
    && on.meanOrg > off.meanOrg                    // ② coalescence — 평균 조직 크기↑(흩어진 조직이 큰 조직으로)
    && on.nOrg < off.nOrg                          //   조직 수↓(여럿 → 큰 것 몇)
    && on.interiorFrac > off.interiorFrac          // ③ 조밀화 — 갇힌 내부 비율↑(confluent 조직)
    && on.differentiated > off.differentiated      // ④ 분화 발현(payoff) — 갇힌 내부 늘어 분화 provision↑("분화는 조밀함의 자식")
    && on.residual < 1e-6;                         //   정착은 위치만(운동 skip — 거래 0)이라 닫힌 장부
  return { seed: seed, sessF: on.sessileFrac, sessM: on.sessileM,
    meanOff: off.meanOrg, meanOn: on.meanOrg, nOff: off.nOrg, nOn: on.nOrg, maxOff: off.maxOrg, maxOn: on.maxOrg,
    intFOff: off.interiorFrac, intFOn: on.interiorFrac, diffOff: off.differentiated, diffOn: on.differentiated,
    popOff: off.pop, popOn: on.pop, residual: on.residual, pass: pass };
}

/* ── sustain: 정착(실제 위치 게이트)이 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, sessile: sim.sessileCount, collapse: collapse };
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
    console.log('회귀 0: kAnchor=0 step-0023 == step-0022 (정착 스택 해시 == golden germ@, anchor 법칙 skip·a.sessile 미설정·move/adhere 게이트 off).');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'sessile', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (정착은 *위치만* — 운동 skip 일 뿐 m·E·R 거래 0 → 장부 식 불변). 전체 스택은 희소라 정착 거의 안 켜짐(sessile~' + avg(rc, 'sessile').toFixed(0) + ') — *정착 활성* 조직 효과는 anchor 가 잰다.');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: settling 아레나(정착 활성) 같은 시드 2회 비트 동일(a.sessile 게이트가 위치를 바꿔 해시에. m·위치의 함수 — Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'anchor') {
    var rk = seeds.map(ancTest); table(rk, ['seed', 'sessF', 'sessM', 'meanOff', 'meanOn', 'nOff', 'nOn', 'maxOff', 'maxOn', 'intFOff', 'intFOn', 'diffOff', 'diffOn', 'popOff', 'popOn', 'residual', 'pass']);
    console.log('정착 생활사(잘 먹은 kin-포위 → 고착 → 큰 안정 조직): 고착 비율 ' + avg(rk, 'sessF').toFixed(2) +
      ' (sessileM ' + avg(rk, 'sessM').toFixed(2) + ' — 잘 먹은 코어). 조직 coalescence: 평균 크기 ' + avg(rk, 'meanOff').toFixed(1) + '→' + avg(rk, 'meanOn').toFixed(1) +
      '·조직 수 ' + avg(rk, 'nOff').toFixed(0) + '→' + avg(rk, 'nOn').toFixed(0) + ' (잘게 흩어진 조직 여럿 → 큰 안정 조직 몇). 조밀화: 갇힌 내부 비율 ' + avg(rk, 'intFOff').toFixed(2) + '→' + avg(rk, 'intFOn').toFixed(2) +
      '. 분화 발현(payoff): provision ' + avg(rk, 'diffOff').toFixed(0) + '→' + avg(rk, 'diffOn').toFixed(0) + ' (갇힌 내부 늘어 0021 분화가 더 돈다 — "분화는 조밀함의 자식, 그 조밀함을 정착이 만든다"). 정착은 위치만이라 잔차 ' + avg(rk, 'residual').toExponential(2) + '.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'sessile', 'collapse']);
    console.log('정착 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(정착)이 동역학을 안 깬다(전체 스택은 희소라 정착 거의 안 켜짐·굶주린 정착체는 풀려 탐사 탈출 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'anchor', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
