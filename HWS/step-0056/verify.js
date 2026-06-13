/* HWS step-0056 헤드리스 검증 — couple advection(kQCouple — 질이 *막 공유* E 흐름에 동승, SPINE 여섯째 축 transport 짝).
 * 0051 이 질을 *gravity*(하향)·0055 가 *diffuse*(등방) 흐름에 실어 q 가 *필드* E 이동을 따라갔으나, kin 막의 E 공유(couple, ⑥c)는 아직 q 를 안 데려간다 —
 *   액적(kin 도메인) 안에서 E 가 균등화돼도 q 는 제자리에 stranded(막 안에서 E 는 평탄해지는데 q 는 비균질로 남음).
 *   이 step 은 질을 couple flux 에도 싣는다: couple 이 kin 쌍 사이 E 를 균등화(d=(E[c]−E[nb])·k 이동)할 때, 받는 칸은 *흐른 E 의 질*을 질량가중으로 섞는다
 *   (받는 칸 q ← (q·E_recv + q_donor·|d|)/(E_recv+|d|)). 막 안에서 E 가 평탄해지면 그 *질*도 평탄해진다 = q 가 *모든 E 이동*(하향[0051]+등방[0055]+막 공유[이번])을 따라가는 완전한 물리장.
 *   척추: q 는 E 에 올라탄 intensive 속성(단일 척추)·국소(제 우/하(/위) kin 이웃 한 쌍)·advection 은 E 미접촉(couple 이 *이미 옮긴* E 의 질만 따라감 — q 는 비율·거래 0, 닫힌 장부). 0048 수동 막 E-공유의 *질* 짝.
 *   회귀(이중 가드): kQCouple=0 → 혼합 미진입(q 미접촉·0055 비트 동일). qInit=false(degrade off)면 미진입. *교차 버전* 회귀는 verify-sim-engine.js 골든(qcpl@ 포함 전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0056/verify.js <reg|advect|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kQCouple=0 → q 미접촉(0055 비트 동일)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - advect   : 가설 — *질이 막 공유 E 를 따라 흐른다*. kQCouple off vs on: 좌 고질/우 저질 kin 블록서 couple 이 E 를 좌→우 균등화. off 면 우측에 E 는 도착해도 q stranded(우 q≈0) → on 이면 q 가 E 따라 우측으로 advect(우 q↑).
 *  - conserve : 보존 — advection 은 E 미접촉(q 는 비율) — 닫힌 장부 잔차 < 1e-12.
 *  - det      : 결정론 — 같은 시드 2회 비트 동일(상태 해시 일치 — q 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* couple advection 아레나 — verify-sim-engine.js qcplArena()/seedQCouple() 와 동일 상수(골든 qcpl@ 와 일치).
 * 2D(D=1), 8×8 kin 블록(태그 1) 좌 4열 고 E·고질(E 10·q 1)·우 4열 저 E·저질(E 0·q 0) + couple(kMembrane=0.5) + degrade(질 축 alive) + kQCouple 토글. 확산·중력·이동·번식·흡수 다 off(순수 막 공유 수송). qInit0=0. */
function qcplArena(extra) {
  return Object.assign({}, {
    D: 1, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kMoveZ: 0, kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kMembrane: 0.5,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0, kQTaxis: 0, kQMetab: 0, kQExport: 0, kQDiffuse: 0, kQCouple: 1
  }, extra || {});
}
function seedQCouple(sim) {   // 2D 8×8 kin 블록(태그 1) — 좌 4열 고 E·고질(E 10·q 1)·우 4열 저 E·저질(E 0·q 0). spawn 먼저(E=0→m=0) 뒤 E/q 설정. couple 이 좌→우 E 균등화하며 질 동승. q 축 alive.
  var cx = (W >> 1) - 4, cy = (H >> 1) - 4, x, y;
  for (y = cy; y < cy + 8; y++) for (x = cx; x < cx + 8; x++) {
    var a = ENG.spawnAgent(sim, x, y, 0); a.g = 1;             // m0=0·E=0 이라 m=0(couple 은 a.g·center 만 봄)
    var i = y * W + x, hi = x < cx + 4;                        // 좌 4열 고질·우 4열 저질
    sim.E[i] = hi ? 10 : 0; sim.E0 += sim.E[i]; sim.q[i] = hi ? 1 : 0;
  }
  sim.qInit = true;
}
var TICKS = 20;
function build(seed, kqc, ticks) { var s = ENG.createSim(seed, qcplArena({ kQCouple: kqc })); seedQCouple(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* 좌/우 절반 질 — kin 블록 좌 4열(원래 고질)·우 4열(원래 저질·E 만 막으로 도착)의 평균 q.
 * advection 척도: kQCouple on 이면 막 공유로 흐른 E 가 질을 데려가 우측 q↑(고질이 막 안에서 균등화). off 면 q 가 좌측에 stranded(우측 E 는 도착해도 q≈0). */
function halfStats(sim) {
  var q = sim.q, W2 = sim.p.W, H2 = sim.p.H, cx = (W2 >> 1) - 4, cy = (H2 >> 1) - 4, x, y;
  var sl = 0, nl = 0, sr = 0, nr = 0;
  for (y = cy; y < cy + 8; y++) for (x = cx; x < cx + 8; x++) {
    var i = y * W2 + x;
    if (x < cx + 4) { sl += q[i]; nl++; } else { sr += q[i]; nr++; }
  }
  return { qLeft: nl ? sl / nl : 0, qRight: nr ? sr / nr : 0 };
}

/* ── reg: 회귀 0 — kQCouple=0 → q 미접촉(0055 비트 동일)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b), st = halfStats(a);
  return { seed: seed, qLeft: st.qLeft, qRight: st.qRight, hashA: ha, hashB: hb, pass: ha === hb };
}

/* ── advect: 가설 — 질이 막 공유 E 를 따라 흐른다. kQCouple off vs on(둘 다 couple 이 좌→우 E 균등화). ── */
function advectH(seed) {
  var on = build(seed, 1, TICKS), off = build(seed, 0, TICKS);
  var sOn = halfStats(on), sOff = halfStats(off);
  return {
    seed: seed, qRightOn: sOn.qRight, qRightOff: sOff.qRight, qLeftOn: sOn.qLeft, qLeftOff: sOff.qLeft,
    /* on: 막 공유로 흐른 E 가 질을 데려가 우측 q↑(고질이 막 안 균등화). off: q 가 좌측에 stranded → 우측 q≈0(E 만 막으로 도착·q 는 제자리). */
    pass: sOn.qRight > 0.05 && sOff.qRight < 0.001 && sOn.qRight > sOff.qRight + 0.05
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
    var rr = seeds.map(reg); table(rr, ['seed', 'qLeft', 'qRight', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kQCouple=0 → q 미접촉(couple 혼합 미진입·0055 비트 동일) → q 가 좌측에 stranded(막으로 E 도착한 우측 q≈' + avg(rr, 'qRight').toFixed(3) + ')·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(qcpl@ 포함 전 시나리오 비트 불변·새 노브 kQCouple=0 → q 미접촉)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'advect') {
    var rp = seeds.map(advectH); table(rp, ['seed', 'qRightOn', 'qRightOff', 'qLeftOn', 'qLeftOff', 'pass']);
    console.log('질이 *막 공유 E 를 따라 흐른다*(SPINE 여섯째 축 transport — 0048 수동 막 E-공유의 질 짝): D=1·8×8 kin 블록(좌 고질 E 10·q 1·우 저질 E 0·q 0)·couple(kMembrane 0.5)·' + TICKS + ' tick. kQCouple OFF 면 couple 이 E 를 좌→우 균등화해도 우측 q 가 stranded(우 q ' + avg(rp, 'qRightOff').toFixed(3) + '≈0 — E 만 막으로 도착) → ON 이면 q 가 E 따라 우측으로 advect(우 q ' + avg(rp, 'qRightOn').toFixed(3) + ' ≫ OFF). advection 은 E 미접촉(couple 이 옮긴 E 의 질만 따라감)·국소(제 kin 이웃 쌍)·질량가중 혼합. 좌측 q 는 우측과 나누며 옅어짐(ON ' + avg(rp, 'qLeftOn').toFixed(3) + ').');
    return rp.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (advection 은 E 미접촉 — q 는 *비율*[couple 이 이미 옮긴 E 의 질만 질량가중으로 따라감·거래 0·degrade·gravity/diffuse advection 과 같은 경계]. 닫힌 장부 유지).');
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
