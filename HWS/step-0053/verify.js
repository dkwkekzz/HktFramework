/* HWS step-0053 헤드리스 검증 — 질-의존 대사(kQMetab — 고질 E 가 더 영양, SPINE 여섯째 축의 슈뢰딩거 낙차 *에너지론* 완성).
 * 0049 강등·0050 별 생산·0051 수송이 질 축을 깔고, 0052 가 생명을 질 따라 *모이게*(주화성) 했다. 그러나 생명은 아직 모든 E 를 *같은 효율*로 먹는다(고질이든 저질이든 흡수 동일 — 질을 쫓되 먹는 방식은 양 기반).
 *   이 step 은 생명이 질을 *먹게* 한다: metabolize(⑦)가 disc 칸에서 E→m 흡수할 때 take 를 *질 가중* take = E·kL·(1 + kQMetab·q) 로 → 고질(고 q=엑서지 높은) E 를 더 많이·빨리 빨아들인다(슈뢰딩거: 생명은 *자유에너지*[저엔트로피 질]를 먹어 제 질서를 유지한다 — 양이 아니라 질을 먹는다). 0052 주화성(질 따라 *모임*)의 에너지론 짝(질 따라 *먹음*).
 *   척추: q 는 E 에 올라탄 intensive 상태변수(단일 척추)·국소(제 disc 칸 E·q)·흡수는 E→m 쌍 거래로 보존(닫힌 장부 — q 는 *읽기만*[미수정, A·강등·주화성과 같은 읽기 경계]).
 *   회귀(이중 가드): kQMetab=0 → take=E·kL 바이트 동일(균일 흡수·q 미참조). qInit=false(degrade off)면 미진입. *교차 버전* 회귀는 verify-sim-engine.js 골든(qmet@ 포함 전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0053/verify.js <reg|nourish|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kQMetab=0 → 균일 흡수(고질/저질 무리 m 동일)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - nourish  : 가설 — *고질 E 가 더 영양*. kQMetab off vs on: 같은 E=2, 고질(q 0.9) 위 무리 vs 저질(q 0.1) 위 무리. off 면 둘 다 같은 m → on 이면 고질 무리가 더 많이 흡수(mHigh↑·mHigh>mLow).
 *  - conserve : 보존 — 흡수는 E→m 쌍 거래(q 읽기·E→m 보존) — 닫힌 장부 잔차 < 1e-12.
 *  - det      : 결정론 — 같은 시드 2회 비트 동일(상태 해시 일치 — q·agent.m 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 질-의존 대사 아레나 — verify-sim-engine.js qmetArena()/seedQMetab() 와 동일 상수(골든 qmet@ 와 일치).
 * 2D(D=1), 평탄 E=2 + 두 q 구역(고질 0.9·저질 0.1·같은 E) + 정착 생명 두 무리(고질 위 3×3·저질 위 3×3·move off — 흡수 격리) + degrade(질 축 alive) + mMaint 0(순수 m 누적). qInit0=0. */
function qmetArena(extra) {
  return Object.assign({}, {
    D: 1, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0.05, lifeR: 0,
    life: true, move: false, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0, kQTaxis: 0, kQMetab: 5
  }, extra || {});
}
function seedQMetab(sim) {   // 평탄 E=2 + 고질(0.9)/저질(0.1) 두 구역 + 정착 생명 두 무리(고질 위 y=26~30·저질 위 y=36~40). q 축 alive.
  var p = sim.p, N = W * H, E = sim.E, q = sim.q, i, gx, gy;
  for (i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; q[i] = 0.1; }
  for (var y = 24; y < 32; y++) for (var x = 16; x < 26; x++) q[y * W + x] = 0.9;   // 고질 구역
  sim.qInit = true;
  for (gx = 0; gx < 3; gx++) for (gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 26 + gy * 2);   // 고질 무리(q 0.9)
  for (gx = 0; gx < 3; gx++) for (gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 36 + gy * 2);   // 저질 무리(q 0.1)
}
var TICKS = 12;
function build(seed, kqm, ticks) { var s = ENG.createSim(seed, qmetArena({ kQMetab: kqm })); seedQMetab(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* 생명 통계: 고질 무리(q[center]≥0.5)·저질 무리(<0.5)의 평균 생물량 m — 질-의존 대사 척도. */
function lifeStats(sim) {
  var ag = sim.agents, q = sim.q, sh = 0, nh = 0, sl = 0, nl = 0;
  for (var i = 0; i < ag.length; i++) {
    var a = ag[i];
    if (q[a.center] >= 0.5) { sh += a.m; nh++; } else { sl += a.m; nl++; }
  }
  return { mHigh: nh ? sh / nh : 0, mLow: nl ? sl / nl : 0, nHigh: nh, nLow: nl };
}

/* ── reg: 회귀 0 — kQMetab=0 → 균일 흡수(고질/저질 무리 m 동일)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b), st = lifeStats(a);
  return { seed: seed, mHigh: st.mHigh, mLow: st.mLow, hashA: ha, hashB: hb, pass: ha === hb && Math.abs(st.mHigh - st.mLow) < 1e-12 };
}

/* ── nourish: 가설 — 고질 E 가 더 영양. kQMetab off vs on(둘 다 같은 E=2·고질/저질 두 무리). ── */
function nourish(seed) {
  var on = build(seed, 5, TICKS), off = build(seed, 0, TICKS);
  var sOn = lifeStats(on), sOff = lifeStats(off);
  return {
    seed: seed, mHighOn: sOn.mHigh, mLowOn: sOn.mLow, mHighOff: sOff.mHigh, mLowOff: sOff.mLow,
    /* on: 고질 무리가 더 많이 흡수(mHigh>mLow). off: 같은 E 라 둘 다 같은 m(질 무관). */
    pass: sOn.mHigh > sOn.mLow * 1.3 && Math.abs(sOff.mHigh - sOff.mLow) < 1e-12 && sOn.mHigh > sOff.mHigh
  };
}

/* ── conserve: 흡수는 E→m 쌍 거래(q 읽기) — 닫힌 장부 잔차. ── */
function conserve(seed) {
  var s = build(seed, 5, TICKS), L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, pass: L.residual < 1e-12 };
}

/* ── det: 같은 시드 2회 비트 동일(q·agent.m 가 해시에 산입). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 5, TICKS)), hb = ENG.hashState(build(seed, 5, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'mHigh', 'mLow', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kQMetab=0 → take=E·kL 바이트 동일(균일 흡수·q 미참조) → 고질/저질 무리 m 동일(mHigh≈mLow≈' + avg(rr, 'mHigh').toFixed(3) + ')·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(qmet@ 포함 전 시나리오 비트 불변·새 노브 kQMetab=0 → take=E·kL)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'nourish') {
    var rp = seeds.map(nourish); table(rp, ['seed', 'mHighOn', 'mLowOn', 'mHighOff', 'mLowOff', 'pass']);
    console.log('고질 E 가 *더 영양*이다(SPINE 여섯째 축 슈뢰딩거 에너지론): D=1·평탄 E=2·고질(q 0.9)/저질(q 0.1) 두 구역·정착 생명 두 무리·' + TICKS + ' tick. kQMetab OFF 면 같은 E 라 두 무리 m 동일(mHigh ' + avg(rp, 'mHighOff').toFixed(3) + '≈mLow ' + avg(rp, 'mLowOff').toFixed(3) + '·질 무관) → ON 이면 고질 무리가 더 많이 흡수(mHigh ' + avg(rp, 'mHighOn').toFixed(3) + ' > mLow ' + avg(rp, 'mLowOn').toFixed(3) + ') = 생명이 *질*을 먹는다(자유에너지로 산다). 흡수는 E→m 쌍 거래로 보존·국소(제 disc 칸)·q 는 읽기만(미수정).');
    return rp.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (흡수는 E→m 쌍 거래로 보존 — q 는 *읽기만*[흡수 효율 가중일 뿐 q 미수정·E·강등·주화성과 같은 읽기 경계]. 닫힌 장부 유지).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 상태 해시 일치(q·agent.m 가 해시에 산입·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'nourish', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
