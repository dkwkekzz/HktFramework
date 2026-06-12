/* HWS step-0049 헤드리스 검증 — 에너지의 질(degrade — E 에 연속 질 축 q 를 더해 둘째 법칙으로 단조 강등, SPINE 여섯째 축).
 * 0035~0041 이 에너지·물질 순환을 닫고 0042~0048 이 생명 7법칙을 z 로 풀었다. 그러나 E 는 여전히 *무차별 단일 스칼라* + 이진 누출(E→T)뿐 —
 *   "쓸 수 있는 E ↔ 잃은 T" 의 이분만 있고 *연속 질 축*이 없었다. 그래서 ① 별의 뜨거운 E 한 단위와 식은 바다의 E 한 단위가 질 구별 0 ② 렌더가 흑체 색온도를 못 읽음(필드에 질 없음).
 *   이 step 은 E 에 *내재 질* q[i]∈[0,1](농축도/온도, 1=고질·저엔트로피 ↔ 0=열적·고엔트로피)을 더하고, 둘째 법칙(degrade: q -= q·kDegrade 단조 감소)을 깐다 —
 *   엑서지(자유에너지) X=Σq·E 가 단조 파괴된다(시간의 화살표·닫힌 세계는 열적 평형으로 식음). q 는 새 *필드* 아니라 E 에 올라탄 intensive 속성(단일 척추)·강등은 E 미접촉(장부 불변).
 *   회귀(가드): kDegrade=0 → degrade 통째 skip → qInit=false → q 미할당·미해시 → 직전 step(0048) 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든(전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0049/verify.js <reg|mix|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kDegrade=0 → q 미작동(qInit=false·exergyLost=0)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - mix      : 가설 — *엑서지 X=Σq·E 가 단조 파괴된다(둘째 법칙)·E 는 보존*. kDegrade off vs on 비교: off 면 질 축 없음(X=0·exergyLost=0) → on 이면 q 가 매 tick 식어 X 단조 감소(strictly decreasing)·sumE 불변.
 *  - conserve : 보존 — 강등은 E 미접촉(q 는 에너지 아닌 비율) — 닫힌 장부 잔차 < 1e-12 + sumE 가 정확히 불변(엑서지는 destroyed 지만 E 는 보존).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — q 가 해시에 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, DZ = 8;

/* 에너지 질 아레나 — verify-sim-engine.js qualArena() 와 동일 상수(골든 qual@ 와 일치).
 * D=8 voxel, 균일 E(noise 로 미세 섭동) + degrade 만 on(확산·중력·증발·이동·생명 등 모든 동역학 off → E 가 *안 움직인다* → sumE 정확히 불변·X 감소는 순수 강등). qInit0=1.0(원시 고질). kDegrade 토글. */
function qArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 1.0, noise: 0.5, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kDegrade: 0, qInit0: 1.0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kMoveZ: 0, kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0
  }, extra || {});
}
var TICKS = 30;
var KDEG = 0.05;
function sumE(sim) { var s = 0, E = sim.E; for (var i = 0; i < E.length; i++) s += E[i]; return s; }
function build(seed, kDeg, ticks) { var s = ENG.createSim(seed, qArena({ kDegrade: kDeg })); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* ── reg: 회귀 0 — kDegrade=0 → q 미작동(qInit=false·exergyLost=0)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, lost: a.exergyLost, qInit: a.qInit, hashA: ha, hashB: hb, pass: ha === hb && a.exergyLost === 0 && a.qInit === false };
}

/* ── mix: 가설 — 엑서지 X=Σq·E 가 단조 파괴된다(둘째 법칙)·E 는 보존. kDegrade off vs on 비교. ── */
function mix(seed) {
  var on = ENG.createSim(seed, qArena({ kDegrade: KDEG }));
  var off = ENG.createSim(seed, qArena({ kDegrade: 0 }));
  var E0 = sumE(on), Xs = [], mono = true, eCons = true;
  for (var t = 0; t < TICKS; t++) {
    ENG.step(on); ENG.step(off);
    Xs.push(ENG.measureExergy(on).exergy);
    if (Math.abs(sumE(on) - E0) > 1e-12) eCons = false;       // E 는 늘 보존(degrade 가 E 미접촉)
  }
  /* Xs[0] = 첫 tick(q 베이스라인 설정만, 강등 skip) → X = E0·qInit0(=E0, q=1 전부). Xs[1..] 매 tick 단조 감소. */
  for (var i = 1; i < Xs.length; i++) { if (Xs[i] >= Xs[i - 1]) mono = false; }
  var Xstart = Xs[0], Xend = Xs[Xs.length - 1];
  return {
    seed: seed, Xstart: Xstart, Xend: Xend, drop: Xstart - Xend, meanQ: ENG.measureExergy(on).meanQ,
    lostOn: on.exergyLost, lostOff: off.exergyLost, eCons: eCons,
    /* off: 질 축 없음(X=0·exergyLost=0). on: X 단조 감소(strictly)·exergyLost>0·E 보존. */
    pass: Xend < Xstart && mono && on.exergyLost > 0 && off.exergyLost === 0 && eCons
  };
}

/* ── conserve: 강등은 E 미접촉(q 는 에너지 아닌 비율) — 닫힌 장부 잔차 + sumE 정확히 불변. ── */
function conserve(seed) {
  var s = build(seed, KDEG, TICKS);
  var L = ENG.ledger(s), eDiff = Math.abs(sumE(s) - s.E0);
  return { seed: seed, residual: L.residual, sumEdiff: eDiff, lost: s.exergyLost, pass: L.residual < 1e-12 && eDiff < 1e-12 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(q 가 해시에 산입). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, KDEG, TICKS)), hb = ENG.hashState(build(seed, KDEG, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'lost', 'qInit', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kDegrade=0 → degrade 통째 skip(qInit=false → q 미할당·미해시·exergyLost=0)·2회 실행 비트 동일 = 직전 step(0048) 그대로. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~cpl3@ 비트 불변·새 노브 kDegrade=0 → q 미해시)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'mix') {
    var rb = seeds.map(mix); table(rb, ['seed', 'Xstart', 'Xend', 'drop', 'meanQ', 'lostOn', 'lostOff', 'eCons', 'pass']);
    console.log('엑서지 X=Σq·E 가 단조 파괴된다(둘째 법칙·SPINE 여섯째 축): D=8·균일 E·degrade 만 on(모든 동역학 off → E 안 움직임). kDegrade OFF 면 질 축 없음(X=0·파괴 ' + avg(rb, 'lostOff').toFixed(2) + ') → ON(kDegrade=' + KDEG + ') 이면 q 가 원시 고질(1.0)에서 매 tick 식어 X 가 ' + avg(rb, 'Xstart').toFixed(1) + '→' + avg(rb, 'Xend').toFixed(1) + ' 로 *단조* 감소(평균 질 q̄ ' + avg(rb, 'meanQ').toFixed(3) + '·누적 파괴 엑서지 ' + avg(rb, 'lostOn').toFixed(1) + ') = 닫힌 세계가 열적 평형으로 식음. 그동안 sumE 는 정확히 불변(eCons — 강등은 *질*만 내릴 뿐 E 미접촉). q 는 E 에 올라탄 intensive 속성(단일 척추).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumEdiff', 'lost', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' · sumE 편차=' + avg(rc, 'sumEdiff').toExponential(3) + ' (강등은 E 를 안 건드린다 — q 는 에너지 아닌 *비율*[A 와 같은 경계]. 엑서지 ' + avg(rc, 'lost').toFixed(1) + ' 가 파괴돼도[destroyed = 둘째 법칙] 닫힌 장부의 E 는 정확히 보존).');
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
if (mode === 'all') { ok = ['reg', 'mix', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
