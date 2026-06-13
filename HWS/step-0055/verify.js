/* HWS step-0055 헤드리스 검증 — diffuse advection(kQDiffuse — 질이 *등방 확산* E 흐름에 동승, SPINE 여섯째 축 transport 짝).
 * 0051 이 질을 *gravity*(하향) 흐름에 실어 침강 hot plume 을 만들었으나, *등방 확산* 흐름엔 안 실렸다 — 고질 E 가 사방으로 번질 때 q 는 제자리에 stranded(E 와 q 가 따로 논다).
 *   이 step 은 질을 확산 flux 에도 싣는다: diffuse(①, 선형 경로 kRelief=0)가 셀 E 를 이웃과 교환할 때, 받는 칸은 *들어온 E 의 질*을 질량가중으로 섞는다(new_q = (q·retained + Σ q_neighbor·inflow)/확산후E). 고질이 번지면 q 도 따라 번진다 = q 가 *모든 E 이동*(하향[0051]+등방[이번])을 따라가는 완전한 물리장.
 *   척추: q 는 E 에 올라탄 intensive 속성(단일 척추)·국소(제 4(+2z)-이웃)·advection 은 E 미접촉(diffuse 가 *이미 옮긴* E 의 질만 따라감 — q 는 비율·거래 0, 닫힌 장부). 0051 gravity transport 의 *등방 확산* 짝.
 *   회귀(이중 가드): kQDiffuse=0 → advection 미진입(q 버퍼 미할당·미스왑·0054 비트 동일). qInit=false(degrade off)면 미진입. *교차 버전* 회귀는 verify-sim-engine.js 골든(qdfa@ 포함 전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0055/verify.js <reg|advect|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kQDiffuse=0 → q 미접촉(0054 비트 동일)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - advect   : 가설 — *질이 확산 E 를 따라 번진다*. kQDiffuse off vs on: 중앙 고질 블록이 확산. off 면 q 가 중앙에 stranded(번진 E 자리 q≈0) → on 이면 q 가 E 따라 사방으로 advect(ring q↑).
 *  - conserve : 보존 — advection 은 E 미접촉(q 는 비율) — 닫힌 장부 잔차 < 1e-12.
 *  - det      : 결정론 — 같은 시드 2회 비트 동일(상태 해시 일치 — q 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* diffuse advection 아레나 — verify-sim-engine.js qdfaArena()/seedQBlob() 와 동일 상수(골든 qdfa@ 와 일치).
 * 2D(D=1), 중앙 8×8 고질 E 블록(E 10·q 1) + 빈 배경(E 0·q 0) + diffuse(kD=0.2·선형 경로 kRelief=0·kA=0) + degrade(질 축 alive) + kQDiffuse 토글. 별·생명·중력 다 off(순수 확산 수송). qInit0=0. */
function qdfaArena(extra) {
  return Object.assign({}, {
    D: 1, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0.2, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kMoveZ: 0, kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0, kQTaxis: 0, kQMetab: 0, kQExport: 0, kQDiffuse: 1
  }, extra || {});
}
function seedQBlob(sim) {   // 중앙 8×8 고질 E 블록(E 10·q 1) + 빈 배경 — diffuse 가 사방으로 펴며 advection 이 질을 데리고 번진다. q 축 alive.
  var cx = (W >> 1) - 4, cy = (H >> 1) - 4, x, y;
  for (y = cy; y < cy + 8; y++) for (x = cx; x < cx + 8; x++) { var i = y * W + x; sim.E[i] = 10; sim.E0 += 10; sim.q[i] = 1; }
  sim.qInit = true;
}
var TICKS = 20;
function build(seed, kqd, ticks) { var s = ENG.createSim(seed, qdfaArena({ kQDiffuse: kqd })); seedQBlob(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* ring/center 질 — 중앙(블록 안)과 ring(블록 밖 Chebyshev 거리 6~9, 확산 E 가 닿은 자리)의 평균 q.
 * advection 척도: kQDiffuse on 이면 번진 E 가 질을 데려가 ring q↑(고질이 사방 advect). off 면 q 가 중앙에 stranded(번진 자리 q≈0). E>1e-6 칸만(빈칸 제외). */
function ringStats(sim) {
  var q = sim.q, E = sim.E, W2 = sim.p.W, H2 = sim.p.H, cx = W2 >> 1, cy = H2 >> 1, x, y;
  var sc = 0, nc = 0, sr = 0, nr = 0;
  for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) {
    var i = y * W2 + x; if (E[i] <= 1e-6) continue;
    var d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
    if (d < 4) { sc += q[i]; nc++; }                 // 중앙(원래 블록 안)
    else if (d >= 6 && d <= 9) { sr += q[i]; nr++; }  // ring(블록 밖 확산 자리)
  }
  return { qCenter: nc ? sc / nc : 0, qRing: nr ? sr / nr : 0, nCenter: nc, nRing: nr };
}

/* ── reg: 회귀 0 — kQDiffuse=0 → q 미접촉(0054 비트 동일)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b), st = ringStats(a);
  return { seed: seed, qCenter: st.qCenter, qRing: st.qRing, hashA: ha, hashB: hb, pass: ha === hb };
}

/* ── advect: 가설 — 질이 확산 E 를 따라 번진다. kQDiffuse off vs on(둘 다 중앙 고질 블록 확산). ── */
function advectH(seed) {
  var on = build(seed, 1, TICKS), off = build(seed, 0, TICKS);
  var sOn = ringStats(on), sOff = ringStats(off);
  return {
    seed: seed, qRingOn: sOn.qRing, qRingOff: sOff.qRing, qCenterOn: sOn.qCenter, qCenterOff: sOff.qCenter,
    /* on: 번진 E 가 질을 데려가 ring q↑(고질 사방 advect). off: q 가 중앙에 stranded → ring q≈0(E 만 번지고 q 는 제자리). */
    pass: sOn.qRing > 0.1 && sOff.qRing < 0.01 && sOn.qRing > sOff.qRing * 10
  };
}

/* ── conserve: advection 은 E 미접촉(q 는 비율) — 닫힌 장부 잔차. ── */
function conserve(seed) {
  var s = build(seed, 1, TICKS), L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, pass: L.residual < 1e-12 };
}

/* ── det: 같은 시드 2회 비트 동일(q 가 해시에 산입). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, TICKS)), hb = ENG.hashState(build(seed, 1, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'qCenter', 'qRing', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kQDiffuse=0 → q 미접촉(advection 미진입·q 버퍼 미스왑·0054 비트 동일) → q 가 중앙에 stranded(번진 ring 자리 q≈' + avg(rr, 'qRing').toFixed(3) + ')·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(qdfa@ 포함 전 시나리오 비트 불변·새 노브 kQDiffuse=0 → q 미접촉)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'advect') {
    var rp = seeds.map(advectH); table(rp, ['seed', 'qRingOn', 'qRingOff', 'qCenterOn', 'qCenterOff', 'pass']);
    console.log('질이 *확산 E 를 따라 번진다*(SPINE 여섯째 축 transport — 0051 gravity 의 등방 확산 짝): D=1·중앙 8×8 고질 블록(E 10·q 1)·빈 배경·diffuse(kD 0.2)·' + TICKS + ' tick. kQDiffuse OFF 면 E 는 번져도 q 가 중앙에 stranded(ring q ' + avg(rp, 'qRingOff').toFixed(3) + '≈0 — 번진 자리 빈 질) → ON 이면 q 가 E 따라 사방으로 advect(ring q ' + avg(rp, 'qRingOn').toFixed(3) + ' ≫ OFF). advection 은 E 미접촉(diffuse 가 옮긴 E 의 질만 따라감)·국소(제 4-이웃)·질량가중 혼합. 중앙 q 는 번져나가며 옅어짐(ON ' + avg(rp, 'qCenterOn').toFixed(3) + ').');
    return rp.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (advection 은 E 미접촉 — q 는 *비율*[diffuse 가 이미 옮긴 E 의 질만 질량가중으로 따라감·거래 0·degrade·gravity advection 과 같은 경계]. 닫힌 장부 유지).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 상태 해시 일치(q 가 해시에 산입·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'advect', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
