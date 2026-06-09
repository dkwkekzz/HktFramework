/* HWS step-0021 헤드리스 검증 — 세포 분화(differentiate: 같은 genotype 이 *위치*에 따라 다른 phenotype — 갇힌 내부=soma·표면=germ, 진짜 분업, SPINE 주요 전이 사다리 "사회 → 분화된 다세포").
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 differentiate 법칙 1개(LAW_ORDER ⑥f, pubgood 뒤·생명 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0021/verify.js <reg|conserve|det|differ|sustain|all> [seed]
 *  - reg     : 회귀 0 — kDiff=0 이면 step-0020 과 비트 동일(differentiate 통째 skip·m 불변). 분화 스택 해시를 golden pub@ 와 대조.
 *  - conserve: 보존 — 분화(갇힌 내부 soma → kin 기부 m→m)가 도는 내내 닫힌 장부 잔차 < 1e-6(기부는 쌍 거래 — 질량 창조 0).
 *  - det     : 결정론 — kDiff on 같은 시드 2회 비트 동일(분화는 m 재분배 — 해시에. 순차 Gauss-Seidel 라 결정론).
 *  - differ  : 가설 — 세포 분화(위치 의존 phenotype + 분업 이득). 단일 클론 조밀 조직(tissue)서 *갇힌 내부* 세포(soma)가 번식 못 해
 *              제 잉여를 표면 kin(germ)에게 기부 → 같은 genotype 이 *위치로* 두 역할로 갈린다(germ m 배증·roleGap 닫힘). 분업이 개체군 성장↑.
 *  - sustain : 분화(실제 m 재분배)가 step-0020 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0020 그대로(별·자기제한·연소 FSM·계량·복제·생명 유전·차등 응집·막 결합·생물량 공유·공공재) + 세포 분화(kDiff 0.3, 균일).
 *   *전체 스택은 희소·이동성*이라 4-근방이 다 찬 갇힌 세포가 드물어 분화가 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 분화 현상은 differ 의 *조밀 조직 아레나*에서 잰다.
 * differ 는 *통제 분화 아레나*(단일 클론 조밀 blob·번식 on·move on — 공공재/공유 off 로 분화만 격리)에서 위치 의존 phenotype 과 분업 이득을 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(differentiate 법칙 포함)
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
var DIFF = { kDiff: 0.3 };  // step-0021 신규 — 세포 분화(전체 스택은 균일·희소라 거의 안 켜짐 — 현상은 differ 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 공공재 + 분화). extra 로 kDiff=0 주면 step-0020 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* 통제 분화 아레나 — 단일 클론(tag1) 조밀 조직(tissue). 번식·사망 on, move on(자리 있으면 이동·번식). 공공재/공유/막/응집 off — *분화만 격리*.
 * 균일 풍년(source r=30 이 장 전체 덮음)에서 조밀 blob 이 자라 조직이 confluent 해지면, 4-근방이 다 찬 *갇힌 내부* 세포는 번식할 자리가 없다(soma) →
 * 제 잉여를 표면 kin(germ)에게 기부해 번식을 떠받친다. 같은 genotype 인데 *위치*가 역할(soma/germ)을 정한다 — 진짜 분업. kInherit=1(클론 전파)·변이/표현형세 0(confound 0). */
function diffArena(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 30, rate: 0.03 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0.001, kA: 0, baseCost: 0.01,
    kL: 0.06, mMaint: 0.03, mDeath: 0.10, mSeed: 0.45, lifeR: 1,
    repro: true, mDiv: 0.9, divR: 1, popCap: 4096,
    move: true, moveR: 1, moveThresh: 0.02, pTumble: 0,
    kCrowd: 0, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kMembrane: 0, kShare: 0, kPublic: 0,  // 공공재/공유/막 off — 분화만 격리
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 1, geneFit0: 1, geneFitStep: 0,                                  // 단일 클론(confound 0)
    kAdhesion: 0,
    kDiff: 0.6
  }, extra || {});
}
var DIFF_SETTLE = 1200;  // 조직이 confluent 해져 정상상태에 들 때까지(번식·분화가 자리잡음)
/* 단일 클론 조밀 blob(tag1) 파종 — 12×12 솔리드. confluent 해지며 내부(soma)/표면(germ)이 위치로 갈린다. */
function seedBlob(sim) { var n = 0; for (var y = 26; y < 38; y++) for (var x = 26; x < 38; x++) { var a = ENG.spawnAgent(sim, x, y); a.g = 1; n++; } return n; }
/* 분화 아레나 1회 — kDiff 를 주고 정착 후 위치 의존 phenotype·개체군 측정. */
function diffRun(seed, kd) {
  var sim = ENG.createSim(seed, diffArena({ kDiff: kd })); seedBlob(sim); ENG.run(sim, DIFF_SETTLE);
  var m = ENG.measureDifferentiation(sim), led = ENG.ledger(sim);
  return { pop: sim.agents.length, soma: m.soma, germ: m.germ, somaM: m.somaM, germM: m.germM, roleGap: m.roleGap, somaFrac: m.somaFrac, births: sim.births, differentiated: sim.differentiated, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kDiff=0 → step-0020 비트 동일. golden pub@ 해시(공공재 스택, 분화 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden pub@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kDiff=0. */
  var sim = ENG.createSim(seed, scn({ kDiff: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['pub@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 분화(갇힌 내부 soma → kin 기부 m→m)가 도는 내내 닫힌 장부. 기부는 쌍 거래라 잔차 불변. ──
 *   전체 스택은 희소라 분화가 거의 안 켜진다(differentiated≈0) — 닫힌 장부는 그래도 유지. *분화가 켜진* 보존은 differ 가 잰다(잔차<1e-6). */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, differentiated: sim.differentiated, pass: led.residual < 1e-6 };
}

/* ── det: kDiff on 같은 시드 2회 비트 동일(분화는 m 재분배 — 해시에). 전체 스택은 희소라 differ 아레나로 분화 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, diffArena()); seedBlob(s); ENG.run(s, 800); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if (a.agents[k].x !== b.agents[k].x || a.agents[k].y !== b.agents[k].y || a.agents[k].m !== b.agents[k].m || (a.agents[k].g || 0) !== (b.agents[k].g || 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── differ: 가설 — 세포 분화(위치 의존 phenotype + 분업 이득). 단일 클론 조밀 조직서 분화 on(kDiff>0) vs off(kDiff=0). ──
 *  같은 genotype 인데 *위치*가 역할을 정한다: 4-근방이 다 찬 *갇힌 내부* 세포는 번식 못 함(soma) → 제 잉여를 표면 kin(germ)에게 기부.
 *   ① 위치 의존 phenotype(분화): 분화 on 이면 표면 germ 이 fed → germM 배증, roleGap(germM−somaM)이 *닫힌다*(off 는 내부가 m 사장 → roleGap 음 큼).
 *      dGap = roleGap(on) − roleGap(off) ≫ 0 = "위치가 phenotype 을 가른 폭"(같은 클론 두 역할). somaFrac 큼(조직에 갇힌 내부 多).
 *   ② 분업 이득: 갇힌 내부의 *사장 생물량*이 표면 번식으로 전환 → 개체군이 더 큼(carrying capacity↑)·출생 더 많음. popOn>popOff·bOn>bOff.
 *   ③ 보존: 분화가 *세게* 도는 조직서도 닫힌 장부(기부 m→m 쌍 거래라 잔차<1e-6). */
function differTest(seed) {
  var off = diffRun(seed, 0), on = diffRun(seed, 0.6);
  var dGap = on.roleGap - off.roleGap, germRatio = off.germM > 1e-9 ? on.germM / off.germM : 0;
  var pass = dGap > 0.20                          // 위치가 phenotype 을 *세게* 가름(분화 — 같은 클론 두 역할)
    && on.germM > 1.5 * off.germM                 // 표면 germ 이 내부 soma 의 provision 으로 fed(배증)
    && off.roleGap < 0                            // 기준선: 분화 없으면 내부가 m 사장(roleGap 음 — 표면이 굶음)
    && on.somaFrac > 0.5                          // 조직에 *갇힌 내부*(soma) 가 다수 — 분화할 내부가 있다
    && on.pop > off.pop && on.births > off.births // 분업 이득 — 사장 생물량이 번식으로 전환(개체군 성장↑)
    && on.residual < 1e-6;                        // 분화가 세게 도는 조직서도 닫힌 장부(기부 m→m 쌍 거래)
  return { seed: seed, gapOff: off.roleGap, gapOn: on.roleGap, dGap: dGap, germOff: off.germM, germOn: on.germM, germRatio: germRatio,
    somaFrac: on.somaFrac, popOff: off.pop, popOn: on.pop, bOff: off.births, bOn: on.births, residual: on.residual, differentiated: on.differentiated, pass: pass };
}

/* ── sustain: 분화(실제 m 재분배)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, differentiated: sim.differentiated, collapse: collapse };
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
    console.log('회귀 0: kDiff=0 step-0021 == step-0020 (분화 스택 해시 == golden pub@, differentiate 법칙 skip·m 불변)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'differentiated', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (분화: 갇힌 내부 soma 가 kin 에게 m→m 쌍 거래 기부 — 질량 창조 0 → 장부 식 불변). 전체 스택은 희소라 분화 거의 안 켜짐(differentiated~' + avg(rc, 'differentiated').toFixed(0) + ') — *분화 활성* 보존은 differ 가 잰다(잔차<1e-6).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: differ 아레나(분화 활성) 같은 시드 2회 비트 동일(분화는 순차 Gauss-Seidel — m 재분배가 해시에. Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'differ') {
    var rk = seeds.map(differTest); table(rk, ['seed', 'gapOff', 'gapOn', 'dGap', 'germOff', 'germOn', 'somaFrac', 'popOff', 'popOn', 'bOff', 'bOn', 'residual', 'pass']);
    console.log('세포 분화(같은 genotype 다른 phenotype by 위치, 분업): 위치가 phenotype 을 가른 폭 dGap ' + (avg(rk, 'dGap') >= 0 ? '+' : '') + avg(rk, 'dGap').toFixed(3) +
      ' (roleGap ' + avg(rk, 'gapOff').toFixed(3) + '→' + avg(rk, 'gapOn').toFixed(3) + ' — 내부가 m 사장하던 것이 표면 germ 으로 흘러 닫힘). 표면 germ m ' +
      avg(rk, 'germOff').toFixed(3) + '→' + avg(rk, 'germOn').toFixed(3) + '(soma 의 provision 으로 배증)·갇힌 내부 비율 ' + avg(rk, 'somaFrac').toFixed(2) +
      '. 분업 이득 — 개체군 ' + avg(rk, 'popOff').toFixed(0) + '→' + avg(rk, 'popOn').toFixed(0) + '·출생 ' + avg(rk, 'bOff').toFixed(0) + '→' + avg(rk, 'bOn').toFixed(0) +
      '(사장 생물량이 번식으로 전환). 분화 세게 도는 조직서도 잔차 ' + avg(rk, 'residual').toExponential(2) + '(기부 m→m 쌍 거래).');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'differentiated', 'collapse']);
    console.log('분화 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(분화)이 동역학을 안 깬다(전체 스택은 희소라 분화 거의 안 켜짐 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'differ', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
