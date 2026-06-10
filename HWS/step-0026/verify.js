/* HWS step-0026 헤드리스 검증 — E↔R 튜링 불안정(turing: *둘째 필드 없이* 비확산 R 자기촉매 + 확산 E 두 timescale → 균일이 깨져 반점/줄무늬. 형태 사다리 R4, R 하이트필드).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 turing 법칙 1개(LAW_ORDER ⑤f, anisotropy 뒤·combust 앞). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0026/verify.js <reg|conserve|det|turing|sustain|all> [seed]
 *  - reg     : 회귀 0 — kTuring=0 이면 step-0025 와 비트 동일(turing 통째 skip·E·R 불변). 튜링 스택 해시를 golden aniso@ 와 대조.
 *  - conserve: 보존 — 튜링(셀별 E↔R 쌍 거래 — 결정화/복제와 같은 경계)이 도는 내내 닫힌 장부 잔차 < 1e-6.
 *  - det     : 결정론 — kTuring on 같은 시드 2회 비트 동일(자기촉매 침착·붕괴가 E·R 을 바꿔 해시에. 순차 in-place — R 을 제자리에서 읽고 씀, Math.random 금지).
 *  - turing  : 가설 — E↔R 튜링 불안정(*균일이 저절로 깨져* 반점/줄무늬). turing 아레나(균일 E[noise 섭동]+균일 R, 다른 법칙 다 off, turing 만 on/off):
 *              ① 반응 실활성(전환량>0) ② 대칭 깨짐(균일 → 진폭 stdR 급증·off 는 균일 유지 stdR≈0) ③ *특성 파장*(공간 자기상관 첫 음수 lag>1·음의 dip — 반점→골 간격; off 는 패턴 없음). ④ 셀별 E↔R 쌍 거래라 보존.
 *  - sustain : 튜링(실제 E↔R 재분배)이 step-0025 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0 — 셀별 쌍 거래·자원 clamp 라 동역학 직교).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0025 그대로(별·…·방향성 결정화) + 튜링 불안정(kTuring 1).
 *   *전체 스택은 희소·이동성*이라 큰 패턴이 드물어 튜링이 거의 안 켜진다(0017~ 의 "전체 스택 개체 작음" 연장) — 튜링 현상은 turing 의 *turing 아레나*에서 잰다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(turing 법칙 포함)
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
var TURING = { kTuring: 1, turRate: 0.3, turDecay: 0.5, turSat: 2.5 };  // step-0026 신규 — E↔R 튜링 불안정(전체 스택은 희소라 큰 패턴 드물어 거의 안 켜짐 — 현상은 turing 아레나에서)
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 표준(내생 + … + 방향성 결정화 + 튜링 불안정). extra 로 kTuring=0 주면 step-0025 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, GENE, INHERIT, ADH, MEM, SHARE, PUBLIC, DIFF, GERM, ANCHOR, TENSION, ANISO, TURING, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }

/* turing 아레나 — 균일 E 장(noise 로 미세 섭동) + 균일 R(0.5). 다른 법칙 다 off, turing 만 on/off 로 *반응-확산 패턴을 격리*.
 * kTuring=1 이면 비확산 R 자기촉매(짧은 거리 활성) + 확산 E(긴 거리 억제)가 균일을 깨 반점/줄무늬(특성 파장), off 면 R 균일 그대로(대칭 안 깨짐 stdR=0). kEvap=0·drive off 라 닫힌 장부 단순. */
function turArena(extra) {
  return Object.assign({}, {
    initE: 1.5, noise: 0.2, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kEvap: 0, kA: 0, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0,
    kTuring: 1, turRate: 0.3, turDecay: 0.5, turSat: 2.5
  }, extra || {});
}
var ARENA_T = 800;   // 균일이 깨져 패턴이 또렷이 saturate 할 만큼(std ~50tick 0.06 → ~400tick 포화 ~1.0).
/* 균일 R 씨앗 — 격자 전체를 R(amount)로 채운다(외부 질량이라 E0 보정). 대칭은 E 의 초기 noise 가 깬다 → turing 이 반점/줄무늬로 키운다. */
function seedTuringR(sim, amount) { var R = sim.R, add = 0, a = amount != null ? amount : 0.5; for (var i = 0; i < R.length; i++) { R[i] = a; add += a; } sim.E0 += add; }
/* turing 아레나 1회 — kTuring 을 주고 R 하이트필드 패턴 측정. */
function turRun(seed, kt) {
  var sim = ENG.createSim(seed, turArena({ kTuring: kt })); seedTuringR(sim, 0.5); ENG.run(sim, ARENA_T);
  var m = ENG.measureTuring(sim), led = ENG.ledger(sim);
  return { stdR: m.stdR, meanR: m.meanR, maxR: m.maxR, firstNeg: m.firstNeg, minAC: m.minAC, ac1: m.ac1, conv: sim.turingConverted, residual: led.residual };
}

function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }
function seedGenes(sim) { ENG.spawnGene(sim, 20, 20, 2, 1, 1.0); ENG.spawnGene(sim, 44, 44, 2, 4, 1.0); }

/* ── reg: kTuring=0 → step-0025 비트 동일. golden aniso@ 해시(방향성 결정화 스택, 튜링 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden aniso@ 와 *동일 절차*: 별 6 + run 2000 + 생명 5 + 유전 씨앗 + run 3000, 전 스택 on·kTuring=0. */
  var sim = ENG.createSim(seed, scn({ kTuring: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['aniso@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 튜링(셀별 E↔R 쌍 거래 — 결정화/복제와 같은 경계)이 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, store: led.store, biomass: led.biomass, pop: sim.agents.length, conv: sim.turingConverted, pass: led.residual < 1e-6 };
}

/* ── det: kTuring on 같은 시드 2회 비트 동일(자기촉매 침착·붕괴가 E·R 변경 → 해시에). turing 아레나로 튜링 활성 결정론을 잰다. ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, turArena()); seedTuringR(s, 0.5); ENG.run(s, ARENA_T); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── turing: 가설 — E↔R 튜링 불안정(*균일이 저절로 깨져* 반점/줄무늬). turing 아레나서 turing on(kTuring=1) vs off(kTuring=0). ──
 *  ① 반응 실활성: conv>0(셀별 E↔R 자기촉매 침착·붕괴가 실제로 일어난다).
 *  ② 대칭 깨짐: stdR(진폭)↑·on≫off(균일이 깨져 반점/줄무늬의 진폭이 생긴다; off 는 R 균일 유지 → stdR≈0). 형태가 *씨앗 없이* 균일에서 창발(R1~R3 와 다른 R4 의 핵심).
 *  ③ *특성 파장*(핵심 thesis — "튜링 불안정"의 창의 주장): 공간 자기상관이 *유한 lag 에서 음수*(firstNeg>1 = 반점→골의 간격) + 음의 dip(minAC<0) + 근방 양의 상관(ac1>0, 반점 폭>1셀 — 격자 체커보드[단파] 아님).
 *     (진폭만 보면 "아무 구조나 생겼다"와 구별 못 한다 — *특성 파장*[공간 진동]이라야 *Turing 패턴*[짧은 활성+긴 억제]이 증명된다.) off 는 패턴 없음(firstNeg=0). 보존: 셀별 쌍 거래라 잔차<1e-6. */
function turingTest(seed) {
  var off = turRun(seed, 0), on = turRun(seed, 1);
  var pass = on.conv > 0                                  // ① 반응 실활성
    && on.stdR > 0.3 && on.stdR > off.stdR * 5            // ② 대칭 깨짐(균일 off ≈0 대비 진폭 급증)
    && on.firstNeg > 1 && on.minAC < -0.02 && on.ac1 > 0  // ③ 특성 파장(공간 진동 — 유한 lag 음수·음의 dip·근방 양상관[체커보드 아님])
    && off.firstNeg === 0                                 //   off 는 패턴 없음(대칭 안 깨짐)
    && on.residual < 1e-6;                                //   셀별 E↔R 쌍 거래(보존)라 닫힌 장부
  return { seed: seed, stdOff: off.stdR, stdOn: on.stdR, maxOn: on.maxR, firstNeg: on.firstNeg, minAC: on.minAC, ac1: on.ac1, fnOff: off.firstNeg, conv: on.conv, residual: on.residual, pass: pass };
}

/* ── sustain: 튜링(실제 E↔R 재분배)이 끝없는 churn 을 유지(공멸 없이 35k 생존·후반 출생≈사망>0). 전체 스택. ── */
var HORIZON = 35000;
function sustainTest() {
  var rows = SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); seedGenes(sim);
    var collapse = -1, b0 = 0, d0 = 0;
    for (var t = 4000; t <= HORIZON; t += 500) { ENG.run(sim, 500); if (t === 20000) { b0 = sim.births; d0 = sim.deaths; } if (sim.agents.length === 0 && collapse < 0) collapse = t; }
    var o = ENG.measureOrganisms(sim);
    return { seed: seed, finPop: sim.agents.length, finStars: sim.stars.length, lateBirths: sim.births - b0, lateDeaths: sim.deaths - d0, nOrg: o.nOrg, maxOrg: o.maxSize, conv: sim.turingConverted, collapse: collapse };
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
    console.log('회귀 0: kTuring=0 step-0026 == step-0025 (튜링 스택 해시 == golden aniso@, turing 법칙 skip·E·R 불변).');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'conv', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (튜링은 셀 안에서 E↔R 자기촉매 침착·붕괴 — 결정화/복제와 같은 쌍 거래 경계 → 장부 식 불변). 전체 스택은 이미 굳은 큰 R 위에서 *fixed point 근처 forward-back churn* 이라 전환 throughput(conv~' + avg(rc, 'conv').toFixed(0) + ')은 크되 *net 패턴*은 약하다(포화가 sink 를 눌러 진폭 작음) — *튜링 패턴*(균일 대칭 깨짐) 효과는 turing 아레나가 잰다.');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: turing 아레나(튜링 활성) 같은 시드 2회 비트 동일(자기촉매 침착·붕괴가 E·R 을 바꿔 해시에. R 을 제자리에서 읽고 씀 — Gauss-Seidel, Math.random 금지).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'turing') {
    var rk = seeds.map(turingTest); table(rk, ['seed', 'stdOff', 'stdOn', 'maxOn', 'firstNeg', 'minAC', 'ac1', 'fnOff', 'conv', 'residual', 'pass']);
    console.log('E↔R 튜링 불안정(*균일이 저절로 깨져* 반점/줄무늬): 진폭 stdR ' + avg(rk, 'stdOff').toFixed(3) + '→' + avg(rk, 'stdOn').toFixed(3) +
      ' (균일 off → 패턴 on — 대칭 깨짐). *특성 파장*: 공간 자기상관 첫 음수 lag ' + avg(rk, 'firstNeg').toFixed(1) + '(>1 = 반점→골 간격)·음의 dip ' + avg(rk, 'minAC').toFixed(2) +
      '·근방 양상관 ' + avg(rk, 'ac1').toFixed(2) + '(>0 = 반점 폭>1셀, 격자 체커보드 아님; off 패턴 없음 firstNeg=' + avg(rk, 'fnOff').toFixed(0) + '). 전환량 ' + avg(rk, 'conv').toFixed(0) +
      '. author 아닌 *창발*(짧은 활성[비확산 R 커널]+긴 억제[확산 E] 반응 1개만 깖 — 척추 체크 2·둘째 필드 0). 셀별 E↔R 쌍 거래(보존)라 잔차 ' + avg(rk, 'residual').toExponential(2) + '.');
    return rk.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var st = sustainTest(); table(st.rows, ['seed', 'finPop', 'finStars', 'lateBirths', 'lateDeaths', 'nOrg', 'maxOrg', 'conv', 'collapse']);
    console.log('튜링 on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 출생/사망 ' + avg(st.rows, 'lateBirths').toFixed(0) + '/' + avg(st.rows, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(st.rows, 'finPop').toFixed(0) + '). 존재론 조각(튜링 패턴)이 동역학을 안 깬다(전체 스택은 net 패턴 약함[포화가 sink 차단]·셀별 E↔R 쌍 거래·자원 clamp — 직교성; 단 turRate 를 크게[≳0.4] 올리면 sink 가 이겨 공멸하니 default 0.3 고정).');
    return st.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'turing', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
