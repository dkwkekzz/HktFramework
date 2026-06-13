/* HWS step-0050 헤드리스 검증 — 별 질 생산(kStarQual — 별[핵융합]이 *고질* E 를 생산해 둘째 법칙 식음에 맞섬 → 질 *구배* 창발, SPINE 여섯째 축의 source 짝).
 * 0049 가 E 에 연속 질 축 q∈[0,1] + 둘째 법칙 강등(degrade)을 깔았으나 *source 가 없어* 닫힌 세계가 한 방향으로만 식었다(질이 어디서나 균일하게 내려감 — 공간 구배 0).
 *   이 step 은 별이 주입하는 E 를 *고질*(q→kStarQual)로 만든다 — 주입 칸 q 를 질량가중 혼합(q←(q·E+kStarQual·per)/(E+per))으로 끌어올린다. 별 근처는 매 tick 재충전되고 degrade 가
 *   멀리·오래된 q 를 깎는다 → *질 구배*(고질 별 근처 ↔ 저질 원거리)가 창발한다(0049 의 균일 식음에 source 를 더해 *구배*를 세움 = 슈뢰딩거 낙차의 원천·렌더 L-Q 본 페이로프).
 *   척추: 질 생산은 *오직 source(별 융합)*에서 · q 는 E 에 올라탄 intensive 속성(단일 척추) · 국소(제 disc 칸만) · 혼합은 E 미접촉(장부 불변 — q 는 비율).
 *   회귀(이중 가드): kStarQual=0 → 블렌딩 미진입(0049 비트 동일·별 주입 E 는 무질). qInit=false(degrade off)면 미진입(질 축 없는 세계엔 별 질 없음). *교차 버전* 회귀는 verify-sim-engine.js 골든(starq@ 포함 전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0050/verify.js <reg|grad|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kStarQual=0 → 별 주입 E 무질(maxQ=0·엑서지 X=0, 별이 E 는 주입해도 질은 0)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - grad     : 가설 — *별 질 생산이 질 구배를 세운다*. kStarQual off vs on: off 면 질 구배 없음(maxQ=0·X=0) → on 이면 별 근처 q 가 고질(maxQ↑)·degrade 가 나머지 식힘 → 공간 분산 stdQ>0(구배)·엑서지 X>0(source 가 식음에 맞서 자유에너지 유지).
 *  - conserve : 보존 — 질 혼합은 E 미접촉(q 는 비율) — 닫힌 장부 잔차 < 1e-12(별 주입 E 는 sim.injected 로 장부 산입 — 별 일생 경계 그대로).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — q 가 해시에 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, DZ = 8;

/* 별 질 생산 아레나 — verify-sim-engine.js starqArena()/seedSunCore() 와 동일 상수(골든 starq@ 와 일치).
 * D=8 voxel 상자, z=0 정적 R 핵(점화 신호) + 별 점화·부력 상승(高z 에서 3D ball 방출) + degrade(질 강등·qInit0=0 *냉각 베이스라인* → 별이 유일한 질 source) + kStarQual(주입 E 고질). 중력·생명 등 다 off(순수 별 방출+질 동역학). */
function sqArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kIgnite: 1, kStarRise: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 1, starGap: 6, starR: 2, starDriftPeriod: 20,
    kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kMoveZ: 0, kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.05, qInit0: 0, kStarQual: 0
  }, extra || {});
}
var SUN_RVAL = 2.0;
function seedSunCore(sim) {   // z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다). R 은 E0 장부 baseline 에 산입.
  var p = sim.p, disc = ENG.discCells(p.W, p.H, (p.W / 2) | 0, (p.H / 2) | 0, 2);
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}
var TICKS = 60;
var KSQ = 1.0;   // 별 질(고질 융합 E)
function sumE(sim) { var s = 0, E = sim.E; for (var i = 0; i < E.length; i++) s += E[i]; return s; }
function build(seed, ksq, ticks) { var s = ENG.createSim(seed, sqArena({ kStarQual: ksq })); seedSunCore(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* q 통계 — E 를 담은 칸(E>eps)에 한해: maxQ(별 근처 고질 봉우리)·qBarE(엑서지가중 평균 질)·stdQ(공간 분산 = 질 구배의 척도). */
function qStats(sim) {
  var q = sim.q, E = sim.E, N = E.length, eps = 1e-9, i;
  var maxQ = 0, sumW = 0, sumWQ = 0, n = 0;
  for (i = 0; i < N; i++) {
    if (E[i] <= eps) continue;
    if (q[i] > maxQ) maxQ = q[i];
    sumW += E[i]; sumWQ += q[i] * E[i]; n++;
  }
  var qBarE = sumW > 0 ? sumWQ / sumW : 0;
  var v = 0; for (i = 0; i < N; i++) { if (E[i] <= eps) continue; var d = q[i] - qBarE; v += d * d; }
  var stdQ = n > 0 ? Math.sqrt(v / n) : 0;
  return { maxQ: maxQ, qBarE: qBarE, stdQ: stdQ, nE: n };
}

/* ── reg: 회귀 0 — kStarQual=0 → 별 주입 E 무질(maxQ=0·X=0)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  var st = qStats(a), X = ENG.measureExergy(a).exergy;
  return { seed: seed, maxQ: st.maxQ, exergy: X, hashA: ha, hashB: hb, pass: ha === hb && st.maxQ === 0 && X === 0 };
}

/* ── grad: 가설 — 별 질 생산이 질 구배를 세운다. kStarQual off vs on 비교. ── */
function grad(seed) {
  var on = build(seed, KSQ, TICKS), off = build(seed, 0, TICKS);
  var sOn = qStats(on), sOff = qStats(off);
  var Xon = ENG.measureExergy(on).exergy, Xoff = ENG.measureExergy(off).exergy;
  return {
    seed: seed, maxQon: sOn.maxQ, qBarEon: sOn.qBarE, stdQon: sOn.stdQ, Xon: Xon,
    maxQoff: sOff.maxQ, Xoff: Xoff,
    /* on: 별 근처 고질(maxQ↑)·공간 구배(stdQ>0)·자유에너지 유지(X>0). off: 질 구배 없음(maxQ=0·X=0). */
    pass: sOn.maxQ > 0.5 && sOn.stdQ > 0 && Xon > 0 && sOff.maxQ === 0 && Xoff === 0
  };
}

/* ── conserve: 질 혼합은 E 미접촉 — 닫힌 장부 잔차(별 주입 E 는 sim.injected 로 산입). ── */
function conserve(seed) {
  var s = build(seed, KSQ, TICKS);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, injected: s.injected, pass: L.residual < 1e-12 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(q 가 해시에 산입). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, KSQ, TICKS)), hb = ENG.hashState(build(seed, KSQ, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'maxQ', 'exergy', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kStarQual=0 → 별 질 블렌딩 미진입 → 별이 E 는 주입해도 질은 무(maxQ=0·엑서지 X=0, q 는 degrade 베이스라인 0 그대로)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(starq@ 포함 전 시나리오 비트 불변·새 노브 kStarQual=0 → q 미접촉)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'grad') {
    var rg = seeds.map(grad); table(rg, ['seed', 'maxQon', 'qBarEon', 'stdQon', 'Xon', 'maxQoff', 'Xoff', 'pass']);
    console.log('별 질 생산이 *질 구배*를 세운다(SPINE 여섯째 축 source 짝): D=8·z=0 R 핵서 별 점화·부력 상승·고질 주입(kStarQual=1)·냉각 베이스라인(qInit0=0)·degrade 0.05, ' + TICKS + ' tick. kStarQual OFF 면 별이 E 는 주입해도 질 구배 없음(maxQ=0·엑서지 X=0) → ON 이면 별 근처 q 가 고질(maxQ ' + avg(rg, 'maxQon').toFixed(2) + ')·degrade 가 나머지를 식혀 *공간 분산* stdQ ' + avg(rg, 'stdQon').toFixed(3) + '(>0=구배)·엑서지 X ' + avg(rg, 'Xon').toFixed(1) + '(>0 — source 가 둘째 법칙 식음에 맞서 자유에너지 유지·엑서지가중 평균 질 q̄_E ' + avg(rg, 'qBarEon').toFixed(3) + '). 질은 *오직 source(별)*서 생산(단일 척추·국소)·혼합은 E 미접촉(q 는 비율).');
    return rg.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'injected', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (질 혼합은 E 를 안 건드린다 — q 는 에너지 아닌 *비율*[A·강등과 같은 경계]. 별 주입 E 는 sim.injected ' + avg(rc, 'injected').toFixed(1) + ' 로 장부에 산입[별 일생 경계 그대로] → 닫힌 장부 유지. 엑서지는 *생산되는* 측정량이지 보존 항 아님).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(q 가 해시에 산입·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'grad', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
