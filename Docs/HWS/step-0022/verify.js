/* HWS step-0022 헤드리스 검증 — 생식세포 계통 격리(sequester: 분열 자식을 *불가역* germ/soma 로 일찍 떼어 두는 Weismann 장벽. 위치 무관 *상속* 분화, SPINE 주요 전이 사다리 "분화된 다세포").
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 sequester 법칙 1개(LAW_ORDER ⑦b, metabolize 뒤·reproduce 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0022/verify.js <reg|conserve|det|germ|sustain|all> [seed]
 *  - reg     : 회귀 0 — kGermline=0 이면 step-0021 과 비트 동일(sequester 통째 skip·m·a.soma 불변). 계통 스택 해시를 golden diff@ 와 대조.
 *  - conserve: 보존 — 격리(soma 계통 → germ kin export m→m)가 도는 내내 닫힌 장부 잔차 < 1e-6(export 는 쌍 거래 — 질량 창조 0).
 *  - det     : 결정론 — kGermline on 같은 시드 2회 비트 동일(fate a.soma·m 재분배가 해시에. 순차 Gauss-Seidel·시드 의사난수라 결정론).
 *  - germ    : 가설 — 생식세포 계통 격리(*불가역 상속* fate + Weismann 번식 격리). 단일 클론 조밀 조직(tissue)서 *계통*(germ/soma)이 *위치 무관*하게 갈리고(soma 가 표면에도 있음 — 0021 위치 분화와 결정적 차이),
 *              soma 계통은 제 잉여를 germ kin 에게 전량 export 해 mDiv 에 영영 못 닿는다(번식이 germ 전용 = Weismann). somaFrac≈kGermline(할당)·roleGap 큼·germProvisioned>0.
 *  - sustain : 격리(실제 m 재분배)가 step-0021 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0021 그대로(별·자기제한·연소 FSM·계량·복제·생명 유전·차등 응집·막 결합·생물량 공유·공공재·세포 분화) + 생식세포 계통 격리(kGermline 0.3).
 *   *전체 스택은 희소·이동성*이라 4-근방 germ kin 이 드물어 soma export 가 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 격리 현상은 germ 의 *조밀 조직 아레나*에서 잰다.
 * germ 는 *통제 격리 아레나*(단일 클론 조밀 blob·번식 on·move on — 위치 분화/공공재/공유 off 로 계통 격리만 격리)에서 불가역 계통과 Weismann 번식 격리를 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(sequester 법칙 포함)
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
var GERM = { kGermline: 0.3 };  // step-0022 신규 — 생식세포 계통 격리(전체 스택은 희소라 germ kin 드물어 export 거의 안 켜짐 — 현상은 germ 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 분화 + 계통 격리). extra 로 kGermline=0 주면 step-0021 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* 통제 격리 아레나 — 단일 클론(tag1) 조밀 조직(tissue). 번식·사망 on, move on. 위치 분화(kDiff)/공공재/공유/막/응집 off — *계통 격리만 격리*.
 * 균일 풍년(source r=30 이 장 전체 덮음)에서 조밀 blob 이 자라 confluent 해지면, 각 생명이 *위치 무관*하게 불가역 germ/soma 계통으로 커밋된다(kGermline=soma 할당) →
 * soma 계통은 제 잉여를 germ kin 에게 전량 export 해 mDiv 에 영영 못 닿는다(번식이 germ 전용 = Weismann). 같은 genotype 인데 *계통*이 역할을 정한다 — 상속되는 분화. */
function germArena(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: true,
    source: { x: 32, y: 32, r: 30, rate: 0.03 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0.001, kA: 0, baseCost: 0.01,
    kL: 0.06, mMaint: 0.03, mDeath: 0.10, mSeed: 0.45, lifeR: 1,
    repro: true, mDiv: 0.9, divR: 1, popCap: 4096,
    move: true, moveR: 1, moveThresh: 0.02, pTumble: 0,
    kCrowd: 0, crowdR: 3,
    kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kMembrane: 0, kShare: 0, kPublic: 0, kDiff: 0,  // 위치 분화/공공재/공유/막 off — 계통 격리만 격리
    kInherit: 1, inheritMu: 0, inheritCost: 0, geneTypes: 1, geneFit0: 1, geneFitStep: 0,                                            // 단일 클론(confound 0)
    kAdhesion: 0,
    kGermline: 0.6
  }, extra || {});
}
var GERM_SETTLE = 1200;  // 조직이 confluent 해져 정상상태에 들 때까지(번식·계통 커밋·격리가 자리잡음)
/* 단일 클론 조밀 blob(tag1) 파종 — 12×12 솔리드. confluent 해지며 위치 무관 germ/soma 계통으로 갈린다. */
function seedBlob(sim) { var n = 0; for (var y = 26; y < 38; y++) for (var x = 26; x < 38; x++) { var a = ENG.spawnAgent(sim, x, y); a.g = 1; n++; } return n; }
/* 격리 아레나 1회 — kGermline 을 주고 정착 후 불가역 계통·Weismann 번식 격리·개체군 측정. */
function germRun(seed, kg) {
  var sim = ENG.createSim(seed, germArena({ kGermline: kg })); seedBlob(sim); ENG.run(sim, GERM_SETTLE);
  var m = ENG.measureGermline(sim), led = ENG.ledger(sim);
  return { pop: sim.agents.length, soma: m.soma, germ: m.germ, somaM: m.somaM, germM: m.germM, somaMaxM: m.somaMaxM,
    roleGap: m.roleGap, somaFrac: m.somaFrac, somaSurfaceFrac: m.somaSurfaceFrac, surfaceSomaFrac: m.surfaceSomaFrac, committed: m.committed, weismann: m.weismann,
    mDiv: sim.p.mDiv, births: sim.births, germProvisioned: sim.germProvisioned, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kGermline=0 → step-0021 비트 동일. golden diff@ 해시(분화 스택, 계통 격리 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden diff@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kGermline=0. */
  var sim = ENG.createSim(seed, scn({ kGermline: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['diff@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 격리(soma 계통 → germ kin export m→m)가 도는 내내 닫힌 장부. export 는 쌍 거래라 잔차 불변. ──
 *   전체 스택은 희소라 격리가 거의 안 켜진다(germProvisioned≈0) — 닫힌 장부는 그래도 유지. *격리가 켜진* 보존은 germ 가 잰다(잔차<1e-6). */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, germProvisioned: sim.germProvisioned, pass: led.residual < 1e-6 };
}

/* ── det: kGermline on 같은 시드 2회 비트 동일(fate a.soma·m 재분배 — 해시에). 전체 스택은 희소라 germ 아레나로 격리 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, germArena()); seedBlob(s); ENG.run(s, 800); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.G[i] !== b.G[i]) { bit = false; break; }
  if (bit && a.agents.length === b.agents.length) for (var k = 0; k < a.agents.length; k++) if (a.agents[k].x !== b.agents[k].x || a.agents[k].y !== b.agents[k].y || a.agents[k].m !== b.agents[k].m || (a.agents[k].g || 0) !== (b.agents[k].g || 0) || (a.agents[k].soma ? 1 : 0) !== (b.agents[k].soma ? 1 : 0)) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── germ: 가설 — 생식세포 계통 격리(불가역 상속 fate + Weismann 번식 격리). 단일 클론 조밀 조직서 격리 on(kGermline>0) vs off(kGermline=0). ──
 *  같은 genotype 인데 *계통*(불가역 fate)이 역할을 정한다 — 위치 무관·상속:
 *   ① 불가역 *상속* 분화(위치 무관): *표면 세포 중* soma 계통 비율 surfaceSomaFrac ≈ kGermline(표면도 무작위 할당) — 0021 위치 분화라면 표면=전부 germ 이라 0. fate 가 위치가 아니라 *계통*에 산다는 강한 증거.
 *   ② Weismann 번식 격리: soma 계통이 제 잉여를 germ kin 에게 전량 export → soma m 이 mDiv 에 영영 못 닿는다(weismann: somaMaxM<mDiv) → 번식이 *생식세포 계통(germ) 전용*(reproduce 동결 — 창발적 격리).
 *   ③ 계통 격리: somaFrac≈kGermline(할당 비율)·committed=조직 전체(계통이 정해진 범위)·roleGap=germM−somaM 큼(germ 이 soma 의 export 로 fed — 생식세포에 자원 집중).
 *   ④ 분업 이득(독립 증거)·보존: 사장될 soma 잉여가 germ 번식으로 전환돼 출생↑(bOn>bOff). 격리가 *세게* 도는 조직서도 닫힌 장부(export m→m 쌍 거래라 잔차<1e-6)·실제 흐름(germProvisioned>0). */
function germTest(seed) {
  var off = germRun(seed, 0), on = germRun(seed, 0.6);
  var pass = on.surfaceSomaFrac > 0.3            // ① 위치 무관 fate — 표면 세포 중 soma 비율(≈0.44, 표면도 무작위 할당). 0021 위치 분화면 표면=전부 germ 이라 0. 불가역 상속 계통의 강한 서명.
    && on.weismann                               // ② Weismann — soma 가 mDiv 에 못 닿음(somaMaxM<mDiv) → 번식이 germ 전용(생식/체세포 계통 분리)
    && on.somaFrac > 0.45 && on.somaFrac < 0.85  // ③ 계통 할당 ≈ kGermline(0.6) — 안정적 계통 분리
    && on.roleGap > 0.10                         //   germ 이 soma 의 provision 으로 fed(생식세포 계통에 자원 집중)
    && on.births > off.births                    // ④ 분업 이득(독립 증거) — 사장될 soma 잉여가 germ 번식으로 전환(출생↑, 법칙이 직접 안 만지는 결과)
    && on.germProvisioned > 0                    //   실제 m 흐름(soma→germ export)
    && on.residual < 1e-6;                       //   격리가 세게 도는 조직서도 닫힌 장부(export m→m 쌍 거래)
  return { seed: seed, surfSoma: on.surfaceSomaFrac, somaSurf: on.somaSurfaceFrac, weismann: on.weismann, somaMaxM: on.somaMaxM, mDiv: on.mDiv,
    somaFrac: on.somaFrac, roleGap: on.roleGap, somaM: on.somaM, germM: on.germM, committed: on.committed,
    popOff: off.pop, popOn: on.pop, bOff: off.births, bOn: on.births, germProv: on.germProvisioned, residual: on.residual, pass: pass };
}

/* ── sustain: 격리(실제 m 재분배)가 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, germProvisioned: sim.germProvisioned, collapse: collapse };
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
    console.log('회귀 0: kGermline=0 step-0022 == step-0021 (계통 스택 해시 == golden diff@, sequester 법칙 skip·m·a.soma 불변)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'germProvisioned', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (격리: soma 계통이 germ kin 에게 m→m 쌍 거래 export — 질량 창조 0 → 장부 식 불변). 전체 스택은 희소라 격리 거의 안 켜짐(germProvisioned~' + avg(rc, 'germProvisioned').toFixed(0) + ') — *격리 활성* 보존은 germ 가 잰다(잔차<1e-6).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: germ 아레나(격리 활성) 같은 시드 2회 비트 동일(계통 fate a.soma·m 재분배가 해시에. 순차 Gauss-Seidel·시드 의사난수 — Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'germ') {
    var rk = seeds.map(germTest); table(rk, ['seed', 'surfSoma', 'weismann', 'somaMaxM', 'mDiv', 'somaFrac', 'roleGap', 'somaM', 'germM', 'committed', 'popOff', 'popOn', 'bOff', 'bOn', 'germProv', 'residual', 'pass']);
    console.log('생식세포 계통 격리(불가역 상속 fate + Weismann): 표면 세포 중 soma 계통 ' + avg(rk, 'surfSoma').toFixed(2) +
      ' (≈kGermline 0.6 — fate 가 위치 아닌 *계통*에 산다, 0021 위치 분화면 표면=전부 germ 이라 0). Weismann 번식 격리: somaMaxM ' + avg(rk, 'somaMaxM').toFixed(3) + ' < mDiv ' + avg(rk, 'mDiv').toFixed(2) +
      ' → 번식이 생식세포 계통(germ) 전용. 계통 할당 somaFrac ' + avg(rk, 'somaFrac').toFixed(2) + '(≈kGermline 0.6)·roleGap=germM−somaM +' + avg(rk, 'roleGap').toFixed(3) +
      '(germ ' + avg(rk, 'germM').toFixed(2) + ' vs soma ' + avg(rk, 'somaM').toFixed(2) + ' — 생식세포에 자원 집중). 개체군 ' + avg(rk, 'popOff').toFixed(0) + '→' + avg(rk, 'popOn').toFixed(0) +
      '·출생 ' + avg(rk, 'bOff').toFixed(0) + '→' + avg(rk, 'bOn').toFixed(0) + '. 격리 세게 도는 조직서도 잔차 ' + avg(rk, 'residual').toExponential(2) + '(export m→m 쌍 거래).');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'germProvisioned', 'collapse']);
    console.log('격리 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(계통 격리)이 동역학을 안 깬다(전체 스택은 희소라 격리 거의 안 켜짐 — 직교성).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'germ', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
